import { prisma } from "./db.js";

// Write a compliance audit entry for every mutation. Never throws into the request path.
export async function audit(req, action, entityType, entityId, metadata) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: req.user?.id ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (e) {
    console.error("audit failed:", e.message);
  }
}
