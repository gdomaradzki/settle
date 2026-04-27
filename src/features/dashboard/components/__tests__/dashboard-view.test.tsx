// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardView } from "../dashboard-view";
import type { DashboardSummary } from "../../dashboard-service";

function makeSummary(overrides?: Partial<DashboardSummary>): DashboardSummary {
  return {
    needsMyApproval: 0,
    dueThisWeek: 0,
    cashOutCents: 0,
    recentEvents: [],
    ...overrides,
  };
}

describe("DashboardView", () => {
  it("renders the user greeting", () => {
    render(<DashboardView summary={makeSummary()} userName="Ada Chen" />);
    expect(screen.getByText(/Welcome, Ada Chen/)).toBeInTheDocument();
  });

  it("renders the needsMyApproval count", () => {
    render(<DashboardView summary={makeSummary({ needsMyApproval: 5 })} userName="Gus" />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders the dueThisWeek count", () => {
    render(<DashboardView summary={makeSummary({ dueThisWeek: 3 })} userName="Gus" />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders cash out formatted as USD", () => {
    render(<DashboardView summary={makeSummary({ cashOutCents: 125_050 })} userName="Gus" />);
    expect(screen.getByText("$1,250.50")).toBeInTheDocument();
  });

  it("needsMyApproval tile links to /bills?mine=1", () => {
    render(<DashboardView summary={makeSummary({ needsMyApproval: 2 })} userName="Gus" />);
    const link = screen.getByRole("link", { name: /needs my approval/i });
    expect(link).toHaveAttribute("href", "/bills?mine=1");
  });

  it("dueThisWeek tile links to /bills?due=this-week", () => {
    render(<DashboardView summary={makeSummary({ dueThisWeek: 1 })} userName="Gus" />);
    const link = screen.getByRole("link", { name: /due this week/i });
    expect(link).toHaveAttribute("href", "/bills?due=this-week");
  });
});
