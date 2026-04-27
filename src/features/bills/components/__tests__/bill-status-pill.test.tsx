// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillStatusPill } from "../bill-status-pill";

const CASES = [
  { status: "DRAFT", label: "Draft" },
  { status: "PENDING_APPROVAL", label: "Pending approval" },
  { status: "APPROVED", label: "Approved" },
  { status: "SCHEDULED", label: "Scheduled" },
  { status: "PAID", label: "Paid" },
  { status: "REJECTED", label: "Rejected" },
] as const;

describe("BillStatusPill", () => {
  it.each(CASES)("renders the correct label for $status", ({ status, label }) => {
    render(<BillStatusPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("applies a red class for REJECTED", () => {
    const { container } = render(<BillStatusPill status="REJECTED" />);
    expect(container.firstChild).toHaveClass("bg-red-50");
  });

  it("applies an amber class for PENDING_APPROVAL", () => {
    const { container } = render(<BillStatusPill status="PENDING_APPROVAL" />);
    expect(container.firstChild).toHaveClass("bg-amber-50");
  });

  it("applies an emerald class for PAID", () => {
    const { container } = render(<BillStatusPill status="PAID" />);
    expect(container.firstChild).toHaveClass("bg-emerald-50");
  });

  it("has a readable aria-label", () => {
    render(<BillStatusPill status="APPROVED" />);
    expect(screen.getByLabelText("Status: Approved")).toBeInTheDocument();
  });
});
