// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  mockVendorList,
  mockBillCreate,
  mockBillCreateAndSubmit,
} from "@/test/mocks/trpc-client";
import { mockRouter } from "@/test/mocks/next-navigation";

vi.mock("@/lib/trpc-client", () => import("@/test/mocks/trpc-client"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BillIntakeForm } from "../bill-intake-form";

const vendors = [
  {
    id: "v1",
    name: "Acme Corp",
    paymentMethod: "ACH",
    outstandingCount: 0,
    outstandingCents: 0,
  },
];

const validExtraction = {
  vendorName: "Acme Corp",
  invoiceNumber: "INV-001",
  amountCents: 10_000,
  issueDate: "2026-01-01",
  dueDate: "2026-02-01",
  lineItems: [
    {
      description: "Service fee",
      amountCents: 10_000,
      type: "EXPENSE" as const,
    },
  ],
};

describe("BillIntakeForm", () => {
  let mutateAsyncCreate: Mock<(input: unknown) => Promise<{ id: string }>>;
  let mutateAsyncCreateAndSubmit: Mock<
    (input: unknown) => Promise<{ id: string }>
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVendorList.mockReturnValue({ data: vendors, isLoading: false });

    mutateAsyncCreate = vi
      .fn<(input: unknown) => Promise<{ id: string }>>()
      .mockResolvedValue({ id: "b-new" });
    mockBillCreate.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mutateAsyncCreate,
      isPending: false,
      isError: false,
    });

    mutateAsyncCreateAndSubmit = vi
      .fn<(input: unknown) => Promise<{ id: string }>>()
      .mockResolvedValue({ id: "b-new" });
    mockBillCreateAndSubmit.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: mutateAsyncCreateAndSubmit,
      isPending: false,
      isError: false,
    });
  });

  it("renders vendor placeholder when no extraction is provided", () => {
    render(<BillIntakeForm />);
    expect(screen.getByText("Select vendor…")).toBeInTheDocument();
  });

  it("pre-fills invoice number and amount from extraction", () => {
    render(<BillIntakeForm initialExtraction={validExtraction} />);
    expect(screen.getByDisplayValue("INV-001")).toBeInTheDocument();
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(100);
  });

  it("auto-selects vendor when extraction vendorName matches the list", async () => {
    render(<BillIntakeForm initialExtraction={validExtraction} />);
    await waitFor(() =>
      expect(screen.getByText("Acme Corp")).toBeInTheDocument(),
    );
  });

  it("auto-sums bill amount when a line item amount is entered (before bill amount is touched)", async () => {
    render(<BillIntakeForm />);

    const lineItemInput = screen.getByPlaceholderText("0.00");
    fireEvent.change(lineItemInput, { target: { value: "50" } });

    await waitFor(() =>
      expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(50),
    );
  });

  it("stops auto-summing after the bill amount has been manually edited", async () => {
    render(<BillIntakeForm />);

    const [billAmountInput, lineItemInput] = screen.getAllByRole("spinbutton");

    fireEvent.change(billAmountInput, { target: { value: "200" } });
    fireEvent.change(lineItemInput, { target: { value: "50" } });

    await waitFor(() => expect(billAmountInput).toHaveValue(200));
  });

  it('"Submit for approval" calls createAndSubmit.mutateAsync with form values', async () => {
    const user = userEvent.setup();
    render(<BillIntakeForm initialExtraction={validExtraction} />);

    await waitFor(() =>
      expect(screen.getByText("Acme Corp")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /submit for approval/i }),
    );

    await waitFor(() =>
      expect(mutateAsyncCreateAndSubmit).toHaveBeenCalledOnce(),
    );
    expect(mutateAsyncCreateAndSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        vendorId: "v1",
        amountCents: 10_000,
        invoiceNumber: "INV-001",
      }),
    );
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith("/bills/b-new"),
    );
  });

  it('"Save as draft" calls createBill.mutateAsync with form values', async () => {
    const user = userEvent.setup();
    render(<BillIntakeForm initialExtraction={validExtraction} />);

    await waitFor(() =>
      expect(screen.getByText("Acme Corp")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /save as draft/i }));

    await waitFor(() => expect(mutateAsyncCreate).toHaveBeenCalledOnce());
    expect(mutateAsyncCreate).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: "v1", amountCents: 10_000 }),
    );
  });

  it("shows mismatch error when line items do not sum to the bill amount", async () => {
    const user = userEvent.setup();
    render(
      <BillIntakeForm
        initialExtraction={{
          ...validExtraction,
          amountCents: 10_000,
          lineItems: [
            {
              description: "Partial",
              amountCents: 5_000,
              type: "EXPENSE" as const,
            },
          ],
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Acme Corp")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /submit for approval/i }),
    );

    await waitFor(() =>
      expect(screen.getByText("Check line items")).toBeInTheDocument(),
    );
  });

  it("shows due-date error when extraction has due date before issue date", async () => {
    const user = userEvent.setup();
    render(
      <BillIntakeForm
        initialExtraction={{
          ...validExtraction,
          issueDate: "2026-06-01",
          dueDate: "2026-01-01",
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Acme Corp")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /submit for approval/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/due date cannot be before/i),
      ).toBeInTheDocument(),
    );
  });
});
