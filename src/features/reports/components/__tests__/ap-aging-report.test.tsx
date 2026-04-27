// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApAgingReport } from "../ap-aging-report";
import type { ApAgingReport as ReportData } from "../../report-service";

function makeReport(overrides?: Partial<ReportData>): ReportData {
  return {
    asOf: new Date("2026-04-27"),
    vendorRows: [],
    totals: { current: 0, d1to30: 0, d31to60: 0, d61plus: 0 },
    billCount: { current: 0, d1to30: 0, d31to60: 0, d61plus: 0 },
    ...overrides,
  };
}

describe("ApAgingReport", () => {
  it("renders an em-dash for zero-value cells", () => {
    const data = makeReport({
      vendorRows: [
        {
          vendorId: "v1",
          vendorName: "Acme",
          current: 0,
          d1to30: 50_000,
          d31to60: 0,
          d61plus: 0,
        },
      ],
      totals: { current: 0, d1to30: 50_000, d31to60: 0, d61plus: 0 },
      billCount: { current: 0, d1to30: 1, d31to60: 0, d61plus: 0 },
    });

    render(<ApAgingReport data={data} />);
    // Zero cells should show an em-dash; non-zero cells show formatted amounts
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("renders the grand-total row summing all buckets", () => {
    const data = makeReport({
      totals: { current: 10_000, d1to30: 20_000, d31to60: 30_000, d61plus: 40_000 },
      billCount: { current: 1, d1to30: 1, d31to60: 1, d61plus: 1 },
    });

    render(<ApAgingReport data={data} />);
    // Grand total = $1,000.00
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
  });

  it("applies a red class to the 61+ bucket pill", () => {
    const data = makeReport({
      vendorRows: [
        { vendorId: "v1", vendorName: "Acme", current: 0, d1to30: 0, d31to60: 0, d61plus: 50_000 },
      ],
      totals: { current: 0, d1to30: 0, d31to60: 0, d61plus: 50_000 },
      billCount: { current: 0, d1to30: 0, d31to60: 0, d61plus: 1 },
    });

    const { container } = render(<ApAgingReport data={data} />);
    // d61plus gets text-red-700 class via AgingBucketPill
    expect(container.querySelector(".text-red-700")).toBeInTheDocument();
  });

  it("shows 'No outstanding bills' when vendorRows is empty", () => {
    render(<ApAgingReport data={makeReport()} />);
    expect(screen.getByText("No outstanding bills")).toBeInTheDocument();
  });

  it("renders vendor name in its row", () => {
    const data = makeReport({
      vendorRows: [
        { vendorId: "v1", vendorName: "WeWork", current: 100_000, d1to30: 0, d31to60: 0, d61plus: 0 },
      ],
      totals: { current: 100_000, d1to30: 0, d31to60: 0, d61plus: 0 },
      billCount: { current: 1, d1to30: 0, d31to60: 0, d61plus: 0 },
    });

    render(<ApAgingReport data={data} />);
    expect(screen.getByText("WeWork")).toBeInTheDocument();
  });
});
