import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { signToken, requireAuth } from "../auth.js";
import { audit } from "../audit.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  await audit(req, "login", "User", user.id);
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});
