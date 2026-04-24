const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUSD(cents: number): string {
  return fmt.format(cents / 100);
}
