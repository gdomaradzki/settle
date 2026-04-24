import Link from 'next/link';

type Props = {
  title: string;
  value: string | number;
  hint?: string;
  href?: string;
};

export function SummaryTile({ title, value, hint, href }: Props) {
  const inner = (
    <div className="rounded-lg border border-border p-4 sm:p-6 transition-colors hover:border-foreground/20">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-3 text-xl sm:text-2xl md:text-3xl font-semibold tabular-nums text-foreground truncate">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {href && <p className="mt-4 text-xs text-muted-foreground">View →</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
