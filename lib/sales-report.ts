export const salesPeriodOptions = [
  { key: "7d", label: "Últimos 7 dias", days: 7 },
  { key: "30d", label: "Últimos 30 dias", days: 30 },
  { key: "90d", label: "Últimos 90 dias", days: 90 },
  { key: "all", label: "Todo o histórico", days: null },
] as const;

export type SalesPeriodKey = (typeof salesPeriodOptions)[number]["key"];

export function resolveSalesPeriod(value: string | undefined, now = new Date()) {
  const selected = salesPeriodOptions.find((option) => option.key === value)
    ?? salesPeriodOptions[1];
  const until = new Date(now);
  const since = selected.days === null
    ? null
    : new Date(until.getTime() - selected.days * 24 * 60 * 60 * 1000);

  return { ...selected, since, until };
}

export function calculateAverageTicket(totalCents: number, orderCount: number) {
  return orderCount > 0 ? Math.round(totalCents / orderCount) : 0;
}

export function buildPaidPeriodFilter(since: Date | null, until: Date) {
  if (!since) return {};
  return {
    OR: [
      { paidAt: { gte: since, lte: until } },
      { paidAt: null, createdAt: { gte: since, lte: until } },
    ],
  };
}
