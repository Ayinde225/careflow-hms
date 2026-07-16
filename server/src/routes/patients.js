import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { audit } from "../audit.js";

export const patientsRouter = Router();

const FRONT_DESK = ["receptionist", "nurse", "doctor", "billing"];

// Staff-only: patients must never reach the roster or another patient's chart.
// (Patients get their own self-scoped data from /api/portal.)
patientsRouter.use(requireAuth);
patientsRouter.use(requireRole(...FRONT_DESK));

// Generate an institutional-looking MRN: CRW-YYYY-000123
async function nextMrn() {
  const year = new Date().getFullYear();
  const count = await prisma.patient.count();
  return `CRW-${year}-${String(count + 1).padStart(6, "0")}`;
}

// Search / list
patientsRouter.get("/", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  const where = q
    ? {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { mrn: { contains: q } },
          { phone: { contains: q } },
        ],
      }
    : {};
  const patients = await prisma.patient.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { insurance: true },
  });
  res.json(patients);
});

// Full record
patientsRouter.get("/:id", async (req, res) => {
  const patient = await prisma.patient.findUnique({
    where: { id: req.params.id },
    include: {
      insurance: true,
      allergies: true,
      medications: true,
      appointments: { include: { provider: true, department: true }, orderBy: { startAt: "desc" } },
      payments: true,
    },
  });
  if (!patient) return res.status(404).json({ error: "Not found" });
  res.json(patient);
});

// Register a new patient (auto-MRN)
patientsRouter.post("/", requireRole(...FRONT_DESK), async (req, res) => {
  const { firstName, lastName, dob, sex, phone, email, address, preferredLanguage, insurance } = req.body || {};
  if (!firstName || !lastName || !dob || !sex)
    return res.status(400).json({ error: "firstName, lastName, dob, sex are required" });

  const mrn = await nextMrn();
  const patient = await prisma.patient.create({
    data: {
      mrn,
      firstName,
      lastName,
      dob: new Date(dob),
      sex,
      phone,
      email,
      address,
      preferredLanguage: preferredLanguage || "English",
      insurance: insurance?.payerName
        ? {
            create: {
              payerName: insurance.payerName,
              memberId: insurance.memberId || "",
              groupNumber: insurance.groupNumber,
              planType: insurance.planType,
              copayAmount: Number(insurance.copayAmount) || 0,
              isPrimary: true,
            },
          }
        : undefined,
    },
    include: { insurance: true },
  });
  await audit(req, "create", "Patient", patient.id, { mrn });
  res.status(201).json(patient);
});

// Add/verify insurance
patientsRouter.post("/:id/insurance/verify", requireRole(...FRONT_DESK), async (req, res) => {
  const policy = await prisma.insurancePolicy.findFirst({ where: { patientId: req.params.id } });
  if (!policy) return res.status(404).json({ error: "No insurance on file" });
  const updated = await prisma.insurancePolicy.update({
    where: { id: policy.id },
    data: { verificationStatus: "Verified" },
  });
  await audit(req, "verify", "InsurancePolicy", policy.id);
  res.json(updated);
});
