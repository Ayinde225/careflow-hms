import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";
import { OFFICE_VISIT, chargeForOrder } from "../chargeMaster.js";
import { round2, summarizeInvoice, deriveStatus } from "../lib/invoiceMath.js";
import { ah, withNumberRetry } from "../lib/ah.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);
billingRouter.use(requireRole("billing")); // admin auto-allowed by requireRole

const ROLLUP = { charges: true, claim: true, payments: true };
const withSummary = (inv) => ({ ...inv, summary: summarizeInvoice(inv) });

// Completed encounters that don't yet have an invoice
billingRouter.get("/unbilled", ah(async (_req, res) => {
  const encs = await prisma.encounter.findMany({
    where: { status: "Closed", invoice: null },
    include: { patient: true, appointment: { include: { provider: true, department: true } }, orders: true },
    orderBy: { checkInAt: "desc" },
  });
  res.json(encs);
}));

// Generate an invoice + charges from an encounter's services
billingRouter.post("/encounters/:id/invoice", ah(async (req, res) => {
  const enc = await prisma.encounter.findUnique({
    where: { id: req.params.id },
    include: { orders: true, invoice: true },
  });
  if (!enc) return res.status(404).json({ error: "Encounter not found" });
  if (enc.invoice) return res.status(409).json({ error: "Invoice already exists" });
  if (enc.status !== "Closed") return res.status(409).json({ error: "Encounter must be completed before billing" });

  const lines = [OFFICE_VISIT, ...enc.orders.map(chargeForOrder)];
  const year = new Date().getFullYear();

  const invoice = await withNumberRetry(
    async (attempt) => `INV-${year}-${String((await prisma.invoice.count()) + 1 + attempt).padStart(4, "0")}`,
    (number) =>
      prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            number, patientId: enc.patientId, encounterId: enc.id, status: "Open",
            charges: { create: lines.map((l) => ({ cptCode: l.cptCode, description: l.description, amount: l.amount, quantity: 1 })) },
          },
        });
        // Credit copays already collected at check-in against this invoice,
        // otherwise the patient gets billed twice for the same money.
        await tx.payment.updateMany({
          where: { encounterId: enc.id, invoiceId: null },
          data: { invoiceId: inv.id },
        });
        const full = await tx.invoice.findUnique({ where: { id: inv.id }, include: ROLLUP });
        await tx.invoice.update({ where: { id: inv.id }, data: { status: deriveStatus(full) } });
        return tx.invoice.findUnique({ where: { id: inv.id }, include: ROLLUP });
      })
  );

  await audit(req, "invoice", "Invoice", invoice.id, { number: invoice.number });
  res.status(201).json(withSummary(invoice));
}));

billingRouter.get("/invoices", ah(async (_req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { patient: true, ...ROLLUP },
    orderBy: { createdAt: "desc" },
  });
  res.json(invoices.map(withSummary));
}));

billingRouter.get("/invoices/:id", ah(async (req, res) => {
  const inv = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { patient: { include: { insurance: true } }, ...ROLLUP,
      encounter: { include: { appointment: { include: { provider: true, department: true } } } } },
  });
  if (!inv) return res.status(404).json({ error: "Not found" });
  res.json(withSummary(inv));
}));

