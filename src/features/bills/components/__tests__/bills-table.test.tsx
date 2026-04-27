// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { mockBillList } from "@/test/mocks/trpc-client";

vi.mock("@/lib/trpc-client", () => import("@/test/mocks/trpc-client"));

import { BillsTable } from "../bills-table";

function makeBill(overrides?: Record<string, unknown>) {
  return {
    id: "b1",
    status: "DRAFT",
    amountCents: 10_000,
    invoiceNumber: "INV-001",
    dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    vendor: { id: "v1", name: "Acme Corp", email: null },
    ...overrides,
  };
}

describe("BillsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading skeleton when isLoading is true", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockBillList.mockReturnValue({ data: undefined as any, isLoading: true });
    const { container } = render(<BillsTable />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows 'No bills match' message when the list is empty", () => {
    mockBillList.mockReturnValue({ data: [], isLoading: false });
    render(<BillsTable />);
    expect(screen.getByText(/no bills match/i)).toBeInTheDocument();
  });

  it("renders vendor name for each bill", () => {
    mockBillList.mockReturnValue({
      data: [makeBill({ vendor: { id: "v1", name: "WeWork", email: null } })],
      isLoading: false,
    });
    render(<BillsTable />);
    expect(screen.getByText("WeWork")).toBeInTheDocument();
  });

  it("renders the status pill for each bill", () => {
    mockBillList.mockReturnValue({
      data: [makeBill({ status: "APPROVED" })],
      isLoading: false,
    });
    render(<BillsTable />);
    expect(screen.getByLabelText("Status: Approved")).toBeInTheDocument();
  });

  it("does NOT show overdue indicator for PAID bills", () => {
    mockBillList.mockReturnValue({
      data: [
        makeBill({
          status: "PAID",
          dueDate: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        }),
      ],
      isLoading: false,
    });
    const { container } = render(<BillsTable />);
    // Overdue class is text-red-600; PAID bills should NOT get it in the due column
    const cells = container.querySelectorAll("td");
    const dueCells = Array.from(cells).filter((td) =>
      td.className.includes("text-red-600"),
    );
    expect(dueCells).toHaveLength(0);
  });

  it("renders formatted amount", () => {
    mockBillList.mockReturnValue({
      data: [makeBill({ amountCents: 125_050 })],
      isLoading: false,
    });
    render(<BillsTable />);
    expect(screen.getByText("$1,250.50")).toBeInTheDocument();
  });
});
