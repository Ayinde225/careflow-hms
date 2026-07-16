// Single source of truth for invoice money math + status.
// Used by billing (staff) and portal (patient) so the two can never disagree.

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Roll up an invoice. Requires `charges`, `claim` and `payments` to be included.
 *
 * Reconciliation identity (holds in every state):
 *   billed === contractualAdj + insurancePaid + patientPaid + balance
 */
export function summarizeInvoice(inv) {
  const charges = inv.charges ?? [];
  const payments = inv.payments ?? [];
  const claim = inv.claim ?? null;

  const billed = round2(charges.reduce((s, c) => s + c.amount * c.quantity, 0));
  // Only the patient's own money reduces what the patient owes.
  const patientPaid = round2(payments.filter((p) => p.source === "Patient").reduce((s, p) => s + p.amount, 0));

  const claimPaid = claim?.status === "Paid";
  const insurancePaid = claimPaid ? round2(claim.insurancePaid) : 0;
  const contractualAdj = claimPaid ? round2(billed - claim.allowedAmount) : 0;

  // No claim yet -> self-pay, patient owes the full billed amount.
  // Claim denied  -> payer pays nothing, full amount falls to the patient.
  const patientResponsibility = claim
    ? (claim.status === "Denied" ? billed : round2(claim.patientResponsibility))
    : billed;

  const balance = round2(patientResponsibility - patientPaid);
  return { billed, insurancePaid, contractualAdj, patientResponsibility, patientPaid, balance };
}

/** Derive invoice status from the money — never from the claim outcome alone. */
export function deriveStatus(inv, s = summarizeInvoice(inv)) {
  if (s.billed === 0) return "Open";
  if (s.balance <= 0) return "Paid";
  if (s.patientPaid > 0) return "PartiallyPaid";
  if (inv.claim) return inv.claim.status === "Denied" ? "Denied" : "Claimed";
  return "Open";
}
