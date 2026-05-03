import type { BillStatus } from "@/generated/prisma/enums";

export type DueTone = "default" | "warning" | "overdue" | "muted";

export function formatRelativeDueDate(
  dueDate: Date,
  status: BillStatus,
): { label: string; tone: DueTone } {
  const now = new Date();
  // Compare at midnight UTC to avoid timezone jitter
  const todayMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dueMs = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate(),
  );
  const diffDays = Math.round((dueMs - todayMs) / 86_400_000);

  if (diffDays < 0) {
    const isTerminal = status === "PAID" || status === "REJECTED";
    if (isTerminal) {
      return { label: formatShortDate(dueDate), tone: "muted" };
    }
    return { label: `Overdue ${Math.abs(diffDays)}d`, tone: "overdue" };
  }

  if (diffDays === 0) return { label: "Due today", tone: "warning" };
  if (diffDays <= 7) return { label: `Due in ${diffDays}d`, tone: "warning" };

  return { label: formatShortDate(dueDate), tone: "default" };
}

// Most date fields in this app are *calendar dates* stored at UTC midnight
// (dueDate, scheduledPayDate, issueDate, endsAt). Rendering them in the
// viewer's local timezone would shift the displayed day by the UTC offset —
// a bill paid on the 12th would show as the 11th in the Americas. We always
// render in UTC. For true *instants* (paidAt, createdAt) the displayed date
// can differ by one near midnight UTC; that's an acceptable tradeoff.
function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatAbsoluteDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatShortDate(date);
}

export function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1mo ago";
  return `${diffMonths}mo ago`;
}
