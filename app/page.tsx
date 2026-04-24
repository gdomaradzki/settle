import type { Metadata } from "next";
import { createServerCaller } from "@/server/root-router";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata: Metadata = { title: "Dashboard — Settle" };

export default async function DashboardPage() {
  const caller = await createServerCaller();
  const [summary, user] = await Promise.all([
    caller.dashboard.summary(),
    caller.user.current(),
  ]);

  return (
    <DashboardView
      summary={summary}
      userName={(user as { name: string }).name ?? "there"}
    />
  );
}
