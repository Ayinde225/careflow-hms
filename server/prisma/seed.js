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
  await prisma.message.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.order.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.clinicalNote.deleteMany();
  await prisma.vitals.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.charge.deleteMany();
  await prisma.invoice.deleteMany();
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
  await prisma.user.create({
    data: { email: "billing@careflow.dev", passwordHash: hash("billing123"), role: "billing", fullName: "Bella Billing" },
  });
  const drUser = await prisma.user.create({
    data: { email: "dr.hart@careflow.dev", passwordHash: hash("doctor123"), role: "doctor", fullName: "Dr. Alicia Hart" },
  });

  // Patient portal accounts (linked to patient records below)
  const uJordan = await prisma.user.create({ data: { email: "jordan@careflow.dev", passwordHash: hash("patient123"), role: "patient", fullName: "Jordan Miles" } });
  const uPriya = await prisma.user.create({ data: { email: "priya@careflow.dev", passwordHash: hash("patient123"), role: "patient", fullName: "Priya Nair" } });
  const uSam = await prisma.user.create({ data: { email: "sam@careflow.dev", passwordHash: hash("patient123"), role: "patient", fullName: "Sam Carter" } });

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
      userId: uJordan.id,
      phone: "501-555-0142", email: "jordan.miles@example.com", address: "22 Oak St, Conway, AR",
      insurance: { create: { payerName: "Blue Cross Blue Shield", memberId: "BCBS884210", groupNumber: "GRP-102", planType: "PPO", copayAmount: 30, isPrimary: true, verificationStatus: "Verified" } },
      allergies: { create: [{ substance: "Penicillin", reaction: "Hives", severity: "Moderate" }] },
      medications: { create: [{ name: "Lisinopril", dose: "10mg", frequency: "Daily" }] },
    },
  });
  const priya = await prisma.patient.create({
    data: {
      mrn: mk(2), firstName: "Priya", lastName: "Nair", dob: new Date("1985-11-03"), sex: "Female",
      userId: uPriya.id,
      phone: "501-555-0177", email: "priya.nair@example.com", address: "8 Elm Ave, Conway, AR",
      insurance: { create: { payerName: "Aetna", memberId: "AET551903", planType: "HMO", copayAmount: 25, isPrimary: true, verificationStatus: "Unverified" } },
    },
  });
  const sam = await prisma.patient.create({
    data: {
      mrn: mk(3), firstName: "Sam", lastName: "Carter", dob: new Date("2015-06-21"), sex: "Male",
      userId: uSam.id,
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

  // --- A completed past visit for Jordan (populates his patient portal) ---
  const pastDay = new Date(); pastDay.setDate(pastDay.getDate() - 14); pastDay.setHours(10, 0, 0, 0);
  const pastAppt = await prisma.appointment.create({
    data: {
      patientId: jordan.id, providerId: providers[0].id, departmentId: familyMed.id,
      startAt: pastDay, endAt: new Date(pastDay.getTime() + 30 * 60000),
      reason: "Follow-up: blood pressure", status: "Completed", createdByUserId: reception.id,
    },
  });
  const pastEnc = await prisma.encounter.create({
    data: { appointmentId: pastAppt.id, patientId: jordan.id, type: "Office Visit", status: "Closed", checkInAt: pastDay },
  });
  await prisma.vitals.create({ data: { encounterId: pastEnc.id, systolic: 138, diastolic: 88, heartRate: 76, temperatureF: 98.4, respiratoryRate: 15, weightKg: 82, recordedByUserId: drUser.id } });
  await prisma.clinicalNote.create({ data: { encounterId: pastEnc.id, subjective: "Follow-up for elevated blood pressure. Feeling well.", objective: "BP mildly elevated at 138/88.", assessment: "Hypertension, controlled with lifestyle.", plan: "Continue Lisinopril. Recheck lipids. Follow up in 3 months.", authorUserId: drUser.id } });
  await prisma.diagnosis.create({ data: { encounterId: pastEnc.id, icd10Code: "I10", description: "Essential (primary) hypertension", isPrimary: true } });
  await prisma.order.create({ data: { encounterId: pastEnc.id, type: "Lab", name: "Lipid Panel", status: "Resulted", resultText: "Total cholesterol 195 mg/dL, LDL 118 (borderline), HDL 52, Triglycerides 140.", orderedByUserId: drUser.id } });
  await prisma.order.create({ data: { encounterId: pastEnc.id, type: "Lab", name: "Basic Metabolic Panel (BMP)", status: "Resulted", resultText: "All values within normal limits.", orderedByUserId: drUser.id } });
  await prisma.prescription.create({ data: { encounterId: pastEnc.id, patientId: jordan.id, drugName: "Lisinopril", dose: "10 mg", frequency: "Daily", quantity: 90, refills: 3, instructions: "Take one tablet by mouth daily.", prescribedByUserId: drUser.id } });
  await prisma.payment.create({ data: { patientId: jordan.id, encounterId: pastEnc.id, amount: 30, type: "Copay", method: "Card", status: "Paid", createdAt: pastDay } });
  await prisma.message.create({ data: { patientId: jordan.id, sender: "CareTeam", body: "Hi Jordan, your recent lab results are available in your portal. Your LDL is slightly elevated — let's discuss diet at your next visit. — Dr. Hart's office" } });

  // --- Billing: a fully adjudicated invoice for Jordan's past visit (populates revenue analytics) ---
  const inv = await prisma.invoice.create({
    data: {
      number: `INV-${year}-0001`, patientId: jordan.id, encounterId: pastEnc.id, status: "Claimed",
      charges: { create: [
        { cptCode: "99213", description: "Office/outpatient visit, established patient", amount: 150 },
        { cptCode: "80061", description: "Lipid panel", amount: 65 },
        { cptCode: "80048", description: "Basic metabolic panel", amount: 40 },
      ] },
    },
  });
  // Billed 255, verified BCBS PPO, copay 30 → allowed 178.50, insurance pays 148.50, patient owes 30
  await prisma.claim.create({
    data: { invoiceId: inv.id, patientId: jordan.id, payerName: "Blue Cross Blue Shield", claimNumber: `CLM-${year}-00001`, status: "Paid", billedAmount: 255, allowedAmount: 178.5, insurancePaid: 148.5, patientResponsibility: 30 },
  });
  await prisma.payment.create({ data: { patientId: jordan.id, invoiceId: inv.id, amount: 148.5, type: "Bill", method: "EFT", source: "Insurance", status: "Paid" } });
  // The $30 copay Jordan paid at check-in credits against this invoice (as the app now does
  // at invoice generation) — otherwise he'd be billed for the same $30 twice.
  await prisma.payment.updateMany({ where: { encounterId: pastEnc.id, invoiceId: null }, data: { invoiceId: inv.id } });
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "Paid" } });

  // --- An unbilled completed visit for Priya (for the billing workspace demo) ---
  const pDay = new Date(); pDay.setDate(pDay.getDate() - 7); pDay.setHours(11, 0, 0, 0);
  const pAppt = await prisma.appointment.create({
    data: { patientId: priya.id, providerId: providers[1].id, departmentId: cardiology.id, startAt: pDay, endAt: new Date(pDay.getTime() + 30 * 60000), reason: "Chest pain evaluation", status: "Completed", createdByUserId: reception.id },
  });
  const pEnc = await prisma.encounter.create({ data: { appointmentId: pAppt.id, patientId: priya.id, type: "Office Visit", status: "Closed", checkInAt: pDay } });
  await prisma.diagnosis.create({ data: { encounterId: pEnc.id, icd10Code: "R07.9", description: "Chest pain, unspecified", isPrimary: true } });
  await prisma.order.create({ data: { encounterId: pEnc.id, type: "Imaging", name: "Electrocardiogram (ECG)", status: "Resulted", resultText: "Normal sinus rhythm.", orderedByUserId: drUser.id } });
  await prisma.order.create({ data: { encounterId: pEnc.id, type: "Lab", name: "Lipid Panel", status: "Resulted", resultText: "Within normal limits.", orderedByUserId: drUser.id } });

  console.log("Done. Demo logins:");
  console.log("  admin@careflow.dev / admin123");
  console.log("  reception@careflow.dev / reception123");
  console.log("  dr.hart@careflow.dev / doctor123");
  console.log("  jordan@careflow.dev / patient123  (patient portal)");
  console.log("  billing@careflow.dev / billing123  (revenue cycle)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
