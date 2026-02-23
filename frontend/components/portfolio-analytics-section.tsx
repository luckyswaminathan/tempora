"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import type { PortfolioSnapshot, OrderRecord } from "@/lib/api";

interface Props {
  portfolio: PortfolioSnapshot;
  allOrders: OrderRecord[];
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];

function centsToDisplay(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

function probabilityLabel(prob: number): string {
  if (prob < 25) return "Strong contrarian";
  if (prob < 45) return "Contrarian";
  if (prob < 55) return "Balanced";
  if (prob < 75) return "Moderate favorites";
  return "Strong favorites";
}

export function PortfolioAnalyticsSection({ portfolio, allOrders }: Props) {
  const hasHoldings = portfolio.holdings.length > 0;
  const hasOrders = allOrders.length > 0;

  if (!hasHoldings && !hasOrders) return null;

  const filledOrders = allOrders.filter((o) => o.filled);
  const totalTrades = filledOrders.length;
  const uniqueMarkets = new Set(allOrders.map((o) => o.marketId)).size;
  const totalVolume = filledOrders.reduce(
    (sum, o) => sum + Math.abs(o.priceCents ?? 0),
    0,
  );
  const longPositions = portfolio.holdings.filter((h) => h.quantity > 0);
  const positionCount = longPositions.length;

  // B — Category pie data
  const categoryMap = new Map<string, number>();
  for (const h of longPositions) {
    const val = h.markPriceCents * h.quantity;
    categoryMap.set(h.category, (categoryMap.get(h.category) ?? 0) + val);
  }
  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));
  const totalCategoryValue = categoryData.reduce((s, d) => s + d.value, 0);

  // C — Probability profile
  let weightedProb = 0;
  let totalWeight = 0;
  for (const h of longPositions) {
    const weight = h.markPriceCents * h.quantity;
    weightedProb += (h.markPriceCents / 100) * weight;
    totalWeight += weight;
  }
  const avgProb = totalWeight > 0 ? (weightedProb / totalWeight) * 100 : 0;
  const uniqueMarketsInPortfolio = new Set(longPositions.map((h) => h.marketId)).size;

  // E — Top / bottom performers
  const sortedByPnl = [...portfolio.holdings].sort((a, b) => b.pnl - a.pnl);
  const top2 = sortedByPnl.slice(0, 2).filter((h) => h.pnl > 0);
  const bottom2 = sortedByPnl.slice(-2).reverse().filter((h) => h.pnl < 0);

  return (
    <div className="mb-6 space-y-4">
      {/* A — Activity stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Trades", value: totalTrades },
          { label: "Markets", value: uniqueMarkets },
          { label: "Volume", value: `$${(totalVolume / 100).toFixed(0)}` },
          { label: "Positions", value: positionCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border bg-card p-3 text-center"
          >
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* B + C — Category chart & Probability profile */}
      {longPositions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* B — Portfolio by Category */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Portfolio by Category</h3>
            <div className="flex flex-col items-center">
              <PieChart width={160} height={160}>
                <Pie
                  data={categoryData}
                  cx={75}
                  cy={75}
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    `$${(value / 100).toFixed(2)}`
                  }
                />
              </PieChart>
              <div className="mt-2 w-full space-y-1">
                {categoryData.map((d, i) => {
                  const pct =
                    totalCategoryValue > 0
                      ? ((d.value / totalCategoryValue) * 100).toFixed(0)
                      : "0";
                  return (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="truncate flex-1 text-muted-foreground">
                        {d.name}
                      </span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* C — Probability Profile */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Probability Profile</h3>
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-5xl font-bold">{Math.round(avgProb)}%</p>
              <p className="text-sm font-medium text-muted-foreground">
                {probabilityLabel(avgProb)}
              </p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round(avgProb)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {positionCount} long position{positionCount !== 1 ? "s" : ""}{" "}
                across {uniqueMarketsInPortfolio} market
                {uniqueMarketsInPortfolio !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* E — Top performers */}
      {hasHoldings && (top2.length > 0 || bottom2.length > 0) && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Top Performers</h3>
          <div className="space-y-1">
            {top2.map((h) => (
              <PerformerRow key={h.securityId} holding={h} positive />
            ))}
            {top2.length > 0 && bottom2.length > 0 && (
              <div className="border-t my-2" />
            )}
            {bottom2.map((h) => (
              <PerformerRow key={h.securityId} holding={h} positive={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PerformerRow({
  holding,
  positive,
}: {
  holding: PortfolioSnapshot["holdings"][0];
  positive: boolean;
}) {
  const pnlDollars = holding.pnl / 100;
  const cost = holding.avgPriceCents * holding.quantity;
  const pct = cost !== 0 ? ((holding.pnl / cost) * 100).toFixed(1) : "–";
  const sign = pnlDollars >= 0 ? "+" : "";

  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{holding.outcome}</p>
        <p className="text-xs text-muted-foreground truncate">{holding.question}</p>
      </div>
      <div className={`text-right ${positive ? "text-green-600" : "text-red-500"}`}>
        <p className="font-medium">
          {sign}${Math.abs(pnlDollars).toFixed(2)}
        </p>
        <p className="text-xs">
          {sign}{pct}%
        </p>
      </div>
    </div>
  );
}
