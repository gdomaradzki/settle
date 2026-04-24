'use client';
import { trpc } from '@/lib/trpc-client';
import { formatRelativeTime, formatAbsoluteDate } from '@/lib/dates';
import type { BillEvent } from '@/generated/prisma/client';

const VERB: Record<string, string> = {
  created: 'created',
  submitted: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  scheduled: 'scheduled payment',
  paid: 'marked as paid',
  edited: 'edited',
};

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getPayload(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, string>;
}

interface Props {
  events: BillEvent[];
}

export function BillActivityTimeline({ events }: Props) {
  const { data: users } = trpc.user.list.useQuery();
  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]));

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="space-y-0">
      {events.map((event, idx) => {
        const actor = userMap[event.actorId];
        const actorName = actor?.name ?? 'Unknown';
        const payload = getPayload(event.payload);
        const isLast = idx === events.length - 1;

        return (
          <li key={event.id} className="flex gap-3">
            {/* Rail */}
            <div className="flex flex-col items-center">
              <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
                {initials(actorName)}
              </div>
              {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
            </div>

            {/* Content */}
            <div className={isLast ? 'pb-0 pt-0.5' : 'pb-5 pt-0.5'}>
              <p className="text-sm">
                <span className="font-medium text-foreground">{actorName}</span>{' '}
                <span className="text-muted-foreground">{VERB[event.type] ?? event.type}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelativeTime(new Date(event.createdAt))}
              </p>
              {event.type === 'rejected' && payload.reason && (
                <p className="mt-1 text-xs text-muted-foreground italic">"{payload.reason}"</p>
              )}
              {event.type === 'scheduled' && payload.payDate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {payload.method} · {formatAbsoluteDate(new Date(payload.payDate))}
                </p>
              )}
              {event.type === 'paid' && payload.confirmation && (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {payload.confirmation}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
