"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categoryColor } from "@/lib/utils";
import {
  TrendingUp,
  Users,
  Calendar,
  X,
  Pen,
  Gavel,
  ExternalLink,
} from "lucide-react";
import { TradeDialog } from "@/components/trade-dialog";
import { AuthDialog } from "@/components/auth-dialog";
import { SecurityPicker, getUITypeConfig } from "@/components/security-picker";
import { AdminDialogsController } from "@/components/admin-dialogs";
import { marketsApi, type Market, type SettlementInfo } from "@/lib/api";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

interface MarketCardProps {
  initialMarket: Market;
  onMarketUpdate?: () => void;
}

type ViewMode = "individual" | "interval";

export function MarketCard({ initialMarket, onMarketUpdate }: MarketCardProps) {
  const { user } = useAuth();
  const [market, setMarket] = useState(initialMarket);
  const [settlementInfo, setSettlementInfo] = useState<SettlementInfo | null>(
    null,
  );

  // Get UI type configuration
  const uiConfig = getUITypeConfig(initialMarket.uiType);

  // Initialize viewMode based on UI type config
  const [viewMode, setViewMode] = useState<ViewMode>(uiConfig.defaultViewMode);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [intervalRange, setIntervalRange] = useState<[number, number]>([
    -1, -1,
  ]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  // Fetch settlement info if market is resolved and user is authenticated
  useEffect(() => {
    if (market.status === "resolved" && user) {
      marketsApi
        .getSettlementInfo(market.id)
        .catch(() => {
          // Silently fail if info not available
        })
        .then((info) => {
          if (info) setSettlementInfo(info);
        });
    }
  }, [market.id, market.status, user]);

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

    return market.securities.map((security) => {
      const quote = market.quotes.find((q) => q.securityId === security.id);
      return {
        ...security,
        quote: quote || null,
        probability: quote?.impliedProbability || 0,
        quantityTraded: quote?.quantityTraded || 0,
      };
    });
  }, [market?.securities, market?.quotes]);

  const resolutionDate = market?.resolutionDate
    ? format(new Date(market.resolutionDate), "MMM d, yyyy")
    : "—";

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

  const handleMarketUpdated = () => {
    refreshMarket();
    onMarketUpdate?.();
  };

  if (!market) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  const [rangeStart, rangeEnd] = intervalRange;
  const resolvedSelectedOutcome =
    selectedOutcome && outcomes.some((o) => o.id === selectedOutcome)
      ? (outcomes.find((o) => o.id === selectedOutcome) ?? null)
      : rangeStart >= 0 && outcomes[rangeStart]
        ? outcomes[rangeStart]
        : market.winningSecurityId
          ? (outcomes.find((o) => o.id === market.winningSecurityId) ?? null)
          : (outcomes[0] ?? null);
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
        className={`p-6 relative overflow-visible animate-fadeInUp ${
          isRefreshing ? "opacity-70" : ""
        }`}
      >
        {/* Floating interval selection overlay - stick to top of this card */}
        {viewMode === "interval" && rangeStart >= 0 && (
          <div className="absolute -top-3 left-4 right-4 z-10 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg border-2 border-primary">
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
                    className="h-9 bg-white text-primary hover:bg-white/90"
                  >
                    Trade
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetInterval}
                    className="h-9 w-9 p-0 text-primary-foreground hover:bg-primary/80"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <Badge
            variant="secondary"
            className="text-xs text-white"
            style={{ backgroundColor: categoryColor(market.category || "") }}
          >
            {market.category || "Uncategorized"}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>Resolves {resolutionDate}</span>
          </div>
        </div>

        <h3
          className={`font-semibold mb-2 leading-snug text-balance min-h-[3.5rem] ${
            (market.question?.length ?? 0) > 120
              ? "text-sm line-clamp-3"
              : (market.question?.length ?? 0) > 90
                ? "text-base line-clamp-2"
                : "text-lg line-clamp-2"
          }`}
        >
          <Link
            href={`/market/${market.id}`}
            className="group/link hover:underline inline-flex items-start gap-1"
          >
            {market.question || "Untitled Market"}
            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity mt-1" />
          </Link>
        </h3>

        {market.status === "resolved" && market.winningSecurityId && (
          <div className="mb-4">
            <div className="bg-primary/12 border border-primary/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary text-primary-foreground">
                  Resolved
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground">
                Winning Outcome:{" "}
                {
                  outcomes.find((o) => o.id === market.winningSecurityId)
                    ?.outcome
                }
              </p>
              {settlementInfo?.userTotals ? (
                <div className="mt-3 pt-3 border-t border-primary/25">
                  <p className="text-xs text-muted-foreground mb-2">
                    Your Position:
                  </p>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {`${settlementInfo.userTotals.positionCount} settled outcome${settlementInfo.userTotals.positionCount === 1 ? "" : "s"}`}
                    </span>
                    <span
                      className={`text-sm font-bold ${settlementInfo.userTotals.totalPnlCents >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {settlementInfo.userTotals.totalPnlCents >= 0 ? "+" : ""}$
                      {(settlementInfo.userTotals.totalPnlCents / 100).toFixed(
                        2,
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground mt-3">
                This market has been settled and is no longer tradeable.
              </p>
            </div>
          </div>
        )}

        {market.status === "closed" && (
          <div className="mb-4">
            <div className="bg-accent/25 border border-accent/40 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-secondary text-secondary-foreground">
                  Closed
                </Badge>
              </div>
              <p className="text-sm font-medium text-foreground">
                Trading Closed
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No new trades can be placed. Existing positions remain until
                market is resolved.
              </p>
            </div>
          </div>
        )}

        {market.status === "suspended" && (
          <div className="mb-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-destructive text-destructive-foreground">
                  Suspended
                </Badge>
              </div>
              <p className="text-sm font-medium text-destructive">
                Trading Suspended
              </p>
              <p className="text-xs text-destructive/85 mt-1">
                Trading is temporarily halted due to administrative review or
                technical issues.
              </p>
            </div>
          </div>
        )}

        {(market.status === "open" || market.status === "resolved") && (
          <div className="mb-4">
            <SecurityPicker
              outcomes={outcomes}
              uiType={market.uiType}
              selectedRange={intervalRange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              winningSecurityId={market.winningSecurityId ?? undefined}
              readOnly={market.status === "resolved"}
              onRangeChange={(range) => {
                if (market.status === "resolved") {
                  setDialogOpen(true);
                  return;
                }

                setIntervalRange(range);

                if (range[0] === range[1] && range[0] >= 0) {
                  const outcome = outcomes[range[0]];
                  setSelectedOutcome(outcome.id);
                }

                // In individual mode, auto-open dialog when a single outcome is selected
                if (
                  viewMode === "individual" &&
                  range[0] === range[1] &&
                  range[0] >= 0
                ) {
                  const outcome = outcomes[range[0]];
                  setSelectedOutcome(outcome.id);
                  setDialogOpen(true);
                }
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t mt-auto gap-2">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>${(market.totalVolume / 100).toFixed(0)} volume</span>
          </div>
          {user?.role === "admin" &&
            (market.status === "open" || market.status === "closed") && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowEditForm(true)}
                  className="h-8 px-2"
                >
                  <Pen className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSettleForm(true)}
                  className="h-8 px-2"
                >
                  <Gavel className="w-3 h-3" />
                </Button>
              </div>
            )}
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{Math.round(market.openInterest)} shares</span>
          </div>
        </div>
      </Card>

      <TradeDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          // In individual mode, reset lastSelected when dialog closes
          if (!open && viewMode === "individual") {
            setIntervalRange([-1, -1]);
          }
        }}
        market={market}
        historyOnly={market.status === "resolved"}
        defaultTab={market.status === "resolved" ? "history" : "trade"}
        selectedOutcomes={
          market.status === "resolved"
            ? resolvedSelectedOutcome
              ? [resolvedSelectedOutcome]
              : []
            : viewMode === "interval"
              ? selectedOutcomes
              : selectedOutcome
                ? [outcomes.find((o) => o.id === selectedOutcome)!]
                : []
        }
        onSuccess={handleTradeSuccess}
        onSignInClick={() => setAuthDialogOpen(true)}
      />

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      <AdminDialogsController
        market={market}
        showSettleForm={showSettleForm}
        setShowSettleForm={setShowSettleForm}
        showEditForm={showEditForm}
        setShowEditForm={setShowEditForm}
        onSuccess={handleMarketUpdated}
      />
    </>
  );
}
