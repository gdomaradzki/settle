// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockVendorList, mockVendorCreate } from "@/test/mocks/trpc-client";

vi.mock("@/lib/trpc-client", () => import("@/test/mocks/trpc-client"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AddVendorDialog } from "../add-vendor-dialog";

function renderDialog(open = true, initialName = "") {
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  render(
    <AddVendorDialog
      open={open}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
      initialName={initialName}
    />,
  );
  return { onOpenChange, onCreated };
}

describe("AddVendorDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVendorList.mockReturnValue({ data: [], isLoading: false });
    mockVendorCreate.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    });
  });

  it("renders ACH account and routing fields when ACH is selected", () => {
    renderDialog();
    expect(screen.getByPlaceholderText("1234")).toBeInTheDocument(); // account last 4
    expect(screen.getByPlaceholderText("5678")).toBeInTheDocument(); // routing last 4
    expect(screen.queryByPlaceholderText(/mailing address/i)).not.toBeInTheDocument();
  });

  it("shows mailing address field and hides ACH fields when Check is selected", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByLabelText("Check"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/123 Main St/i)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("1234")).not.toBeInTheDocument();
    });
  });

  it("pre-fills the name field from initialName", () => {
    renderDialog(true, "Amazon Web Services");
    expect(screen.getByPlaceholderText("Vendor name")).toHaveValue(
      "Amazon Web Services",
    );
  });

  it("shows a duplicate-name error when an existing vendor name is typed", async () => {
    mockVendorList.mockReturnValue({
      data: [{ id: "v1", name: "Acme Corp", paymentMethod: "ACH", outstandingCount: 0, outstandingCents: 0 }],
      isLoading: false,
    });

    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByPlaceholderText("Vendor name"));
    await user.type(screen.getByPlaceholderText("Vendor name"), "Acme Corp");

    await waitFor(() => {
      expect(
        screen.getByText(/a vendor with this name already exists/i),
      ).toBeInTheDocument();
    });
  });

  it("disables the submit button while a duplicate name is entered", async () => {
    mockVendorList.mockReturnValue({
      data: [{ id: "v1", name: "Acme", paymentMethod: "ACH", outstandingCount: 0, outstandingCents: 0 }],
      isLoading: false,
    });

    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByPlaceholderText("Vendor name"), "Acme");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create vendor/i })).toBeDisabled();
    });
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
