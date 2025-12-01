"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { BetDialog } from "@/components/bet-dialog";
import { marketsApi, type Market } from "@/lib/api";
import { format } from "date-fns";

interface MarketCardProps {
  initialMarket: Market;
}

type ViewMode = "individual" | "interval";

export function MarketCard({ initialMarket }: MarketCardProps) {
  const [market, setMarket] = useState(initialMarket);
  const [viewMode, setViewMode] = useState<ViewMode>("individual");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [hoveredOutcome, setHoveredOutcome] = useState<string | null>(null);
  const [intervalRange, setIntervalRange] = useState<[number, number]>([
    -1, -1,
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const handleBarClick = (index: number) => {
    if (viewMode === "interval") {
      const [start, end] = intervalRange;

      if (start === -1) {
        // First click - set both start and end to same index
        setIntervalRange([index, index]);
      } else {
        // Already have a selection - update the range
        // User can click anywhere to extend/shrink the range
        setIntervalRange([Math.min(start, index), Math.max(start, index)]);
      }
    } else {
      // Individual mode - open dialog immediately with single outcome
      const outcome = outcomes[index];
      setSelectedOutcome(outcome.id);
      setDialogOpen(true);
    }
  };

  const handleOpenIntervalDialog = () => {
    if (intervalRange[0] >= 0) {
      setDialogOpen(true);
    }
  };

  const handleResetInterval = () => {
    setIntervalRange([-1, -1]);
  };

  const handleTradeSuccess = () => {
    setDialogOpen(false);
    setIntervalRange([-1, -1]);
    refreshMarket();
  };

  const getBarColor = (index: number) => {
    if (viewMode === "interval") {
      const [start, end] = intervalRange;
      if (start >= 0 && end >= 0 && index >= start && index <= end) {
        return "bg-green-500/70 hover:bg-green-500";
      }
    }
    if (hoveredOutcome === outcomes[index]?.id) {
      return "bg-blue-400";
    }
    return "bg-blue-500/70 hover:bg-blue-500";
  };

  if (!market) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  const [rangeStart, rangeEnd] = intervalRange;
  const selectedOutcomes =
    rangeStart >= 0 && rangeEnd >= 0
      ? outcomes.slice(rangeStart, rangeEnd + 1)
      : [];
  const intervalText =
    rangeStart >= 0 && rangeEnd >= 0
      ? rangeStart === rangeEnd
        ? outcomes[rangeStart]?.outcome
        : `${outcomes[rangeStart]?.outcome} - ${outcomes[rangeEnd]?.outcome}`
      : "";

  return (
    <>
      <Card
        className={`p-6 hover:shadow-lg transition-shadow relative ${
          isRefreshing ? "opacity-70" : ""
        }`}
      >
        {/* Floating interval selection overlay - stick to top of this card */}
        {viewMode === "interval" && rangeStart >= 0 && (
          <div className="absolute -top-3 left-4 right-4 z-10 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-gradient-to-r from-green-500 to-green-400 text-white px-4 py-3 rounded-lg shadow-lg border-2 border-green-400">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold mb-1 truncate">
                    {intervalText}
                  </div>
                  <div className="text-xs opacity-90">
                    {selectedOutcomes.length} outcome
                    {selectedOutcomes.length !== 1 ? "s" : ""} selected
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={handleOpenIntervalDialog}
                    className="h-9 bg-white text-green-600 hover:bg-green-50"
                  >
                    Trade
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetInterval}
                    className="h-9 w-9 p-0 text-white hover:bg-green-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

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

        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === "individual" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("individual");
              setIntervalRange([-1, -1]);
            }}
            className="flex-1"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            Individual
          </Button>
          <Button
            variant={viewMode === "interval" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("interval");
              setIntervalRange([-1, -1]);
            }}
            className="flex-1"
          >
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            Interval
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mb-3 font-medium">
          {viewMode === "individual"
            ? "Click to trade individual outcomes"
            : rangeStart === -1
            ? "Click to select interval start"
            : "Click another outcome to adjust interval range"}
        </div>

        <div className="mb-4">
          <div className="space-y-2">
            {outcomes.map((outcome, index) => {
              const widthPercent =
                maxProbability > 0
                  ? (outcome.probability / maxProbability) * 100
                  : 0;
              const showInside = widthPercent > 50;
              const isInInterval =
                viewMode === "interval" &&
                rangeStart >= 0 &&
                index >= rangeStart &&
                index <= rangeEnd;

              return (
                <button
                  key={outcome.id}
                  onClick={() => handleBarClick(index)}
                  onMouseEnter={() => setHoveredOutcome(outcome.id)}
                  onMouseLeave={() => setHoveredOutcome(null)}
                  className={`w-full h-12 rounded-lg transition-all duration-200 relative hover:ring-2 hover:ring-offset-2 overflow-visible ${
                    isInInterval
                      ? "ring-2 ring-green-500"
                      : "hover:ring-primary"
                  }`}
                >
                  <div
                    className={`absolute left-0 top-0 h-full rounded-lg transition-all duration-300 ${getBarColor(
                      index
                    )}`}
                    style={{ width: `${widthPercent}%` }}
                  />

                  <div className="absolute left-3 top-0 h-full flex items-center text-sm font-medium z-10">
                    <span
                      className={showInside ? "text-white" : "text-foreground"}
                    >
                      {outcome.outcome}
                    </span>
                  </div>

                  <div
                    className="absolute top-0 h-full flex items-center gap-3 text-sm z-10 transition-all duration-300"
                    style={
                      showInside
                        ? { right: "12px" }
                        : { left: `calc(${widthPercent}% + 12px)` }
                    }
                  >
                    <span
                      className={
                        showInside ? "text-white/90" : "text-muted-foreground"
                      }
                    >
                      {(outcome.probability * 100).toFixed(1)}%
                    </span>
                    <span
                      className={`text-xs font-mono ${
                        showInside ? "text-white/80" : "text-muted-foreground"
                      }`}
                    >
                      {outcome.quantityTraded}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {market.settlementDates && market.settlementDates.length > 0 && (
          <div className="mb-4">
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        market={market}
        selectedOutcomes={
          viewMode === "interval"
            ? selectedOutcomes
            : selectedOutcome
            ? [outcomes.find((o) => o.id === selectedOutcome)!]
            : []
        }
        onSuccess={handleTradeSuccess}
      />
    </>
  );
}
