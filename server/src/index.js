import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { patientsRouter } from "./routes/patients.js";
import { schedulingRouter } from "./routes/scheduling.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { paymentsRouter } from "./routes/payments.js";
import { clinicalRouter } from "./routes/clinical.js";
import { portalRouter } from "./routes/portal.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "careflow-api" }));

app.use("/api/auth", authRouter);
app.use("/api/patients", patientsRouter);
app.use("/api/scheduling", schedulingRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/clinical", clinicalRouter);
app.use("/api/portal", portalRouter);

// Fallback error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`CareFlow API on http://localhost:${PORT}`));
