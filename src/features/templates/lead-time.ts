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

export type UpcomingOccurrence = {
  payDate: Date;
  generationDate: Date;
  isLast: boolean;
};

type UpcomingInputs = {
  paymentDayOfMonth: number;
  endsAt: Date | null;
  maxOccurrences: number | null;
  cancelledAt: Date | null;
  vendor: { paymentMethod: PaymentMethod };
};

// Compute the next N pay dates for a template, skipping any pay date that
// already has a generated bill (passed in as `existingPayDates`). Returns
// an empty array for cancelled templates or when the series is exhausted.
export function computeUpcomingOccurrences(
  template: UpcomingInputs,
  pastBillCount: number,
  existingPayDates: Date[],
  fromDate: Date,
  count: number,
): UpcomingOccurrence[] {
  if (template.cancelledAt) return [];

  const remainingByMax =
    template.maxOccurrences !== null
      ? Math.max(0, template.maxOccurrences - pastBillCount)
      : Infinity;
  if (remainingByMax === 0) return [];

  const leadDays = LEAD_DAYS_BY_METHOD[template.vendor.paymentMethod];
  const existingTimes = new Set(existingPayDates.map((d) => d.getTime()));
  const targetCount = Math.min(count, remainingByMax);
  const result: UpcomingOccurrence[] = [];

  // Start from the month containing fromDate and walk forward.
  let year = fromDate.getUTCFullYear();
  let month = fromDate.getUTCMonth();
  // Hard cap so a finite-loop guarantee exists if maxOccurrences and endsAt
  // are both null.
  const maxIterations = 24 * 12; // 24 years
  let iterations = 0;

  while (result.length < targetCount && iterations < maxIterations) {
    iterations++;
    const payDate = new Date(
      Date.UTC(year, month, template.paymentDayOfMonth),
    );

    if (payDate >= fromDate && !existingTimes.has(payDate.getTime())) {
      if (template.endsAt !== null && payDate > template.endsAt) break;
      result.push({
        payDate,
        generationDate: addUtcDays(payDate, -leadDays),
        isLast: false,
      });
    }

    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  // Mark the final entry if it's truly the last (bounded by maxOccurrences
  // or by endsAt cutting off the next iteration).
  const isFinalByMax =
    template.maxOccurrences !== null && result.length === remainingByMax;
  if (isFinalByMax && result.length > 0) {
    result[result.length - 1].isLast = true;
  }

  return result;
}
