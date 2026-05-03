import { describe, it, expect } from "vitest";
import { computeUpcomingOccurrences } from "@/features/templates/lead-time";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

const baseTemplate = {
  paymentDayOfMonth: 15,
  endsAt: null,
  maxOccurrences: null,
  cancelledAt: null,
  vendor: { paymentMethod: "ACH" as const },
};

describe("computeUpcomingOccurrences", () => {
  it("returns N forward pay dates for an open-ended ACH template", () => {
    const result = computeUpcomingOccurrences(
      baseTemplate,
      0,
      [],
      utc(2026, 5, 3),
      6,
    );

    expect(result).toHaveLength(6);
    expect(result[0].payDate.toISOString()).toBe(utc(2026, 5, 15).toISOString());
    expect(result[0].generationDate.toISOString()).toBe(
      utc(2026, 5, 5).toISOString(),
    );
    expect(result[5].payDate.toISOString()).toBe(
      utc(2026, 10, 15).toISOString(),
    );
    expect(result.every((r) => r.isLast === false)).toBe(true);
  });

  it("returns 15-day-ahead generation dates for CHECK", () => {
    const result = computeUpcomingOccurrences(
      { ...baseTemplate, vendor: { paymentMethod: "CHECK" } },
      0,
      [],
      utc(2026, 5, 3),
      1,
    );

    expect(result[0].payDate.toISOString()).toBe(utc(2026, 5, 15).toISOString());
    expect(result[0].generationDate.toISOString()).toBe(
      utc(2026, 4, 30).toISOString(),
    );
  });

  it("skips pay dates that already have a generated bill", () => {
    const existingPayDate = utc(2026, 5, 15);
    const result = computeUpcomingOccurrences(
      baseTemplate,
      1,
      [existingPayDate],
      utc(2026, 5, 3),
      3,
    );

    expect(result.map((r) => r.payDate.toISOString())).toEqual([
      utc(2026, 6, 15).toISOString(),
      utc(2026, 7, 15).toISOString(),
      utc(2026, 8, 15).toISOString(),
    ]);
  });

  it("stops when payDate exceeds endsAt", () => {
    const result = computeUpcomingOccurrences(
      { ...baseTemplate, endsAt: utc(2026, 7, 15) },
      0,
      [],
      utc(2026, 5, 3),
      6,
    );

    expect(result.map((r) => r.payDate.toISOString())).toEqual([
      utc(2026, 5, 15).toISOString(),
      utc(2026, 6, 15).toISOString(),
      utc(2026, 7, 15).toISOString(),
    ]);
  });

  it("stops at maxOccurrences and marks the final entry as last", () => {
    const result = computeUpcomingOccurrences(
      { ...baseTemplate, maxOccurrences: 5 },
      2, // 2 past bills
      [],
      utc(2026, 5, 3),
      6,
    );

    expect(result).toHaveLength(3); // 5 max - 2 past = 3 remaining
    expect(result[2].isLast).toBe(true);
    expect(result[0].isLast).toBe(false);
    expect(result[1].isLast).toBe(false);
  });

  it("returns empty array when maxOccurrences already reached", () => {
    const result = computeUpcomingOccurrences(
      { ...baseTemplate, maxOccurrences: 3 },
      3,
      [],
      utc(2026, 5, 3),
      6,
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when template is cancelled", () => {
    const result = computeUpcomingOccurrences(
      { ...baseTemplate, cancelledAt: utc(2026, 5, 1) },
      0,
      [],
      utc(2026, 5, 3),
      6,
    );
    expect(result).toEqual([]);
  });

  it("starts in the next month when current month's pay date already passed", () => {
    // paymentDayOfMonth=10, today=May 15 → next pay date is June 10
    const result = computeUpcomingOccurrences(
      { ...baseTemplate, paymentDayOfMonth: 10 },
      0,
      [],
      utc(2026, 5, 15),
      2,
    );
    expect(result[0].payDate.toISOString()).toBe(utc(2026, 6, 10).toISOString());
    expect(result[1].payDate.toISOString()).toBe(utc(2026, 7, 10).toISOString());
  });
});
