import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

const CAN_COLLECT = ["receptionist", "billing"];

// Collect a copay / bill payment (PatientWallet-style)
paymentsRouter.post("/", requireRole(...CAN_COLLECT), async (req, res) => {
  const { patientId, encounterId, amount, type, method } = req.body || {};
  if (!patientId || !amount) return res.status(400).json({ error: "patientId and amount required" });
  const payment = await prisma.payment.create({
    data: {
      patientId,
      encounterId: encounterId || null,
      amount: Number(amount),
      type: type || "Copay",
      method: method || "Card",
      status: "Paid",
    },
  });
  await audit(req, "payment", "Payment", payment.id, { amount, type });
  res.status(201).json(payment);
});

// Simple KPI feed for the dashboard
paymentsRouter.get("/today-summary", async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const payments = await prisma.payment.findMany({ where: { createdAt: { gte: start } } });
  const total = payments.reduce((s, p) => s + p.amount, 0);
  res.json({ count: payments.length, total });
});
