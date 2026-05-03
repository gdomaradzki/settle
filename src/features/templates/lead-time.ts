import type { PaymentMethod } from "@/generated/prisma/enums";

// Calendar-day lead time between bill generation and the vendor's pay date.
// Mirrors Ramp Bill Pay: ACH settles in ~2 business days but the bill is
// created and routed for approval 10 days ahead; checks need 15 days.
export const LEAD_DAYS_BY_METHOD: Record<PaymentMethod, number> = {
  ACH: 10,
  CHECK: 15,
};

export function leadDaysFor(method: PaymentMethod): number {
  return LEAD_DAYS_BY_METHOD[method];
}

export function addUtcDays(d: Date, n: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n),
  );
}
