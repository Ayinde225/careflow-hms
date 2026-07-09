import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

export const schedulingRouter = Router();
schedulingRouter.use(requireAuth);

schedulingRouter.get("/departments", async (_req, res) => {
  res.json(await prisma.department.findMany({ orderBy: { name: "asc" } }));
});

schedulingRouter.get("/providers", async (req, res) => {
  const where = req.query.departmentId ? { departmentId: req.query.departmentId.toString() } : {};
  res.json(
    await prisma.provider.findMany({ where, include: { department: true }, orderBy: { fullName: "asc" } })
  );
});

// Compute open slots for a provider on a given date from their weekly availability,
// minus already-booked appointments.
schedulingRouter.get("/providers/:id/slots", async (req, res) => {
  const dateStr = (req.query.date || "").toString();
  if (!dateStr) return res.status(400).json({ error: "date query (YYYY-MM-DD) required" });
  const date = new Date(dateStr + "T00:00:00");
  const dow = date.getDay();

  const rules = await prisma.providerAvailability.findMany({
    where: { providerId: req.params.id, dayOfWeek: dow },
  });

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  const booked = await prisma.appointment.findMany({
    where: {
      providerId: req.params.id,
      startAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["Cancelled", "NoShow"] },
    },
    select: { startAt: true },
  });
  const takenIso = new Set(booked.map((b) => b.startAt.toISOString()));

  const slots = [];
  for (const rule of rules) {
    const [sh, sm] = rule.startTime.split(":").map(Number);
    const [eh, em] = rule.endTime.split(":").map(Number);
    const cursor = new Date(date); cursor.setHours(sh, sm, 0, 0);
    const end = new Date(date); end.setHours(eh, em, 0, 0);
    while (cursor < end) {
      const iso = cursor.toISOString();
      if (!takenIso.has(iso)) slots.push({ start: iso, minutes: rule.slotMinutes });
      cursor.setMinutes(cursor.getMinutes() + rule.slotMinutes);
    }
  }
  slots.sort((a, b) => a.start.localeCompare(b.start));
  res.json(slots);
});