// Submit an insurance claim → payer adjudication (atomic)
billingRouter.post("/invoices/:id/claim", ah(async (req, res) => {
  const inv = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { ...ROLLUP, patient: { include: { insurance: true } } },
  });
  if (!inv) return res.status(404).json({ error: "Not found" });
  if (inv.claim) return res.status(409).json({ error: "Claim already submitted" });

  const policy = inv.patient.insurance?.[0];
  if (!policy) return res.status(400).json({ error: "Patient has no insurance on file (self-pay)" });

  const billed = summarizeInvoice(inv).billed;
  const copay = policy.copayAmount || 0;
  const year = new Date().getFullYear();

  // Adjudication: unverified coverage is denied (deterministic + realistic).
  const denied = policy.verificationStatus !== "Verified";
  const allowed = denied ? 0 : round2(billed * 0.7); // 30% contractual adjustment
  const insurancePaid = denied ? 0 : round2(Math.max(allowed - copay, 0));
  const patientResponsibility = denied ? billed : round2(allowed - insurancePaid);

  let claim;
  try {
    claim = await withNumberRetry(
      async (attempt) => `CLM-${year}-${String((await prisma.claim.count()) + 1 + attempt).padStart(5, "0")}`,
      (claimNumber) =>
        prisma.$transaction(async (tx) => {
          // Create the claim FIRST so the uniqueness guard trips before money moves.
          const c = await tx.claim.create({
            data: {
              invoiceId: inv.id, patientId: inv.patientId, payerName: policy.payerName, claimNumber,
              submittedAt: new Date(), status: denied ? "Denied" : "Paid",
              billedAmount: billed, allowedAmount: allowed, insurancePaid, patientResponsibility,
              denialReason: denied ? "Coverage could not be verified (eligibility)" : null,
            },
          });
          if (!denied && insurancePaid > 0) {
            await tx.payment.create({
              data: { patientId: inv.patientId, invoiceId: inv.id, amount: insurancePaid, type: "Bill", method: "EFT", source: "Insurance", status: "Paid" },
            });
          }
          // Recompute status from the money — never from the claim outcome alone,
          // or an already-paid invoice would be forced back to Denied.
          const full = await tx.invoice.findUnique({ where: { id: inv.id }, include: ROLLUP });
          await tx.invoice.update({ where: { id: inv.id }, data: { status: deriveStatus(full) } });
          return c;
        })
    );
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ error: "Claim already submitted" });
    throw e;
  }

  await audit(req, "claim", "Invoice", inv.id, { claimNumber: claim.claimNumber, status: claim.status });
  res.status(201).json(claim);
}));

// Post a patient payment against an invoice
billingRouter.post("/invoices/:id/payment", ah(async (req, res) => {
  const { amount, method } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: "A positive amount is required" });

  const inv = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: ROLLUP });
  if (!inv) return res.status(404).json({ error: "Not found" });

  const before = summarizeInvoice(inv);
  if (before.balance <= 0) return res.status(400).json({ error: "This invoice has no balance due" });
  if (amt > before.balance + 0.005) {
    return res.status(400).json({ error: `Payment exceeds balance due of $${before.balance.toFixed(2)}` });
  }

  const summary = await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { patientId: inv.patientId, invoiceId: inv.id, amount: round2(amt), type: "Bill", method: method || "Card", source: "Patient", status: "Paid" },
    });
    const full = await tx.invoice.findUnique({ where: { id: inv.id }, include: ROLLUP });
    const s = summarizeInvoice(full);
    await tx.invoice.update({ where: { id: inv.id }, data: { status: deriveStatus(full, s) } });
    return s;
  });

  await audit(req, "payment", "Invoice", inv.id, { amount: round2(amt) });
  res.status(201).json({ summary });
}));

// Revenue analytics — the finance dashboard
billingRouter.get("/analytics", ah(async (_req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { ...ROLLUP, encounter: { include: { appointment: { include: { department: true } } } } },
  });

  let grossCharges = 0, contractualAdj = 0, insuranceCollected = 0, patientCollected = 0, outstandingAR = 0;
  const byDept = {}, payerMix = {};

  for (const inv of invoices) {
    const s = summarizeInvoice(inv);
    grossCharges += s.billed;
    contractualAdj += s.contractualAdj;
    insuranceCollected += s.insurancePaid;
    patientCollected += s.patientPaid;
    outstandingAR += Math.max(s.balance, 0);
    const dept = inv.encounter?.appointment?.department?.name || "Other";
    byDept[dept] = round2((byDept[dept] || 0) + s.billed);
    if (inv.claim) payerMix[inv.claim.payerName] = round2((payerMix[inv.claim.payerName] || 0) + s.billed);
  }

  const claims = invoices.map((i) => i.claim).filter(Boolean);
  const denied = claims.filter((c) => c.status === "Denied").length;

  res.json({
    grossCharges: round2(grossCharges),
    contractualAdjustments: round2(contractualAdj),
    netRevenue: round2(insuranceCollected + patientCollected),
    insuranceCollected: round2(insuranceCollected),
    patientCollected: round2(patientCollected),
    outstandingAR: round2(outstandingAR),
    denialRate: claims.length ? round2((denied / claims.length) * 100) : 0,
    claimsSubmitted: claims.length,
    claimsDenied: denied,
    chargesByDepartment: Object.entries(byDept).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    payerMix: Object.entries(payerMix).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    invoiceCount: invoices.length,
  });
}));
