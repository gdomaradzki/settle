import { cn } from "@/lib/utils";
import type { BillStatus } from "@/generated/prisma/enums";

const STATUS_CONFIG: Record<BillStatus, { label: string; className: string }> =
  {
    DRAFT: {
      label: "Draft",
      className:
        "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    },
    PENDING_APPROVAL: {
      label: "Pending approval",
      className:
        "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    APPROVED: {
      label: "Approved",
      className:
        "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    SCHEDULED: {
      label: "Scheduled",
      className:
        "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    },
    PAID: {
      label: "Paid",
      className:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    REJECTED: {
      label: "Rejected",
      className: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    },
  };

export function BillStatusPill({ status }: { status: BillStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      aria-label={`Status: ${label}`}
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        className,
      )}>
      {label}
    </span>
  );
}
