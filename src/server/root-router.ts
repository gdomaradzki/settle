import "server-only";
import { cookies } from "next/headers";
import { router, createCallerFactory, resolveUser } from "./trpc";
import { billRouter } from "@/features/bills/bill-router";
import { userRouter } from "@/features/users/user-router";
import { vendorRouter } from "@/features/vendors/vendor-router";
import { intakeRouter } from "@/features/intake/intake-router";
import { dashboardRouter } from "@/features/dashboard/dashboard-router";
import { reportRouter } from "@/features/reports/report-router";

export const appRouter = router({
  bill: billRouter,
  user: userRouter,
  vendor: vendorRouter,
  intake: intakeRouter,
  dashboard: dashboardRouter,
  reports: reportRouter,
});

export type AppRouter = typeof appRouter;

export async function createServerCaller() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("settle-user-id")?.value;
  const user = await resolveUser(userId);
  return createCallerFactory(appRouter)({ user, isAuthenticated: !!userId });
}
