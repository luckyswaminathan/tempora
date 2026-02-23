"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";
import type { PortfolioSnapshot } from "@/lib/api";
import { usersApi } from "@/lib/api";

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
  const [chartData, setChartData] = useState<Array<{ t: string; v: number }>>(
    walletHistory ?? [],
  );

  // When period changes, re-fetch
  useEffect(() => {
    usersApi
      .getWalletHistory(selectedDays)
      .then((res) => setChartData(res.data))
      .catch(() => {});
  }, [selectedDays]);

  // Seed initial data from prop (avoids extra fetch on mount)
  useEffect(() => {
    if (walletHistory && walletHistory.length > 0) {
      setChartData(walletHistory);
    }
  }, [walletHistory]);

  return (
    <>
      {/* Main Spendable Balance Card */}
      <Card className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
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

            {/* Time filter buttons */}
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

            {/* Balance chart */}
            <div className="mt-2 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
                >
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const point = payload[0].payload as { t: string; v: number };
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
                    type="monotone"
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
          </div>
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full flex-shrink-0">
            <Wallet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </Card>
    </>
  );
}
