import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.fullName },
    SECRET,
    { expiresIn: "8h" }
  );
}

// Attach req.user from the Bearer token, or 401.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Restrict a route to specific roles (admin always allowed).
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (req.user.role === "admin" || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: "Forbidden for role " + req.user.role });
  };
}
