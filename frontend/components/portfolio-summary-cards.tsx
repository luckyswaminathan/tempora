"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { PortfolioSnapshot } from "@/lib/api";
import { usersApi } from "@/lib/api";

type ChartPoint = { t: string; v: number; ts: number };

function formatYTick(cents: number): string {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
  return `$${d.toFixed(0)}`;
}

function formatTick(ts: number, days: number): string {
  const d = new Date(ts);
  if (days === 1) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days <= 7) return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  if (days <= 90) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

interface PortfolioSummaryCardsProps {
  portfolio: PortfolioSnapshot;
  walletHistory?: Array<{ t: string; v: number }>;
}

const PERIODS: { label: string; days: number }[] = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "All", days: 0 },
];

function formatBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PortfolioSummaryCards({
  portfolio,
  walletHistory,
}: PortfolioSummaryCardsProps) {
  const [selectedDays, setSelectedDays] = useState(30);
  const [chartData, setChartData] = useState<ChartPoint[]>(
    walletHistory?.map((p) => ({ ...p, ts: new Date(p.t).getTime() })) ?? [],
  );

  // When period changes, re-fetch
  useEffect(() => {
    usersApi
      .getWalletHistory(selectedDays)
      .then((res) => setChartData(res.data.map((p) => ({ ...p, ts: new Date(p.t).getTime() }))))
      .catch(() => {});
  }, [selectedDays]);

  // Seed initial data from prop (avoids extra fetch on mount)
  useEffect(() => {
    if (walletHistory && walletHistory.length > 0) {
      setChartData(walletHistory.map((p) => ({ ...p, ts: new Date(p.t).getTime() })));
    }
  }, [walletHistory]);

  const yMin = chartData.length > 0 ? Math.min(...chartData.map((p) => p.v)) : 0;
  const yMax = chartData.length > 0 ? Math.max(...chartData.map((p) => p.v)) : 10000;
  const yPad = Math.max((yMax - yMin) * 0.1, 500);
  const yDomain: [number, number] = [yMin - yPad, yMax + yPad];

  return (
    <>
      {/* Main Spendable Balance Card */}
      <Card className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        {/* Header row: text block + wallet icon */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground mb-1">
              Spendable Balance
            </div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              ${(portfolio.spendableBalance / 100.0).toFixed(2)}
            </div>
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between gap-4">
                <span>Total wallet:</span>
                <span className="font-mono">
                  ${(portfolio.wallet / 100.0).toFixed(2)}
                </span>
              </div>
              {portfolio.collateralLocked > 0 && (
                <div className="flex justify-between gap-4 text-amber-600">
                  <span>Collateral locked:</span>
                  <span className="font-mono">
                    -${(portfolio.collateralLocked / 100.0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full flex-shrink-0">
            <Wallet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Time filter buttons — full width */}
        <div className="flex gap-1 mt-4">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setSelectedDays(p.days)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                selectedDays === p.days
                  ? "bg-blue-600 text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-blue-100 dark:hover:bg-blue-900/30"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Balance chart — full card width */}
        <div className="mt-2 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 2, right: 4, left: 4, bottom: 16 }}
            >
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickCount={4}
                tickFormatter={(ts: number) => formatTick(ts, selectedDays)}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={formatYTick}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickCount={4}
                width={48}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0].payload as ChartPoint;
                    return (
                      <div className="bg-background border rounded px-2 py-1 text-xs shadow">
                        <div className="font-medium">{formatBalance(point.v)}</div>
                        <div className="text-muted-foreground">{formatDate(point.t)}</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="linear"
                dataKey="v"
                stroke="#3b82f6"
                strokeWidth={1.5}
                fill="url(#balanceGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}
