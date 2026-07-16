import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";
import { ah } from "../lib/ah.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const CAN_COLLECT = ["receptionist", "billing"];

// Collect a copay / bill payment (PatientWallet-style)
paymentsRouter.post("/", requireRole(...CAN_COLLECT), ah(async (req, res) => {
  const { patientId, encounterId, amount, type, method } = req.body || {};
  if (!patientId || !amount) return res.status(400).json({ error: "patientId and amount required" });

  // If this encounter has already been invoiced, attach the copay to that invoice
  // so it credits against the patient's balance instead of billing them twice.
  let invoiceId = null;
  if (encounterId) {
    const inv = await prisma.invoice.findUnique({ where: { encounterId } });
    invoiceId = inv?.id ?? null;
  }

  const payment = await prisma.payment.create({
    data: {
      patientId,
      encounterId: encounterId || null,
      invoiceId,
      amount: Number(amount),
      type: type || "Copay",
      method: method || "Card",
      source: "Patient",
      status: "Paid",
    },
  });
  await audit(req, "payment", "Payment", payment.id, { amount, type });
  res.status(201).json(payment);
}));

// Front-desk KPI: cash actually collected from patients today.
// Staff-only, and scoped to patient money — insurer EFT remittances are not desk cash.
paymentsRouter.get("/today-summary", requireRole(...CAN_COLLECT), ah(async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: start }, source: "Patient" },
  });
  const total = payments.reduce((s, p) => s + p.amount, 0);
  res.json({ count: payments.length, total: Math.round(total * 100) / 100 });
}));
