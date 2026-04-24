import Link from "next/link";
import { formatRelativeTime } from "@/lib/dates";
import type { ActivityEvent } from "../dashboard-service";

const VERB: Record<string, string> = {
  created: "created",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  scheduled: "scheduled payment for",
  paid: "paid",
  edited: "edited",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent activity.</p>;
  }

  return (
    <ol className="space-y-1">
      {events.map((e) => {
        const verb = VERB[e.type] ?? e.type;
        const vendor = e.bill?.vendor?.name;
        const label = vendor ? `${verb} ${vendor} bill` : verb;

        return (
          <li key={e.id}>
            <Link
              href={`/bills/${e.billId}`}
              className="flex items-center gap-3 rounded-md px-2 py-2 -mx-2 transition-colors hover:bg-muted/50">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {initials(e.actorName)}
              </span>
              <p className="flex-1 truncate text-sm">
                <span className="font-medium text-foreground">
                  {e.actorName}
                </span>{" "}
                <span className="text-muted-foreground">{label}</span>
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(new Date(e.createdAt))}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
