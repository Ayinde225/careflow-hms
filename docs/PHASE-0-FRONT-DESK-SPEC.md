# CareFlow HMS — Phase 0 + Front-Desk Spec

> Working title: **CareFlow** (placeholder — rename freely).
> A full-stack hospital management system that digitalizes the entire running of a hospital,
> built **module by module along one patient's journey**. This document covers the **foundation (Phase 0)**
> and the **first seat: Front Desk / Reception**.
>
> Realism is anchored on **Conway Regional Health System**, which runs on **Epic / MyChart** (eCheck-In,
> PatientWallet billing, MRN-based records). We mirror Epic's terminology and flows so the product reads as real.

---

## 1. Vision & guiding principles

- **The spine:** everything is organized around *one patient moving through every module*. Front Desk is the entry gate.
- **Integration over count:** the magic is that data flows — a booked appointment becomes an encounter, a copay becomes a payment, every action becomes an audit entry.
- **Faithful to Epic/MyChart:** MRN identifiers, "eCheck-In", "Encounter", "Provider", "After Visit Summary", PatientWallet-style billing.
- **Synthetic data only:** never real PHI. Design with HIPAA posture (RBAC, audit log, session timeout) as a talking point.
- **Demoable at every phase:** a recruiter can log in with seeded accounts and click through a real workflow.

---

## 2. Architecture

**Shape:** monorepo with two apps + shared types.

