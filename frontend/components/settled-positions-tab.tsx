"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { categoryColor } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";

interface SettledPosition {
  marketId: string;
  question: string;
  category: string;
  securityId: string;
  outcome: string;
  quantity: number;
  costBasisCents: number;
  payoutCents: number;
  pnlCents: number;
  winningOutcome: string;
  settlementDate: string;
}

interface MarketGroup {
  marketId: string;
  question: string;
  category: string;
  resolutionDate: string;
  positions: SettledPosition[];
  totalPnl: number;
  totalCost: number;
  totalPayout: number;
}

interface SettledPositionsTabProps {
  positions: SettledPosition[];
  onOpenOutcomeDetail?: (
    marketId: string,
    securityId: string,
    outcome: string,
  ) => void;
}

export function SettledPositionsTab({
  positions,
  onOpenOutcomeDetail,
}: SettledPositionsTabProps) {
  // Group positions by market
  const marketGroups = useMemo(() => {
    const grouped = new Map<string, MarketGroup>();

    positions.forEach((pos) => {
      const existing = grouped.get(pos.marketId);
      if (existing) {
        existing.positions.push(pos);
        existing.totalPnl += pos.pnlCents;
        existing.totalCost += pos.costBasisCents;
        existing.totalPayout += pos.payoutCents;
      } else {
        grouped.set(pos.marketId, {
          marketId: pos.marketId,
          question: pos.question,
          category: pos.category,
          resolutionDate: pos.settlementDate,
          positions: [pos],
          totalPnl: pos.pnlCents,
          totalCost: pos.costBasisCents,
          totalPayout: pos.payoutCents,
        });
      }
    });

    return Array.from(grouped.values());
  }, [positions]);

  if (marketGroups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground mb-2">No settled positions yet</p>
        <p className="text-sm text-muted-foreground">
          Your settled positions in resolved markets will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {marketGroups.map((group) => {
        const isProfitable = group.totalPnl >= 0;

        return (
          <Card key={group.marketId} className="flex flex-col overflow-hidden">
            {/* Market Header */}
            <div className="p-4 border-b">
              <Link
                href={`/market/${group.marketId}`}
                className="group/link inline-flex items-start gap-1 font-medium leading-snug text-balance line-clamp-2 mb-2 hover:underline"
              >
                {group.question}
                <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity mt-0.5" />
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <Calendar className="w-3 h-3" />
                <span>
                  {format(new Date(group.resolutionDate), "MMM d, yyyy")}
                </span>
                <Badge
                  variant="secondary"
                  className="ml-auto text-white"
                  style={{ backgroundColor: categoryColor(group.category) }}
                >
                  {group.category}
                </Badge>
              </div>
            </div>

            {/* Settled Positions List */}
            <div className="px-3 py-2 space-y-1 max-h-64 overflow-y-auto flex-1">
              {group.positions.map((pos) => {
                const won = pos.payoutCents > 0;
                return (
                  <button
                    key={`${pos.marketId}:${pos.securityId}`}
                    onClick={() => {
                      if (onOpenOutcomeDetail) {
                        onOpenOutcomeDetail(
                          pos.marketId,
                          pos.securityId,
                          pos.outcome,
                        );
                      }
                    }}
                    className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge
                        variant="secondary"
                        className={`font-mono text-xs px-1.5 py-0 h-5 shrink-0 ${
                          won
                            ? "bg-green-600/20 text-green-700 border-green-200"
                            : "bg-red-600/20 text-red-700 border-red-200"
                        }`}
                      >
                        {pos.outcome}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <span className="text-muted-foreground">
                        {pos.quantity} shares
                      </span>
                      <span
                        className={`font-medium tabular-nums ${
                          pos.pnlCents >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {pos.pnlCents >= 0 ? "+" : ""}$
                        {(pos.pnlCents / 100).toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Settlement Summary */}
            <div className="px-3 py-2 bg-muted/50 border-t space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-medium">
                  ${(group.totalCost / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Payout</span>
                <span className="font-medium">
                  ${(group.totalPayout / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-1.5">
                <span className="text-muted-foreground font-medium">P&L</span>
                <div
                  className={`flex items-center gap-1 font-semibold ${
                    isProfitable ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isProfitable ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {isProfitable ? "+" : ""}${(group.totalPnl / 100).toFixed(2)}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
