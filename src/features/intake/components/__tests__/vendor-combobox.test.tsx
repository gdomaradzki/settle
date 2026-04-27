// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockVendorList } from "@/test/mocks/trpc-client";

vi.mock("@/lib/trpc-client", () => import("@/test/mocks/trpc-client"));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { VendorCombobox } from "../vendor-combobox";

const vendors = [
  { id: "v1", name: "Acme Corp", paymentMethod: "ACH", outstandingCount: 0, outstandingCents: 0 },
  { id: "v2", name: "WeWork", paymentMethod: "ACH", outstandingCount: 0, outstandingCents: 0 },
  { id: "v3", name: "Notion Labs", paymentMethod: "ACH", outstandingCount: 0, outstandingCents: 0 },
];

describe("VendorCombobox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVendorList.mockReturnValue({ data: vendors, isLoading: false });
  });

  it("shows 'Select vendor…' placeholder when no value is selected", () => {
    render(<VendorCombobox value={null} onChange={vi.fn()} />);
    expect(screen.getByText("Select vendor…")).toBeInTheDocument();
  });

  it("shows the selected vendor name when a value is provided", () => {
    render(<VendorCombobox value="v2" onChange={vi.fn()} />);
    expect(screen.getByText("WeWork")).toBeInTheDocument();
  });

  it("opens the dropdown and lists all vendors on trigger click", async () => {
    const user = userEvent.setup();
    render(<VendorCombobox value={null} onChange={vi.fn()} />);

    await user.click(screen.getByText("Select vendor…"));

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("WeWork")).toBeInTheDocument();
      expect(screen.getByText("Notion Labs")).toBeInTheDocument();
    });
  });

  it("filters the list as the user types in the search box", async () => {
    const user = userEvent.setup();
    render(<VendorCombobox value={null} onChange={vi.fn()} />);

    await user.click(screen.getByText("Select vendor…"));
    await user.type(screen.getByPlaceholderText("Search vendors…"), "wework");

    await waitFor(() => {
      expect(screen.getByText("WeWork")).toBeInTheDocument();
      expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    });
  });

  it("always shows a Create new vendor button at the bottom", async () => {
    const user = userEvent.setup();
    render(<VendorCombobox value={null} onChange={vi.fn()} />);

    await user.click(screen.getByText("Select vendor…"));

    await waitFor(() => {
      expect(screen.getByText(/create new vendor/i)).toBeInTheDocument();
    });
  });

  it("shows 'Create <query>' when a search term doesn't match any vendor", async () => {
    const user = userEvent.setup();
    render(<VendorCombobox value={null} onChange={vi.fn()} />);

    await user.click(screen.getByText("Select vendor…"));
    await user.type(screen.getByPlaceholderText("Search vendors…"), "Stripe");

    await waitFor(() => {
      expect(screen.getByText(/create "Stripe"/i)).toBeInTheDocument();
    });
  });

  it("calls onChange with the vendor id when a vendor is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VendorCombobox value={null} onChange={onChange} />);

    await user.click(screen.getByText("Select vendor…"));
    await waitFor(() => screen.getByText("Acme Corp"));
    await user.click(screen.getByText("Acme Corp"));

    expect(onChange).toHaveBeenCalledWith("v1");
  });
});
