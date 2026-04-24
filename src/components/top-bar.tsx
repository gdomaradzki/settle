'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { UserSwitcher } from './user-switcher';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/bills', label: 'Bills' },
  { href: '/vendors', label: 'Vendors' },
  { href: '/reports/ap-aging', label: 'Reports' },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex h-full items-center gap-6 px-4">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight text-foreground"
        >
          Settle
        </Link>

        <nav className="hidden sm:flex flex-1 items-center gap-0.5">
          {NAV.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <UserSwitcher />
      </div>
    </header>
  );
}
