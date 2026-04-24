export const APPROVAL_THRESHOLD_CENTS = 500_000;

export function requiresApproval(amountCents: number): boolean {
  return amountCents >= APPROVAL_THRESHOLD_CENTS;
}
