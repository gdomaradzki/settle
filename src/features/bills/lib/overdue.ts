export function filterOverdue<T extends { status: string }>(bills: T[]): T[] {
  return bills.filter((b) => b.status !== "PAID" && b.status !== "REJECTED");
}
