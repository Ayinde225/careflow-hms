# CareFlow — Hospital Management System

A full-stack hospital management system that digitalizes the running of a hospital, built **module by module along one patient's journey**. Phase 0 (foundation), the **Front Desk / Reception** seat, and the **Clinician** seat are complete and working end to end.

Realism is anchored on **Conway Regional Health System**, which runs on **Epic / MyChart** — so CareFlow mirrors real workflows: **MRN**-based patient records, **eCheck-In**, appointment scheduling, a live reception queue, and **PatientWallet**-style copay collection.

> ⚕️ **Synthetic data only** — no real patient information. Designed with a HIPAA-aware posture (role-based access, audit logging, session expiry).

## ✨ What works today (Front Desk)

- 🔐 **Auth + role-based access** (JWT) — admin / receptionist / doctor seats
- 🗓️ **Reception dashboard** — today's appointment board, live status flow, KPI tiles
- 👤 **Patient registration** with auto-generated **MRN** (`CRW-YYYY-NNNNNN`) + insurance capture
- 🔎 **Patient search** by name, MRN or phone
- 📅 **Scheduling** — provider availability → open-slot booking
- ✅ **Check-in** → creates a clinical **Encounter** and drops the patient into the waiting-room queue
- 💳 **Copay collection** (PatientWallet-style)
- 🧾 **Audit log** written on every mutation

### Clinician seat (Phase 2)

- 🩺 **Clinical queue** — checked-in patients waiting to be seen
- 📋 **Encounter chart** with a patient banner (allergies flagged)
- ❤️ **Vitals** (BP, HR, temp, RR, weight, height)
- 📝 **SOAP clinical note** (subjective / objective / assessment / plan)
- 🏷️ **ICD-10 diagnoses** with a code picker (primary/secondary)
- 🧪 **Orders** — labs & imaging, with mock resulting
- 💊 **e-Prescribing** — medication, dose, frequency, quantity, refills
- ✅ **Complete visit** → closes the encounter, marks the appointment done

## 🧱 Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18 + Vite, React Router |
| Backend | Node + Express |
| Database | Prisma ORM — **SQLite** for local dev (swap `provider` to `postgresql` for production) |
| Auth | JWT + bcrypt, role-based middleware |

Monorepo: `client/` (receptionist workspace) · `server/` (REST API + Prisma).

## 🚀 Run it locally

**1. API**
```bash
cd server
cp .env.example .env
npm install
npx prisma db push     # create the SQLite schema
npm run db:seed        # demo data + accounts
npm run dev            # http://localhost:4100
```

**2. Client** (new terminal)
```bash
cd client
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

### Demo logins
| Role | Email | Password |
|---|---|---|
| Receptionist | `reception@careflow.dev` | `reception123` |
| Admin | `admin@careflow.dev` | `admin123` |
| Doctor | `dr.hart@careflow.dev` | `doctor123` |

## 🗺️ Roadmap (the patient journey continues)

- ✅ **Phase 2 — Clinician:** EHR notes, ICD-10 diagnoses, lab/imaging orders, e-prescribing *(done)*
- **Phase 3 — Patient portal (MyChart-style):** results, messaging, After Visit Summary
- **Phase 4 — Pharmacy & inventory**
- **Phase 5 — Billing & insurance claims + revenue analytics**
- **Phase 6 — Admin analytics, bed & OR management, full audit**

See [`docs/PHASE-0-FRONT-DESK-SPEC.md`](docs/PHASE-0-FRONT-DESK-SPEC.md) for the full blueprint.

## 📌 Notes

- Local dev uses SQLite + JavaScript for zero-friction startup. Planned upgrades: **PostgreSQL**, **TypeScript** end-to-end, and TanStack Query.
- Not affiliated with Conway Regional or Epic; used only as real-world design references.

---

**Author:** Ayinde Abdul Aziz — [@Ayinde225](https://github.com/Ayinde225)
