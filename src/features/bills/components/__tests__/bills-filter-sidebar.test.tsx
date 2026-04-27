// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockRouter } from "@/test/mocks/next-navigation";
import { mockVendorList } from "@/test/mocks/trpc-client";

vi.mock("@/lib/trpc-client", () => import("@/test/mocks/trpc-client"));

import { BillsFilterSidebar } from "../bills-filter-sidebar";

describe("BillsFilterSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVendorList.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders status radio buttons including all six statuses", () => {
    render(<BillsFilterSidebar />);
    // <fieldset> has implicit role="group"; its <legend> provides the accessible name.
    const statusGroup = screen.getByRole("group", { name: /status/i });
    // "Any" appears in both Status and Due fieldsets — scope to the Status one.
    expect(within(statusGroup).getByLabelText("Any")).toBeInTheDocument();
    expect(within(statusGroup).getByLabelText("Draft")).toBeInTheDocument();
    expect(within(statusGroup).getByLabelText("Pending approval")).toBeInTheDocument();
    expect(within(statusGroup).getByLabelText("Approved")).toBeInTheDocument();
    expect(within(statusGroup).getByLabelText("Scheduled")).toBeInTheDocument();
    expect(within(statusGroup).getByLabelText("Paid")).toBeInTheDocument();
    expect(within(statusGroup).getByLabelText("Rejected")).toBeInTheDocument();
  });

  it("clicking a status radio calls router.replace with ?status=DRAFT", async () => {
    const user = userEvent.setup();
    render(<BillsFilterSidebar />);

    // "Draft" only appears in the Status fieldset — no scoping needed.
    await user.click(screen.getByLabelText("Draft"));

    expect(mockRouter.replace).toHaveBeenCalledOnce();
    const [url] = mockRouter.replace.mock.calls[0];
    expect(url).toContain("status=DRAFT");
  });

  it("clicking a due-window radio calls router.replace with ?due=overdue", async () => {
    const user = userEvent.setup();
    render(<BillsFilterSidebar />);

    await user.click(screen.getByLabelText("Overdue"));

    expect(mockRouter.replace).toHaveBeenCalledOnce();
    const [url] = mockRouter.replace.mock.calls[0];
    expect(url).toContain("due=overdue");
  });

  it("renders vendor options from the tRPC query", () => {
    mockVendorList.mockReturnValue({
      data: [{ id: "v1", name: "Acme Corp", paymentMethod: "ACH", outstandingCount: 0, outstandingCents: 0 }],
      isLoading: false,
    });

    render(<BillsFilterSidebar />);
    expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument();
  });

  it("selecting 'Any vendor' calls router.replace removing the vendor param", async () => {
    const { useSearchParams } = await import("next/navigation");
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("vendor=v1") as unknown as ReturnType<typeof useSearchParams>,
    );

    const user = userEvent.setup();
    render(<BillsFilterSidebar />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "");

    expect(mockRouter.replace).toHaveBeenCalledOnce();
    const [url] = mockRouter.replace.mock.calls[0];
    expect(url).not.toContain("vendor=");
  });
});
