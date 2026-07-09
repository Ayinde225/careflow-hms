import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function at(hour, min = 0) {
  const d = new Date();
  d.setHours(hour, min, 0, 0);
  return d;
}

async function main() {
  console.log("Seeding CareFlow demo data...");

  // Clean (order matters for FKs)
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.questionnaireResponse.deleteMany();
  await prisma.consentDocument.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.providerAvailability.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.department.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.allergy.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // --- Users / demo accounts ---
  const admin = await prisma.user.create({
    data: { email: "admin@careflow.dev", passwordHash: hash("admin123"), role: "admin", fullName: "System Admin" },
  });
  const reception = await prisma.user.create({
    data: { email: "reception@careflow.dev", passwordHash: hash("reception123"), role: "receptionist", fullName: "Rita Reception" },
  });
  const drUser = await prisma.user.create({
    data: { email: "dr.hart@careflow.dev", passwordHash: hash("doctor123"), role: "doctor", fullName: "Dr. Alicia Hart" },
  });

  // --- Departments & providers ---
  const familyMed = await prisma.department.create({ data: { name: "Family Medicine" } });
  const cardiology = await prisma.department.create({ data: { name: "Cardiology" } });
  const pediatrics = await prisma.department.create({ data: { name: "Pediatrics" } });

  const providers = await Promise.all([
    prisma.provider.create({ data: { userId: drUser.id, fullName: "Dr. Alicia Hart", specialty: "Family Medicine", departmentId: familyMed.id } }),
    prisma.provider.create({ data: { fullName: "Dr. Marcus Bell", specialty: "Cardiology", departmentId: cardiology.id } }),
    prisma.provider.create({ data: { fullName: "Dr. Nadia Okoro", specialty: "Pediatrics", departmentId: pediatrics.id } }),
  ]);

  // Availability: Mon–Fri 08:00–16:00, 30-min slots
  for (const p of providers) {
    for (let dow = 1; dow <= 5; dow++) {
      await prisma.providerAvailability.create({
        data: { providerId: p.id, dayOfWeek: dow, startTime: "08:00", endTime: "16:00", slotMinutes: 30 },
      });
    }
  }

  // --- Patients ---
  const year = new Date().getFullYear();
  const mk = (n) => `CRW-${year}-${String(n).padStart(6, "0")}`;

  const jordan = await prisma.patient.create({
    data: {
      mrn: mk(1), firstName: "Jordan", lastName: "Miles", dob: new Date("1990-04-12"), sex: "Male",
      phone: "501-555-0142", email: "jordan.miles@example.com", address: "22 Oak St, Conway, AR",
      insurance: { create: { payerName: "Blue Cross Blue Shield", memberId: "BCBS884210", groupNumber: "GRP-102", planType: "PPO", copayAmount: 30, isPrimary: true, verificationStatus: "Verified" } },
      allergies: { create: [{ substance: "Penicillin", reaction: "Hives", severity: "Moderate" }] },
      medications: { create: [{ name: "Lisinopril", dose: "10mg", frequency: "Daily" }] },
    },
  });
  const priya = await prisma.patient.create({
    data: {
      mrn: mk(2), firstName: "Priya", lastName: "Nair", dob: new Date("1985-11-03"), sex: "Female",
      phone: "501-555-0177", email: "priya.nair@example.com", address: "8 Elm Ave, Conway, AR",
      insurance: { create: { payerName: "Aetna", memberId: "AET551903", planType: "HMO", copayAmount: 25, isPrimary: true, verificationStatus: "Unverified" } },
    },
  });
  const sam = await prisma.patient.create({
    data: {
      mrn: mk(3), firstName: "Sam", lastName: "Carter", dob: new Date("2015-06-21"), sex: "Male",
      phone: "501-555-0199", address: "14 Pine Rd, Conway, AR",
      insurance: { create: { payerName: "UnitedHealthcare", memberId: "UHC220145", planType: "PPO", copayAmount: 20, isPrimary: true, verificationStatus: "Verified" } },
    },
  });

  // --- Today's appointments (populates the reception board) ---
  const a1 = await prisma.appointment.create({
    data: { patientId: jordan.id, providerId: providers[0].id, departmentId: familyMed.id, startAt: at(9, 0), endAt: at(9, 30), reason: "Annual physical", status: "Scheduled", createdByUserId: reception.id },
  });
  await prisma.appointment.create({
    data: { patientId: priya.id, providerId: providers[1].id, departmentId: cardiology.id, startAt: at(10, 30), endAt: at(11, 0), reason: "Chest pain follow-up", status: "Scheduled", createdByUserId: reception.id },
  });
  await prisma.appointment.create({
    data: { patientId: sam.id, providerId: providers[2].id, departmentId: pediatrics.id, startAt: at(13, 0), endAt: at(13, 30), reason: "Well-child visit", status: "Scheduled", createdByUserId: reception.id },
  });

  console.log("Done. Demo logins:");
  console.log("  admin@careflow.dev / admin123");
  console.log("  reception@careflow.dev / reception123");
  console.log("  dr.hart@careflow.dev / doctor123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
