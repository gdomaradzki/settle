'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboardIcon, FileTextIcon, Building2Icon, BarChart3Icon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserSwitcher } from './user-switcher';

const NAV = [
  { href: '/', label: 'Dashboard', Icon: LayoutDashboardIcon },
  { href: '/bills', label: 'Bills', Icon: FileTextIcon },
  { href: '/vendors', label: 'Vendors', Icon: Building2Icon },
  { href: '/reports/ap-aging', label: 'Reports', Icon: BarChart3Icon },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex h-full items-center gap-4 px-4">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight text-foreground"
        >
          Settle
        </Link>

        <nav className="flex flex-1 items-center gap-0.5">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  'rounded-md px-2 sm:px-3 py-1.5 transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {/* Mobile: icon only */}
                <Icon className="size-4 sm:hidden" aria-hidden />
                {/* Desktop: text label */}
                <span className="hidden sm:inline text-sm font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>

        <UserSwitcher />
      </div>
    </header>
  );
}
