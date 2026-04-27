// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CsvPreviewTable } from "../csv-preview-table";

const vendors = [{ id: "v1", name: "Acme Corp" }];

function validRow(overrides?: Record<string, string>) {
  return {
    vendor_name: "Acme Corp",
    invoice_number: "INV-001",
    amount: "100.00",
    issue_date: "2026-01-01",
    due_date: "2026-02-01",
    memo: "",
    gl_category: "",
    line_description: "Service fee",
    line_amount: "",
    line_type: "EXPENSE",
    ...overrides,
  };
}

// Invalid because vendor_name doesn't match any entry in `vendors`.
// All numeric fields are valid so Zod v4's transforms don't throw (Zod v4 doesn't
// catch non-ZodError exceptions from transforms inside safeParse).
function invalidRow(overrides?: Record<string, string>) {
  return {
    vendor_name: "Unknown Vendor",
    invoice_number: "",
    amount: "250.00",
    issue_date: "2026-01-01",
    due_date: "2026-02-01",
    memo: "",
    gl_category: "",
    line_description: "Service",
    line_amount: "",
    line_type: "EXPENSE",
    ...overrides,
  };
}

describe("CsvPreviewTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a Valid badge for a valid row", () => {
    render(
      <CsvPreviewTable
        rawRows={[validRow()]}
        vendors={vendors}
        onConfirm={vi.fn()}
        onReset={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByText("Valid")).toBeInTheDocument();
  });

  it("shows an Invalid badge for an invalid row", () => {
    render(
      <CsvPreviewTable
        rawRows={[invalidRow()]}
        vendors={vendors}
        onConfirm={vi.fn()}
        onReset={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });

  it("renders inline error message for an invalid row", () => {
    render(
      <CsvPreviewTable
        rawRows={[invalidRow()]}
        vendors={vendors}
        onConfirm={vi.fn()}
        onReset={vi.fn()}
        isSubmitting={false}
      />,
    );
    // The vendor "Unknown Vendor" is not in the vendors list → inline error
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it("enables the confirm button when all rows are valid", () => {
    render(
      <CsvPreviewTable
        rawRows={[validRow()]}
        vendors={vendors}
        onConfirm={vi.fn()}
        onReset={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByRole("button", { name: /import/i })).not.toBeDisabled();
  });

  it("disables the confirm button when any row is invalid", () => {
    render(
      <CsvPreviewTable
        rawRows={[validRow(), invalidRow()]}
        vendors={vendors}
        onConfirm={vi.fn()}
        onReset={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByRole("button", { name: /import/i })).toBeDisabled();
  });

  it("disables the confirm button while submitting", () => {
    render(
      <CsvPreviewTable
        rawRows={[validRow()]}
        vendors={vendors}
        onConfirm={vi.fn()}
        onReset={vi.fn()}
        isSubmitting={true}
      />,
    );
    expect(screen.getByRole("button", { name: /import/i })).toBeDisabled();
  });

  it("calls onConfirm with valid inputs when confirm is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <CsvPreviewTable
        rawRows={[validRow()]}
        vendors={vendors}
        onConfirm={onConfirm}
        onReset={vi.fn()}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /import/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
    const [inputs] = onConfirm.mock.calls[0];
    expect(inputs).toHaveLength(1);
    expect(inputs[0].amountCents).toBe(10_000);
  });

  it("calls onReset when Replace CSV is clicked", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(
      <CsvPreviewTable
        rawRows={[validRow()]}
        vendors={vendors}
        onConfirm={vi.fn()}
        onReset={onReset}
        isSubmitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: /replace csv/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
