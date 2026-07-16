// Express 4 does not catch rejections from async handlers — an unhandled
// rejection takes the whole process down. Wrap every async route with this.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Retry a create that derives a human-readable sequential number, so a
// unique-constraint collision (concurrent inserts) retries instead of crashing.
export async function withNumberRetry(makeNumber, create, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await create(await makeNumber(i));
    } catch (e) {
      if (e?.code !== "P2002") throw e; // not a uniqueness collision
      lastErr = e;
    }
  }
  throw lastErr;
}
