import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";
import { round2, summarizeInvoice } from "../lib/invoiceMath.js";

export const portalRouter = Router();
portalRouter.use(requireAuth);
portalRouter.use(requireRole("patient"));

// Resolve the Patient record for the logged-in user — the security boundary.
// Every handler operates only on THIS patient's data.
async function me(req, res, next) {
  const patient = await prisma.patient.findFirst({ where: { userId: req.user.id } });
  if (!patient) return res.status(404).json({ error: "No patient record linked to this account" });
  req.patient = patient;
  next();
}
portalRouter.use(me);

// Profile + health summary
portalRouter.get("/me", async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: req.patient.id },
    include: { insurance: true, allergies: true, medications: true },
  });
  res.json(patient);
});

// Appointments (upcoming + past)
portalRouter.get("/appointments", async (req, res) => {
  const appts = await prisma.appointment.findMany({
    where: { patientId: req.patient.id },
    include: { provider: true, department: true },
    orderBy: { startAt: "desc" },
  });
  res.json(appts);
});

// Cancel one of my upcoming appointments
portalRouter.post("/appointments/:id/cancel", async (req, res) => {
  const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appt || appt.patientId !== req.patient.id) return res.status(404).json({ error: "Not found" });
  if (new Date(appt.startAt) < new Date()) return res.status(400).json({ error: "Cannot cancel a past appointment" });
  const updated = await prisma.appointment.update({ where: { id: appt.id }, data: { status: "Cancelled" } });
  await audit(req, "patient-cancel", "Appointment", appt.id);
  res.json(updated);
});

// Test & imaging results (only resulted orders from my encounters)
portalRouter.get("/results", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { status: "Resulted", encounter: { patientId: req.patient.id } },
    include: { encounter: { include: { appointment: { include: { provider: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(orders);
});

// Active prescriptions
portalRouter.get("/prescriptions", async (req, res) => {
  const rx = await prisma.prescription.findMany({
    where: { patientId: req.patient.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(rx);
});

// Completed visits — After Visit Summary list
portalRouter.get("/visits", async (req, res) => {
  const visits = await prisma.encounter.findMany({
    where: { patientId: req.patient.id, status: "Closed" },
    include: {
      appointment: { include: { provider: true, department: true } },
      diagnoses: true, orders: true, prescriptions: true,
      notes: true, vitals: { orderBy: { recordedAt: "desc" } },
    },
    orderBy: { checkInAt: "desc" },
  });
  res.json(visits);
});

portalRouter.get("/visits/:id", async (req, res) => {
  const visit = await prisma.encounter.findFirst({
    where: { id: req.params.id, patientId: req.patient.id },
    include: {
      appointment: { include: { provider: true, department: true } },
      diagnoses: true, orders: true, prescriptions: true,
      notes: true, vitals: { orderBy: { recordedAt: "desc" } },
    },
  });
  if (!visit) return res.status(404).json({ error: "Not found" });
  res.json(visit);
});

// Billing — real balances from the patient's invoices, using the same money
// logic the billing office uses, so the two can never tell different stories.
portalRouter.get("/billing", async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { patientId: req.patient.id },
    include: { charges: true, claim: true, payments: true },
    orderBy: { createdAt: "desc" },
  });

  const bills = invoices.map((inv) => {
    const s = summarizeInvoice(inv);
    return {
      id: inv.id, number: inv.number, status: inv.status, createdAt: inv.createdAt,
      billed: s.billed, insurancePaid: s.insurancePaid, contractualAdj: s.contractualAdj,
      youOwe: s.patientResponsibility, youPaid: s.patientPaid, balance: s.balance,
      claim: inv.claim ? { status: inv.claim.status, payerName: inv.claim.payerName, denialReason: inv.claim.denialReason } : null,
    };
  });

  // Only the patient's own money counts as "you paid" — insurer EFTs are not theirs.
  const payments = await prisma.payment.findMany({
    where: { patientId: req.patient.id, source: "Patient" },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    payments,
    bills,
    totalPaid: round2(payments.reduce((s, p) => s + p.amount, 0)),
    balance: round2(bills.reduce((s, b) => s + Math.max(b.balance, 0), 0)),
  });
});

// Secure messaging with the care team
portalRouter.get("/messages", async (req, res) => {
  res.json(await prisma.message.findMany({ where: { patientId: req.patient.id }, orderBy: { createdAt: "asc" } }));
});

portalRouter.post("/messages", async (req, res) => {
  const { body } = req.body || {};
  if (!body?.trim()) return res.status(400).json({ error: "Message body required" });
  const msg = await prisma.message.create({
    data: { patientId: req.patient.id, sender: "Patient", body: body.trim() },
  });
  await audit(req, "message", "Message", msg.id);
  res.status(201).json(msg);
});
