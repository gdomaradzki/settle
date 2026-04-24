import { formatUSD } from '@/lib/money';
import { SummaryTile } from './summary-tile';
import { RecentActivity } from './recent-activity';
import type { DashboardSummary } from '../dashboard-service';

interface Props {
  summary: DashboardSummary;
  userName: string;
}

export function DashboardView({ summary, userName }: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-6 py-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Welcome, {userName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening in your accounts payable today.
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile
          title="Needs my approval"
          value={summary.needsMyApproval}
          href="/bills?mine=1"
        />
        <SummaryTile
          title="Due this week"
          value={summary.dueThisWeek}
          href="/bills?due=this-week"
        />
        <SummaryTile
          title="Cash out next 30 days"
          value={formatUSD(summary.cashOutCents)}
        />
      </div>

      {/* Recent activity */}
      <div className="space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent activity
        </h2>
        <RecentActivity events={summary.recentEvents} />
      </div>
    </div>
  );
}
