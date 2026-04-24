import "server-only";
import { db } from "@/server/db";
import type { UserRole } from "@/generated/prisma/enums";

export type ActivityEvent = {
  id: string;
  billId: string;
  type: string;
  actorId: string;
  actorName: string;
  createdAt: Date;
  bill: { id: string; vendor: { name: string } | null } | null;
};

export type DashboardSummary = {
  needsMyApproval: number;
  dueThisWeek: number;
  cashOutCents: number;
  recentEvents: ActivityEvent[];
};

type RawEvent = {
  id: string;
  billId: string;
  type: string;
  actorId: string;
  createdAt: Date;
  bill: { id: string; vendor: { name: string } | null } | null;
};

export async function getDashboardSummary(
  _userId: string,
  userRole: UserRole,
): Promise<DashboardSummary> {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86_400_000);
  const in30 = new Date(now.getTime() + 30 * 86_400_000);

  const [needsMyApproval, dueThisWeek, cashOut, rawEvents, users] =
    await Promise.all([
      userRole === "APPROVER"
        ? db.bill.count({ where: { status: "PENDING_APPROVAL" } })
        : Promise.resolve(0),

      db.bill.count({
        where: {
          status: { in: ["PENDING_APPROVAL", "APPROVED", "SCHEDULED"] },
          dueDate: { gte: now, lte: in7 },
        },
      }),

      db.bill.aggregate({
        _sum: { amountCents: true },
        where: {
          status: { in: ["APPROVED", "SCHEDULED"] },
          dueDate: { gte: now, lte: in30 },
        },
      }),

      db.billEvent.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          bill: { include: { vendor: { select: { name: true } } } },
        },
      }),

      db.user.findMany({ select: { id: true, name: true } }),
    ]);

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return {
    needsMyApproval,
    dueThisWeek,
    // _sum.amountCents is null when no rows match — coalesce to 0
    cashOutCents:
      (cashOut as { _sum: { amountCents: number | null } })._sum.amountCents ??
      0,
    recentEvents: (rawEvents as unknown as RawEvent[]).map((e) => ({
      id: e.id,
      billId: e.billId,
      type: e.type,
      actorId: e.actorId,
      actorName: userMap[e.actorId] ?? "Unknown",
      createdAt: e.createdAt,
      bill: e.bill,
    })),
  };
}