```
careflow-hms/
├─ client/        # React 18 + Vite (receptionist workspace UI)
├─ server/        # Node + Express API
├─ prisma/        # schema + migrations + seed
├─ shared/        # shared Zod schemas & TypeScript types
└─ docs/          # this spec + later-phase specs
```

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite**, React Router, **TanStack Query**, Tailwind CSS, React Hook Form + **Zod**, Recharts | Fast, modern, matches your existing stack; Query handles server state cleanly |
| Backend | **Node + Express** (NestJS optional later) | Approachable; clean REST |
| Language | **TypeScript** end-to-end (recommended) | Your stated "leveling up" goal; Prisma + Zod + Query shine in TS. *JS is fine to start if TS slows momentum.* |
| Database | **PostgreSQL + Prisma ORM** | Hospital data is deeply relational; Prisma makes the schema/migrations look sharp |
| Auth | **JWT** (access + refresh), **bcrypt**, RBAC middleware | Industry-standard; RBAC is what makes an HMS feel real |
| Validation | **Zod** (shared client + server schemas) | One source of truth for shapes |
| Testing | **Vitest** (unit) + **Supertest** (API) | Consistent with your other repos |
| Hosting ($0 tiers) | Client → **Vercel**; API → **Render/Railway**; DB → **Neon/Supabase** | Free full-stack hosting (Pages can't run a backend) |

---

## 3. Roles & access (RBAC)

Full system roles: `admin`, `receptionist`, `nurse`, `doctor`, `pharmacist`, `lab_tech`, `billing`, `patient`.

**Phase 0 + Front Desk seeds:** `admin`, `receptionist`, a few `doctor` providers, and sample `patient` records.
Every API route is guarded by role. Receptionist can: manage patients, insurance, scheduling, check-in, copay — **not** clinical notes or prescriptions.

---

## 4. Data model (Phase 0 + Front Desk)

Core entities (Prisma-style, abbreviated):

- **User** — `id, email, passwordHash, role, fullName, isActive`
- **Patient** — `id, mrn (unique), firstName, lastName, dob, sex, phone, email, address, preferredLanguage, createdAt`
- **InsurancePolicy** — `id, patientId, payerName, memberId, groupNumber, planType, copayAmount, effectiveDate, isPrimary, verificationStatus[Unverified|Verified|Inactive]`
- **Allergy** — `id, patientId, substance, reaction, severity`
- **Medication** — `id, patientId, name, dose, frequency, isActive`
- **Department** — `id, name`
- **Provider** — `id, userId?, fullName, specialty, departmentId`
- **ProviderAvailability** — `id, providerId, dayOfWeek, startTime, endTime, slotMinutes`
- **Appointment** — `id, patientId, providerId, departmentId, startAt, endAt, reason, status[Scheduled|CheckedIn|Roomed|Completed|Cancelled|NoShow], createdByUserId`
- **Encounter** — `id, appointmentId, patientId, type, status, checkInAt, roomedAt` (created at check-in — the clinical "container" the next phases fill)
- **ConsentDocument** — `id, patientId, encounterId, type[HIPAA|Financial|TreatmentConsent], signedAt, signatureSvg`
- **QuestionnaireResponse** — `id, encounterId, answers(json)`
- **Payment** — `id, patientId, encounterId?, amount, type[Copay|Bill], method[Card|Cash], status, createdAt`
- **AuditLog** — `id, actorUserId, action, entityType, entityId, at, metadata(json)` ← compliance backbone; written on every mutation

**MRN generation:** zero-padded sequential or `CRW-{year}-{seq}` to feel institutional.

---

## 5. Front-Desk screens

1. **Login** — role-aware redirect; session-timeout banner (mirrors Epic).
2. **Reception Dashboard** — today's board with status columns (Scheduled → Checked-in → Roomed), KPI tiles (arrivals, waiting, no-shows, copays collected), global patient search.
3. **Patient Search / Register** — search by name/DOB/MRN; **New Patient** form → auto-MRN.
4. **Patient Summary panel** — demographics, insurance card, allergy/med flags, balance.
5. **eCheck-In wizard** (multi-step) — demographics → insurance → meds/allergies reconcile → questionnaire → **e-signature consent**.
6. **Scheduling calendar** — provider × time-slot grid from availability; book/reschedule/cancel modal.
7. **Check-in + Queue board** — one click drops the patient into the live waiting room.
8. **Copay collection modal** — PatientWallet-style; creates a Payment; supports a payment-plan stub.

---

## 6. Representative API (REST)

```
POST   /auth/login                 POST /auth/refresh
GET    /patients?q=                 POST /patients            GET /patients/:id   PATCH /patients/:id
POST   /patients/:id/insurance      POST /insurance/:id/verify   (mocked eligibility)
GET    /departments                 GET  /providers
GET    /providers/:id/slots?date=   (computed from availability)
POST   /appointments                PATCH /appointments/:id/status
POST   /appointments/:id/check-in   (creates Encounter, status→CheckedIn)
POST   /encounters/:id/consent      POST /encounters/:id/questionnaire
POST   /payments                    (copay / bill)
GET    /audit?entity=               (admin/read)
```

All mutations write an **AuditLog** row. All inputs validated with shared **Zod** schemas.

---

## 7. Build order

**Phase 0 — Foundation**
- 0.1 Monorepo scaffold, tooling, lint/format, CI (build + test)
- 0.2 Prisma schema + migrations + seed script
- 0.3 Auth (JWT + refresh, bcrypt) + RBAC middleware
- 0.4 App shell: login, role-based routing, layout, session timeout

**Front Desk**
- FD.1 Patient register + search + MRN
- FD.2 Insurance capture + mocked eligibility verify
- FD.3 Departments/providers + availability + scheduling calendar
- FD.4 Appointment booking + status transitions
- FD.5 Check-in → Encounter + live queue board + dashboard KPIs
- FD.6 eCheck-In wizard (demographics/insurance/meds/allergies/questionnaire/consent e-sign)
- FD.7 Copay payment + PatientWallet-style balance
- FD.8 Seed rich demo data + demo accounts + unit/API tests

---

## 8. Definition of Done (this phase)

A **receptionist** can log in and:
1. Register a new patient (MRN auto-generated) or find an existing one.
2. Capture & "verify" insurance.
3. Book an appointment against a provider's real availability.
4. Run the patient through **eCheck-In** (info, meds/allergies, questionnaire, signed consent).
5. **Check the patient in** → they appear on the live queue board.
6. Collect a **copay** → recorded as a payment against the encounter.
7. Every action is **audit-logged**; demo accounts + seeded data ship with it.

Deployed: client on Vercel, API on Render/Railway, DB on Neon — with a public demo login.

---

## 9. Security & compliance posture (talking points)

- RBAC on every route; least privilege per seat
- JWT expiry + refresh; **idle session timeout** (mirrors Epic)
- **Audit log** of every access/mutation
- Zod input validation; bcrypt password hashing
- **Synthetic data only** — no real PHI; note HIPAA/GDPR-aware design in the README

---

## 10. What comes after (journey continues)

- **Phase 2 — Clinician seat:** EHR notes, diagnoses (ICD-10), orders (labs/imaging), e-prescribing → the Encounter created at check-in gets filled in.
- **Phase 3 — Patient portal (MyChart-style):** results, messaging, appointments, After Visit Summary.
- **Phase 4 — Pharmacy & inventory** · **Phase 5 — Billing & insurance claims + revenue analytics** (your finance signature) · **Phase 6 — Admin analytics, bed/OR management, audit.**

---

*Anchored on Conway Regional Health System (Epic/MyChart, eCheck-In, PatientWallet). Author: Ayinde Abdul Aziz — @Ayinde225.*
