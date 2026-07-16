import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";

export const appointmentsRouter = Router();

const FRONT_DESK = ["receptionist", "nurse", "doctor", "billing"];
const STATUSES = ["Scheduled", "CheckedIn", "Roomed", "Completed", "Cancelled", "NoShow"];

// Staff-only: the schedule embeds full patient records.
// (Patients read their own appointments via /api/portal/appointments.)
appointmentsRouter.use(requireAuth);
appointmentsRouter.use(requireRole(...FRONT_DESK));

// List appointments (optionally for a specific day) — powers the reception board.
appointmentsRouter.get("/", async (req, res) => {
  const where = {};
  if (req.query.date) {
    const d = new Date(req.query.date.toString() + "T00:00:00");
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    where.startAt = { gte: start, lte: end };
  }
  const appts = await prisma.appointment.findMany({
    where,
    include: { patient: true, provider: true, department: true, encounter: true },
    orderBy: { startAt: "asc" },
  });
  res.json(appts);
});

// Book
appointmentsRouter.post("/", requireRole(...FRONT_DESK), async (req, res) => {
  const { patientId, providerId, startAt, minutes, reason } = req.body || {};
  if (!patientId || !providerId || !startAt)
    return res.status(400).json({ error: "patientId, providerId, startAt required" });

  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  const start = new Date(startAt);
  const end = new Date(start.getTime() + (Number(minutes) || 30) * 60000);

  const appt = await prisma.appointment.create({
    data: {
      patientId,
      providerId,
      departmentId: provider.departmentId,
      startAt: start,
      endAt: end,
      reason,
      status: "Scheduled",
      createdByUserId: req.user.id,
    },
    include: { patient: true, provider: true, department: true },
  });
  await audit(req, "create", "Appointment", appt.id, { patientId, providerId });
  res.status(201).json(appt);
});

// Change status (cancel, no-show, room, complete)
appointmentsRouter.patch("/:id/status", requireRole(...FRONT_DESK), async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
  const appt = await prisma.appointment.update({
    where: { id: req.params.id },
    data: { status, ...(status === "Roomed" ? {} : {}) },
    include: { patient: true, provider: true, encounter: true },
  });
  if (status === "Roomed" && appt.encounter) {
    await prisma.encounter.update({ where: { id: appt.encounter.id }, data: { roomedAt: new Date() } });
  }
  await audit(req, "status", "Appointment", appt.id, { status });
  res.json(appt);
});

// Check-in → create the Encounter and flip status
appointmentsRouter.post("/:id/check-in", requireRole(...FRONT_DESK), async (req, res) => {
  const appt = await prisma.appointment.findUnique({ where: { id: req.params.id }, include: { encounter: true } });
  if (!appt) return res.status(404).json({ error: "Not found" });
  if (appt.encounter) return res.status(409).json({ error: "Already checked in" });

  const encounter = await prisma.encounter.create({
    data: { appointmentId: appt.id, patientId: appt.patientId, type: "Office Visit", status: "Open" },
  });
  await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CheckedIn" } });
  await audit(req, "check-in", "Appointment", appt.id, { encounterId: encounter.id });
  res.status(201).json({ ...appt, status: "CheckedIn", encounter });
});
