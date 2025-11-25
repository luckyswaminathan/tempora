"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Calendar } from "lucide-react";
import { BetDialog } from "@/components/bet-dialog";
import { marketsApi, type Market } from "@/lib/api";
import { format } from "date-fns";

interface MarketCardProps {
  initialMarket: Market;
}

export function MarketCard({ initialMarket }: MarketCardProps) {
  const [market, setMarket] = useState(initialMarket);
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [hoveredOutcome, setHoveredOutcome] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refetch market data after trade
  const refreshMarket = async () => {
    setIsRefreshing(true);
    try {
      const updated = await marketsApi.getMarket(market.id);
      setMarket(updated);
    } catch (error) {
      console.error("Failed to refresh market:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Combine securities with their quotes
  const outcomes = useMemo(() => {
    if (!market?.securities || !market?.quotes) return [];

    return market.securities
      .map((security) => {
        const quote = market.quotes.find((q) => q.securityId === security.id);
        return {
          ...security,
          quote: quote || null,
          probability: quote?.impliedProbability || 0,
          quantityTraded: quote?.quantityTraded || 0,
        };
      })
      .sort((a, b) => a.outcome.localeCompare(b.outcome));
  }, [market?.securities, market?.quotes]);

  const maxProbability = Math.max(...outcomes.map((o) => o.probability), 0);
  const endDate = market?.resolutionDate
    ? format(new Date(market.resolutionDate), "MMM d, yyyy")
    : "—";

  const handleOutcomeClick = (outcomeId: string) => {
    setSelectedOutcome(outcomeId);
    setBetDialogOpen(true);
  };

  const handleTradeSuccess = () => {
    setBetDialogOpen(false);
    refreshMarket(); // ← Update probabilities after trade
  };

  const getBarColor = (outcome: (typeof outcomes)[0]) => {
    if (hoveredOutcome === outcome.id) {
      return "bg-blue-400";
    }
    return "bg-blue-500/70 hover:bg-blue-500";
  };

  // Smart text color based on bar width
  const getTextColor = (widthPercent: number) => {
    // If bar is wide enough (>40%), use white text
    // Otherwise use foreground color
    return widthPercent > 40 ? "text-black" : "text-foreground";
  };

  const getProbabilityTextColor = (widthPercent: number) => {
    return widthPercent > 40 ? "text-black/90" : "text-muted-foreground";
  };

  const getPriceTextColor = (widthPercent: number) => {
    return widthPercent > 40 ? "text-black/80" : "text-muted-foreground";
  };

  // Show loading state if market is not available
  if (!market) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`p-6 hover:shadow-lg transition-shadow ${
          isRefreshing ? "opacity-70" : ""
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <Badge variant="secondary" className="text-xs">
            {market.category || "Uncategorized"}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{endDate}</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4 leading-snug text-balance">
          {market.question || "Untitled Market"}
        </h3>

        {/* Probability Distribution Chart */}
        <div className="mb-4">
          <div className="text-xs text-muted-foreground mb-3 font-medium">
            Click to trade
          </div>

          <div className="space-y-2">
            {outcomes.map((outcome) => {
              const heightPercent =
                maxProbability > 0
                  ? (outcome.probability / maxProbability) * 100
                  : 0;

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
                    className="w-full rounded-lg transition-all duration-200 relative overflow-hidden hover:ring-2 hover:ring-primary hover:ring-offset-2"
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

                    {/* Content overlay - smart text colors based on bar width */}
                    <div className="absolute inset-0 flex items-center justify-between px-3 text-sm font-medium">
                      <span className={getTextColor(heightPercent)}>
                        {outcome.outcome}
                      </span>
                      <div className="flex items-center gap-3">
                        <span
                          className={getProbabilityTextColor(heightPercent)}
                        >
                          {(outcome.probability * 100).toFixed(1)}%
                        </span>
                        <span
                          className={`text-xs font-mono ${getPriceTextColor(
                            heightPercent
                          )}`}
                        >
                          {outcome.quantityTraded}
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
        {market.settlementDates && market.settlementDates.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Settlement Dates
            </div>
            <div className="flex flex-wrap gap-2">
              {market.settlementDates.map((settlement, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs font-mono"
                >
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
        onSuccess={handleTradeSuccess}
      />
    </>
  );
}
