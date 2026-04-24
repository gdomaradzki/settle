'use client';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc-client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = {
  SUBMITTER: 'Submitter',
  APPROVER: 'Approver',
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function UserSwitcher() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: current } = trpc.user.current.useQuery();
  const { data: users } = trpc.user.list.useQuery();

  async function switchUser(userId: string) {
    try {
      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      await utils.invalidate();
      router.refresh();
    } catch (e) {
      console.error('Failed to switch user', e);
    }
  }

  if (!current) {
    return <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm',
          'transition-colors hover:bg-muted outline-none',
        )}
      >
        <Avatar size="sm">
          <AvatarFallback className="text-xs font-medium bg-muted-foreground/10">
            {initials(current.name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden sm:flex items-center gap-1.5">
          <span className="font-medium text-foreground">{current.name}</span>
          <span className="text-xs text-muted-foreground">
            {ROLE_LABEL[current.role] ?? current.role}
          </span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Switch user</div>
        <DropdownMenuSeparator />
        {users?.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => switchUser(user.id)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5',
              user.id === current.id && 'bg-muted/50',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar size="sm">
                <AvatarFallback className="text-xs bg-muted-foreground/10">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{user.name}</span>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
