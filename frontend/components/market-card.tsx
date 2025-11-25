"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BetDialog } from "@/components/bet-dialog";
import { type Market } from "@/lib/api";
import { format } from "date-fns";

export function MarketCard({ market }: { market: Market }) {
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
  const [hoveredOutcome, setHoveredOutcome] = useState<string | null>(null);

  // Combine securities with their quotes
  const outcomes = useMemo(() => {
    return market.securities
      .map((security) => {
        const quote = market.quotes.find((q) => q.securityId === security.id);
        return {
          ...security,
          quote: quote || null,
          probability: quote?.impliedProbability || 0,
          buyPrice: quote?.buyUnitPriceCents || 0,
          sellPrice: quote?.sellUnitPriceCents || 0,
        };
      })
      .sort((a, b) => a.outcome.localeCompare(b.outcome));
  }, [market.securities, market.quotes]);

  const maxProbability = Math.max(...outcomes.map((o) => o.probability));
  const endDate = format(new Date(market.resolutionDate), "MMM d, yyyy");

  const handleOutcomeClick = (outcomeId: string) => {
    setSelectedOutcome(selectedOutcome === outcomeId ? null : outcomeId);
    setBetDialogOpen(true);
  };

  const getBarColor = (outcome: typeof outcomes[0]) => {
    if (selectedOutcome === outcome.id) {
      return tradeMode === "buy"
        ? "bg-green-500 hover:bg-green-600"
        : "bg-red-500 hover:bg-red-600";
    }
    if (hoveredOutcome === outcome.id) {
      return "bg-blue-400";
    }
    return "bg-blue-500/70 hover:bg-blue-500";
  };

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <Badge variant="secondary" className="text-xs">
            {market.category}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{endDate}</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4 leading-snug text-balance">
          {market.question}
        </h3>

        {/* Trade Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={tradeMode === "buy" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTradeMode("buy");
            }}
            className="flex-1"
          >
            <ArrowUpRight className="w-4 h-4 mr-1" />
            Buy
          </Button>
          <Button
            variant={tradeMode === "sell" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTradeMode("sell");
            }}
            className="flex-1"
          >
            <ArrowDownRight className="w-4 h-4 mr-1" />
            Sell
          </Button>
        </div>

        {/* Probability Distribution Chart */}
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-3 font-medium">
            Select Outcome
          </div>

          <div className="space-y-2">
            {outcomes.map((outcome) => {
              const heightPercent =
                maxProbability > 0 ? (outcome.probability / maxProbability) * 100 : 0;

              const isSelected = selectedOutcome === outcome.id;
              const isHovered = hoveredOutcome === outcome.id;

              return (
                <div
                  key={outcome.id}
                  className="relative"
                  onMouseEnter={() => setHoveredOutcome(outcome.id)}
                  onMouseLeave={() => setHoveredOutcome(null)}
                >
                  {/* Bar */}
                  <button
                    onClick={() => handleOutcomeClick(outcome.id)}
                    className={`
                      w-full rounded-lg transition-all duration-200 relative overflow-hidden
                      ${isSelected ? "ring-2 ring-offset-2 ring-primary" : ""}
                    `}
                    style={{ height: "48px" }}
                  >
                    {/* Background bar */}
                    <div
                      className={`absolute inset-0 transition-all duration-300 ${getBarColor(
                        outcome
                      )}`}
                      style={{
                        width: `${heightPercent}%`,
                      }}
                    />

                    {/* Content overlay */}
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-sm font-medium">
                      <span
                        className={heightPercent > 30 ? "text-white" : "text-foreground"}
                      >
                        {outcome.outcome}
                      </span>
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            heightPercent > 30 ? "text-white/90" : "text-muted-foreground"
                          }
                        >
                          {(outcome.probability * 100).toFixed(1)}%
                        </span>
                        <span
                          className={`text-xs font-mono ${
                            heightPercent > 30
                              ? "text-white/80"
                              : "text-muted-foreground"
                          }`}
                        >
                          {outcome.quote?.quantityTraded || 0}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settlement Dates */}
        {market.settlementDates.length > 0 && (
          <div className="mb-4 pb-4 border-b">
            <div className="text-xs text-muted-foreground mb-2">Settlement Dates</div>
            <div className="flex flex-wrap gap-2">
              {market.settlementDates.map((settlement, idx) => (
                <Badge key={idx} variant="outline" className="text-xs font-mono">
                  {settlement.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Market Stats */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>${(market.totalVolume / 100).toFixed(0)} volume</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{Math.round(market.openInterest)} shares</span>
          </div>
        </div>
      </Card>

      <BetDialog
        open={betDialogOpen}
        onOpenChange={setBetDialogOpen}
        market={market}
        outcome={selectedOutcome || ""}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}