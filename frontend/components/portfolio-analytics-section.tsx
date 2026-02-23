"use client";

import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
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

  const extremePositions = [...longPositions]
    .sort((a, b) =>
      avgProb < 50
        ? a.avgPriceCents - b.avgPriceCents
        : b.avgPriceCents - a.avgPriceCents,
    )
    .slice(0, 5);

  // E — Top / bottom performers
  const sortedByPnl = [...portfolio.holdings].sort((a, b) => b.pnl - a.pnl);
  const top2 = sortedByPnl.slice(0, 2).filter((h) => h.pnl > 0);
  const bottom2 = sortedByPnl.slice(-2).reverse().filter((h) => h.pnl < 0);

  return (
    <div className="mb-6 space-y-4">
      {/* A — Merged top row: portfolio metrics + activity stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Left: portfolio metrics */}
        <Card className="p-5 gap-0">
          <div className="grid grid-cols-2 gap-4">
            <div id="pnl-cost-basis">
              <div className="text-xs text-muted-foreground">Cost Basis</div>
              <div className="text-2xl font-semibold">
                ${(portfolio.summary.costBasis / 100.0).toFixed(2)}
              </div>
            </div>
            <div id="pnl-market-value">
              <div className="text-xs text-muted-foreground">Market Value</div>
              <div className="text-2xl font-semibold">
                ${(portfolio.summary.marketValue / 100.0).toFixed(2)}
              </div>
            </div>
            <div id="pnl-unrealized">
              <div className="text-xs text-muted-foreground">P&L</div>
              <div
                className={`text-2xl font-semibold ${
                  portfolio.summary.unrealisedPnL >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ${(portfolio.summary.unrealisedPnL / 100.0).toFixed(2)}
              </div>
            </div>
            <div id="pnl-roi">
              <div className="text-xs text-muted-foreground">ROI</div>
              <div
                className={`text-2xl font-semibold ${
                  portfolio.summary.roi >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {portfolio.summary.roi.toFixed(1)}%
              </div>
            </div>
          </div>
        </Card>
        {/* Right: activity stats */}
        <Card className="p-5 gap-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Total Trades</div>
              <div className="text-2xl font-semibold">{totalTrades}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Markets</div>
              <div className="text-2xl font-semibold">{uniqueMarkets}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Volume</div>
              <div className="text-2xl font-semibold">${(totalVolume / 100).toFixed(0)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Positions</div>
              <div className="text-2xl font-semibold">{positionCount}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* B + C — Category chart & Probability profile */}
      {longPositions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* B — Portfolio by Category */}
          <Card className="p-4 gap-0">
            <h3 className="text-sm font-semibold mb-3">Portfolio by Category</h3>
            <div className="grid grid-cols-3 items-center gap-4">
              {/* Col 1 — pie chart (1/3) */}
              <div className="flex justify-center items-center">
                <PieChart width={120} height={120}>
                  <Pie
                    data={categoryData}
                    cx={55}
                    cy={55}
                    innerRadius={35}
                    outerRadius={55}
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
              </div>
              {/* Col 2–3 — legend (2/3) */}
              <div className="col-span-2 flex flex-col gap-1.5">
                {categoryData.map((d, i) => {
                  const pct =
                    totalCategoryValue > 0
                      ? ((d.value / totalCategoryValue) * 100).toFixed(0)
                      : "0";
                  return (
                    <div key={d.name} className="flex items-center justify-between gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <span className="truncate text-muted-foreground flex-1">
                        {d.name}
                      </span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* C — Probability Profile */}
          <Card className="p-4 gap-0">
            <h3 className="text-sm font-semibold mb-3">Probability Profile</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Col 1 — % + label (1/3) */}
              <div className="flex flex-col justify-center gap-1">
                <p className="text-5xl font-bold">{Math.round(avgProb)}%</p>
                <p className="text-sm text-muted-foreground">
                  {probabilityLabel(avgProb)}
                </p>
              </div>
              {/* Col 2–3 — defining positions (2/3) */}
              <div className="col-span-2 flex flex-col gap-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">Defining Positions</p>
                {extremePositions.map((h) => (
                  <div key={h.securityId} className="flex justify-between text-sm gap-2">
                    <span className="truncate">{h.outcome}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      @ {Math.round(h.avgPriceCents / 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* E — Top performers */}
      {hasHoldings && (top2.length > 0 || bottom2.length > 0) && (
        <Card className="p-4 gap-0">
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
        </Card>
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
