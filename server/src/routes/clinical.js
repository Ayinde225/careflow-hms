import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";

export const clinicalRouter = Router();

const CLINICIAN = ["doctor"];
const CLINICAL_STAFF = ["doctor", "nurse"];

// Whole clinical surface is staff-only — patients (and reception) are blocked here.
clinicalRouter.use(requireAuth);
clinicalRouter.use(requireRole(...CLINICAL_STAFF));

// Clinician queue: today's checked-in / roomed encounters
clinicalRouter.get("/queue", async (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const encounters = await prisma.encounter.findMany({
    where: { checkInAt: { gte: start, lte: end }, status: { not: "Closed" } },
    include: {
      patient: true,
      appointment: { include: { provider: true, department: true } },
      diagnoses: true,
    },
    orderBy: { checkInAt: "asc" },
  });
  res.json(encounters);
});

// Full clinical chart for one encounter
clinicalRouter.get("/encounters/:id", async (req, res) => {
  const enc = await prisma.encounter.findUnique({
    where: { id: req.params.id },
    include: {
      patient: { include: { allergies: true, medications: true, insurance: true } },
      appointment: { include: { provider: true, department: true } },
      vitals: { orderBy: { recordedAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      diagnoses: { orderBy: { createdAt: "asc" } },
      orders: { orderBy: { createdAt: "desc" } },
      prescriptions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!enc) return res.status(404).json({ error: "Encounter not found" });
  res.json(enc);
});

// Vitals (nurse or doctor)
clinicalRouter.post("/encounters/:id/vitals", requireRole(...CLINICAL_STAFF), async (req, res) => {
  const b = req.body || {};
  const v = await prisma.vitals.create({
    data: {
      encounterId: req.params.id,
      systolic: num(b.systolic), diastolic: num(b.diastolic), heartRate: num(b.heartRate),
      temperatureF: num(b.temperatureF), respiratoryRate: num(b.respiratoryRate),
      weightKg: num(b.weightKg), heightCm: num(b.heightCm),
      recordedByUserId: req.user.id,
    },
  });
  await audit(req, "vitals", "Encounter", req.params.id);
  res.status(201).json(v);
});

// SOAP note (doctor)
clinicalRouter.post("/encounters/:id/note", requireRole(...CLINICIAN), async (req, res) => {
  const { subjective, objective, assessment, plan } = req.body || {};
  const note = await prisma.clinicalNote.create({
    data: { encounterId: req.params.id, subjective, objective, assessment, plan, authorUserId: req.user.id },
  });
  await audit(req, "note", "Encounter", req.params.id);
  res.status(201).json(note);
});

// Diagnosis (doctor)
clinicalRouter.post("/encounters/:id/diagnoses", requireRole(...CLINICIAN), async (req, res) => {
  const { icd10Code, description, isPrimary } = req.body || {};
  if (!icd10Code || !description) return res.status(400).json({ error: "icd10Code and description required" });
  const dx = await prisma.diagnosis.create({
    data: { encounterId: req.params.id, icd10Code, description, isPrimary: !!isPrimary },
  });
  await audit(req, "diagnosis", "Encounter", req.params.id, { icd10Code });
  res.status(201).json(dx);
});

clinicalRouter.delete("/diagnoses/:id", requireRole(...CLINICIAN), async (req, res) => {
  await prisma.diagnosis.delete({ where: { id: req.params.id } });
  await audit(req, "diagnosis-remove", "Diagnosis", req.params.id);
  res.json({ ok: true });
});

// Orders — labs & imaging (doctor)
clinicalRouter.post("/encounters/:id/orders", requireRole(...CLINICIAN), async (req, res) => {
  const { type, name } = req.body || {};
  if (!type || !name) return res.status(400).json({ error: "type and name required" });
  const order = await prisma.order.create({
    data: { encounterId: req.params.id, type, name, orderedByUserId: req.user.id },
  });
  await audit(req, "order", "Encounter", req.params.id, { type, name });
  res.status(201).json(order);
});

// Mock resulting an order
clinicalRouter.patch("/orders/:id/result", requireRole(...CLINICAL_STAFF), async (req, res) => {
  const { resultText } = req.body || {};
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { status: "Resulted", resultText: resultText || "Within normal limits" },
  });
  await audit(req, "order-result", "Order", req.params.id);
  res.json(order);
});

// Prescription / e-prescribe (doctor)
clinicalRouter.post("/encounters/:id/prescriptions", requireRole(...CLINICIAN), async (req, res) => {
  const enc = await prisma.encounter.findUnique({ where: { id: req.params.id } });
  if (!enc) return res.status(404).json({ error: "Encounter not found" });
  const { drugName, dose, frequency, quantity, refills, instructions } = req.body || {};
  if (!drugName) return res.status(400).json({ error: "drugName required" });
  const rx = await prisma.prescription.create({
    data: {
      encounterId: enc.id, patientId: enc.patientId, drugName, dose, frequency,
      quantity: num(quantity), refills: num(refills) || 0, instructions, prescribedByUserId: req.user.id,
    },
  });
  await audit(req, "prescribe", "Encounter", enc.id, { drugName });
  res.status(201).json(rx);
});

// Complete the visit → close encounter, mark appointment completed
clinicalRouter.post("/encounters/:id/complete", requireRole(...CLINICIAN), async (req, res) => {
  const enc = await prisma.encounter.update({
    where: { id: req.params.id },
    data: { status: "Closed" },
    include: { appointment: true },
  });
  if (enc.appointmentId) {
    await prisma.appointment.update({ where: { id: enc.appointmentId }, data: { status: "Completed" } });
  }
  await audit(req, "complete", "Encounter", enc.id);
  res.json(enc);
});

function num(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
