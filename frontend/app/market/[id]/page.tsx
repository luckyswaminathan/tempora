"use client";

import { use, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Calendar,
  Wallet,
  History,
  X,
  TrendingDown,
  CheckCircle2,
  Pen,
  Gavel,
} from "lucide-react";
import {
  marketsApi,
  ordersApi,
  usersApi,
  type Market,
  type PortfolioSnapshot,
  type OrderRecord,
  type SettlementInfo,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { SecurityPicker, getUITypeConfig } from "@/components/security-picker";
import { TradeDialog } from "@/components/trade-dialog";
import { AuthDialog } from "@/components/auth-dialog";
import { OrderDetailSheet } from "@/components/order-detail-sheet";
import { HistoryTab } from "@/components/history-tab";
import { HoldingsTab } from "@/components/holdings-tab";
import { OutcomeDetailSheet } from "@/components/outcome-detail-sheet";
import { AdminDialogsController } from "@/components/admin-dialogs";
import { format } from "date-fns";
import { categoryColor } from "@/lib/utils";

export default function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Market data
  const [market, setMarket] = useState<Market | null>(null);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [settlementInfo, setSettlementInfo] = useState<SettlementInfo | null>(
    null,
  );

  // User data
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [marketOrders, setMarketOrders] = useState<OrderRecord[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [loadingMarketOrders, setLoadingMarketOrders] = useState(false);

  // Trade UI state (same pattern as MarketCard)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [intervalRange, setIntervalRange] = useState<[number, number]>([
    -1, -1,
  ]);
  const [viewMode, setViewMode] = useState<"individual" | "interval">(
    "individual",
  );
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(
    null,
  );

  // Order detail sheet
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Outcome detail sheet
  const [selectedOutcome, setSelectedOutcome] = useState<{
    marketId: string;
    securityId: string;
    holding: PortfolioSnapshot["holdings"][0];
  } | null>(null);
  const [tradeHistory, setTradeHistory] = useState<
    Record<string, OrderRecord[]>
  >({});
  const [loadingHistory, setLoadingHistory] = useState<Set<string>>(new Set());
  const [marketTab, setMarketTab] = useState(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl === "orders") return "history";
    if (tabFromUrl) return tabFromUrl;
    // Default to position tab
    return "position";
  });
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleMarketTabChange = useCallback(
    (tab: string) => {
      setMarketTab(tab);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      requestAnimationFrame(() => {
        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [pathname, router, searchParams],
  );

  const fetchTradeHistory = useCallback(async (marketId: string) => {
    setLoadingHistory((prev) => new Set(prev).add(marketId));
    try {
      const response = await ordersApi.listOrders({ marketId });
      setTradeHistory((prev) => ({ ...prev, [marketId]: response.items }));
    } catch (err) {
      console.error("Failed to fetch trade history:", err);
    } finally {
      setLoadingHistory((prev) => {
        const next = new Set(prev);
        next.delete(marketId);
        return next;
      });
    }
  }, []);

  // Fetch market
  useEffect(() => {
    async function fetchMarket() {
      try {
        setLoadingMarket(true);
        const data = await marketsApi.getMarket(id);
        setMarket(data);
        setViewMode(getUITypeConfig(data.uiType).defaultViewMode);
      } catch (err) {
        setMarketError(
          err instanceof Error ? err.message : "Failed to load market",
        );
      } finally {
        setLoadingMarket(false);
      }
    }
    fetchMarket();
  }, [id]);

  // Fetch settlement info if market is resolved and user is authenticated
  useEffect(() => {
    if (market?.status === "resolved" && user) {
      marketsApi
        .getSettlementInfo(id)
        .catch(() => {
          // Silently fail if info not available
        })
        .then((info) => {
          if (info) setSettlementInfo(info);
        });
      return;
    }

    setSettlementInfo(null);
  }, [id, market?.status, user]);

  const refreshMarket = useCallback(async () => {
    try {
      const data = await marketsApi.getMarket(id);
      setMarket(data);
    } catch {}
  }, [id]);

  // Fetch user-specific data
  const fetchUserData = useCallback(async () => {
    if (!user) return;
    setLoadingUserData(true);
    try {
      const [portfolioData, ordersData] = await Promise.all([
        usersApi.getPortfolio(),
        ordersApi.listOrders({ marketId: id }),
      ]);
      setPortfolio(portfolioData);
      setOrders(ordersData.items);
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    } finally {
      setLoadingUserData(false);
    }
  }, [user, id]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Derived outcomes with quotes
  const outcomes = useMemo(() => {
    if (!market?.securities || !market?.quotes) return [];
    return market.securities.map((security) => {
      const quote = market.quotes.find((q) => q.securityId === security.id);
      return {
        ...security,
        quote: quote ?? null,
        probability: quote?.impliedProbability ?? 0,
        quantityTraded: quote?.quantityTraded ?? 0,
      };
    });
  }, [market?.securities, market?.quotes]);

  useEffect(() => {
    if (
      (market?.status !== "resolved" && market?.status !== "closed") ||
      outcomes.length === 0
    ) {
      return;
    }

    if (viewMode !== "individual") {
      setViewMode("individual");
    }

    if (market?.status === "closed") {
      return;
    }

    const winningIndex = market.winningSecurityId
      ? outcomes.findIndex((o) => o.id === market.winningSecurityId)
      : -1;
    const fallbackIndex = winningIndex >= 0 ? winningIndex : 0;
    const fallbackOutcome = outcomes[fallbackIndex];

    if (!fallbackOutcome) return;

    const shouldSetSelection =
      intervalRange[0] < 0 || intervalRange[1] < 0 || !selectedOutcomeId;

    if (shouldSetSelection) {
      setIntervalRange([fallbackIndex, fallbackIndex]);
      setSelectedOutcomeId(fallbackOutcome.id);
    }
  }, [
    market?.status,
    market?.winningSecurityId,
    outcomes,
    intervalRange,
    selectedOutcomeId,
    viewMode,
  ]);

  useEffect(() => {
    if (market?.status === "closed") {
      setIntervalRange([-1, -1]);
      setSelectedOutcomeId(null);
    }
  }, [id, market?.status]);

  // Holdings for this market only
  const myHoldings = useMemo(
    () => portfolio?.holdings.filter((h) => h.marketId === id) ?? [],
    [portfolio?.holdings, id],
  );
  const mySettledPositions = useMemo(
    () => portfolio?.settledPositions.filter((p) => p.marketId === id) ?? [],
    [portfolio?.settledPositions, id],
  );
  const totalPnl = myHoldings.reduce((s, h) => s + h.pnl, 0);
  const resolvedHoldings = useMemo(
    () =>
      mySettledPositions.map((position) => ({
        marketId: position.marketId,
        securityId: position.securityId,
        question: position.question,
        outcome: position.outcome,
        avgPriceCents:
          position.quantity !== 0
            ? position.costBasisCents / position.quantity
            : 0,
        quantity: position.quantity,
        markPriceCents:
          position.quantity !== 0
            ? position.payoutCents / position.quantity
            : 0,
        endDate: format(new Date(position.settlementDate), "MMM d, yyyy"),
        pnl: position.pnlCents,
        category: position.category,
      })),
    [mySettledPositions],
  );
  const settledTotalCost = mySettledPositions.reduce(
    (sum, position) => sum + position.costBasisCents,
    0,
  );
  const settledTotalPayout = mySettledPositions.reduce(
    (sum, position) => sum + position.payoutCents,
    0,
  );
  const settledTotalPnl = mySettledPositions.reduce(
    (sum, position) => sum + position.pnlCents,
    0,
  );
  const hasUserSettlementDetails =
    !!settlementInfo?.userTotals || mySettledPositions.length > 0;
  const isMarketMakerView =
    !!user && user.role === "market_maker" && user.id === market?.creatorId;
  const payoutDistribution = settlementInfo?.payoutDistribution ?? [];
  const hasPayoutDistribution = payoutDistribution.length > 0;
  const hasMakerSettlementSummary =
    isMarketMakerView &&
    (settlementInfo?.marketTotalRevenueCents !== undefined ||
      settlementInfo?.marketTotalPayoutCents !== undefined ||
      settlementInfo?.marketNetPnlCents !== undefined);

  useEffect(() => {
    if (marketTab === "maker-settlement" && !isMarketMakerView) {
      setMarketTab("position");
    }
    if (marketTab === "market-history" && !isMarketMakerView) {
      setMarketTab("position");
    }
  }, [marketTab, isMarketMakerView]);

  useEffect(() => {
    if (!user || !isMarketMakerView) {
      setMarketOrders([]);
      return;
    }

    setLoadingMarketOrders(true);
    ordersApi
      .listMarketHistory(id)
      .then((response) => {
        setMarketOrders(response.items);
      })
      .catch((err) => {
        console.error("Failed to fetch market history:", err);
        setMarketOrders([]);
      })
      .finally(() => setLoadingMarketOrders(false));
  }, [id, user, isMarketMakerView]);

  // Orders by status
  const pendingOrders = useMemo(
    () => orders.filter((o) => !o.filled && !o.canceled),
    [orders],
  );
  const historyOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [orders],
  );

  // Selected outcomes for TradeDialog
  const [rangeStart, rangeEnd] = intervalRange;
  const dialogOutcomes = useMemo(() => {
    if (viewMode === "interval") {
      return rangeStart >= 0 && rangeEnd >= 0
        ? outcomes.slice(rangeStart, rangeEnd + 1)
        : [];
    }
    return selectedOutcomeId
      ? outcomes.filter((o) => o.id === selectedOutcomeId)
      : [];
  }, [viewMode, intervalRange, selectedOutcomeId, outcomes]);

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      try {
        setCancellingOrder(orderId);
        await ordersApi.cancelOrder(orderId);
        setSelectedOrder(null);
        await fetchUserData();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to cancel order");
      } finally {
        setCancellingOrder(null);
      }
    },
    [fetchUserData],
  );

  // ── Loading / error states ───────────────────────────────────────────────
  if (loadingMarket) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-20" />
          <div className="h-10 bg-muted rounded w-2/3" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (marketError || !market) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center py-12">
        <p className="text-muted-foreground mb-4">
          {marketError ?? "Market not found"}
        </p>
        <Button variant="link" onClick={() => router.back()}>
          ← Go back
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl animate-stagger">
        {/* Back */}
        <div className="mb-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="-ml-2 gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        {/* Market header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge
              variant="secondary"
              className="text-white"
              style={{ backgroundColor: categoryColor(market.category || "") }}
            >
              {market.category}
            </Badge>
            {user?.role === "admin" &&
              (market.status === "open" ||
                market.status === "closed" ||
                market.status === "suspended") && (
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
            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
              <Calendar className="w-3 h-3" />
              Resolves{" "}
              {format(
                new Date(market.resolutionDate),
                "MMM d, yyyy 'at' h:mm:ss a",
              )}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-snug text-balance">
            {market.question}
          </h1>
          {market.description && (
            <p className="text-muted-foreground mt-2 text-sm">
              {market.description}
            </p>
          )}
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />$
              {(market.totalVolume / 100).toFixed(0)} volume
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {Math.round(market.openInterest)} shares outstanding
            </span>
          </div>
        </div>

        {/* Status banners for non-open markets */}
        {market.status === "resolved" && market.winningSecurityId && (
          <Card className="p-4 mb-6 bg-primary/12 border border-primary/30">
            <div
              className={
                hasUserSettlementDetails ||
                hasPayoutDistribution ||
                hasMakerSettlementSummary
                  ? "mb-4"
                  : ""
              }
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Resolved
                </span>
                <span className="text-sm font-medium text-foreground">
                  Winning outcome:{" "}
                  {outcomes.find((o) => o.id === market.winningSecurityId)
                    ?.outcome ?? "—"}
                </span>
              </div>
            </div>
            {hasUserSettlementDetails && (
              <div className="pt-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  Your Settlement
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Your Position
                    </p>
                    <p className="font-medium text-foreground">
                      {settlementInfo?.userTotals ? (
                        <>
                          {settlementInfo.userTotals.positionCount} settled
                          outcome
                          {settlementInfo.userTotals.positionCount !== 1
                            ? "s"
                            : ""}
                        </>
                      ) : mySettledPositions.length > 0 ? (
                        <>
                          {mySettledPositions.length} settled outcome
                          {mySettledPositions.length !== 1 ? "s" : ""}
                        </>
                      ) : (
                        <>0 settled outcomes</>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Cost Basis
                    </p>
                    <p className="font-medium text-foreground">
                      $
                      {(
                        (settlementInfo?.userTotals
                          ? settlementInfo.userTotals.totalCostCents
                          : mySettledPositions.length > 0
                            ? settledTotalCost
                            : 0) / 100
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Payout</p>
                    <p className="font-medium text-foreground">
                      $
                      {(
                        (settlementInfo?.userTotals
                          ? settlementInfo.userTotals.totalPayoutCents
                          : mySettledPositions.length > 0
                            ? settledTotalPayout
                            : 0) / 100
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">P&L</p>
                    <p
                      className={`font-medium ${
                        (settlementInfo?.userTotals
                          ? settlementInfo.userTotals.totalPnlCents
                          : mySettledPositions.length > 0
                            ? settledTotalPnl
                            : 0) > 0
                          ? "text-primary"
                          : "text-destructive"
                      }`}
                    >
                      {(settlementInfo?.userTotals
                        ? settlementInfo.userTotals.totalPnlCents
                        : mySettledPositions.length > 0
                          ? settledTotalPnl
                          : 0) >= 0
                        ? "+"
                        : ""}
                      $
                      {(
                        (settlementInfo?.userTotals
                          ? settlementInfo.userTotals.totalPnlCents
                          : mySettledPositions.length > 0
                            ? settledTotalPnl
                            : 0) / 100
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {hasMakerSettlementSummary && (
              <div className={`pt-4 ${hasUserSettlementDetails ? "mt-4" : ""}`}>
                <h4 className="text-sm font-semibold text-foreground mb-3">
                  Market Maker Settlement
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Revenue
                    </p>
                    <p className="font-medium text-foreground">
                      $
                      {(
                        (settlementInfo?.marketTotalRevenueCents ?? 0) / 100
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Net Transfer
                    </p>
                    <p className="font-medium text-foreground">
                      $
                      {(
                        (settlementInfo?.marketTotalPayoutCents ?? 0) / 100
                      ).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Net P&amp;L
                    </p>
                    <p
                      className={`font-medium ${(settlementInfo?.marketNetPnlCents ?? 0) >= 0 ? "text-primary" : "text-destructive"}`}
                    >
                      {(settlementInfo?.marketNetPnlCents ?? 0) >= 0 ? "+" : ""}
                      $
                      {((settlementInfo?.marketNetPnlCents ?? 0) / 100).toFixed(
                        2,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">
                      Users Settled
                    </p>
                    <p className="font-medium text-foreground">
                      {payoutDistribution.length}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}
        {market.status === "closed" && (
          <Card className="p-4 mb-6 bg-accent/25 border border-accent/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-secondary">
                Closed
              </span>
              <span className="text-sm font-medium text-foreground">
                Trading closed — positions remain until resolution.
              </span>
            </div>
          </Card>
        )}
        {market.status === "suspended" && (
          <Card className="p-4 mb-6 bg-destructive/10 border border-destructive/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-destructive">
                Suspended
              </span>
              <span className="text-sm font-medium text-foreground">
                Trading is temporarily halted.
              </span>
            </div>
          </Card>
        )}

        {/* Outcome selector (open trading + resolved/closed history view) */}
        {(market.status === "open" ||
          market.status === "resolved" ||
          market.status === "closed") && (
          <Card className="p-4 mb-6">
            <SecurityPicker
              outcomes={outcomes}
              uiType={market.uiType}
              selectedRange={intervalRange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              winningSecurityId={market.winningSecurityId ?? undefined}
              readOnly={
                market.status === "resolved" || market.status === "closed"
              }
              onRangeChange={(range) => {
                if (
                  market.status === "resolved" ||
                  market.status === "closed"
                ) {
                  if (range[0] >= 0 && range[0] === range[1]) {
                    setSelectedOutcomeId(outcomes[range[0]].id);
                    setDialogOpen(true);
                  }
                  return;
                }

                setIntervalRange(range);

                if (range[0] >= 0 && range[0] === range[1]) {
                  setSelectedOutcomeId(outcomes[range[0]].id);
                }

                if (
                  viewMode === "individual" &&
                  range[0] === range[1] &&
                  range[0] >= 0
                ) {
                  setSelectedOutcomeId(outcomes[range[0]].id);
                  setDialogOpen(true);
                }
              }}
            />
            {market.status === "open" &&
              viewMode === "interval" &&
              rangeStart >= 0 &&
              rangeEnd >= 0 && (
                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => setDialogOpen(true)}
                  >
                    Trade {dialogOutcomes.length} outcome
                    {dialogOutcomes.length !== 1 ? "s" : ""}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIntervalRange([-1, -1])}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
          </Card>
        )}

        {/* User sections */}
        {user ? (
          <div ref={tabsRef} className="scroll-mt-24">
            <Tabs
              value={marketTab}
              onValueChange={handleMarketTabChange}
              className="w-full"
            >
              <TabsList className="mb-4">
                <TabsTrigger value="position" className="gap-2">
                  <Wallet className="w-4 h-4" />
                  My Position
                  {(market.status === "resolved"
                    ? mySettledPositions.length > 0
                    : myHoldings.length > 0) && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {market.status === "resolved"
                        ? mySettledPositions.length
                        : myHoldings.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  My History
                  {pendingOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {pendingOrders.length} open
                    </Badge>
                  )}
                </TabsTrigger>
                {isMarketMakerView && (
                  <TabsTrigger value="market-history" className="gap-2">
                    <History className="w-4 h-4" />
                    Market History
                  </TabsTrigger>
                )}
                {market.status === "resolved" && isMarketMakerView && (
                  <TabsTrigger value="maker-settlement" className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Maker Settlement
                  </TabsTrigger>
                )}
              </TabsList>

              {/* My Position */}
              <TabsContent value="position">
                {loadingUserData ? (
                  <div className="animate-pulse h-20 bg-muted rounded" />
                ) : market.status === "resolved" ? (
                  resolvedHoldings.length === 0 ? (
                    <div className="animate-fadeInUp">
                      <p className="text-muted-foreground text-sm py-8 text-center">
                        No settled positions in this market.
                      </p>
                    </div>
                  ) : (
                    <div className="animate-fadeInUp">
                      <HoldingsTab
                        filteredMarkets={[
                          {
                            marketId: id,
                            question: market.question,
                            endDate: market.resolutionDate,
                            holdings: resolvedHoldings,
                            totalPnl: settledTotalPnl,
                            totalCost: settledTotalCost,
                            totalValue: settledTotalPayout,
                          },
                        ]}
                        searchQuery=""
                        setSearchQuery={() => {}}
                        openOutcomeDetail={(h) =>
                          setSelectedOutcome({
                            marketId: id,
                            securityId: h.securityId,
                            holding: h,
                          })
                        }
                        hideSearch
                        hideMarketLinks
                        listMode
                      />
                      <div className="flex justify-between items-center px-1 pt-2 text-sm border-t mt-2">
                        <span className="text-muted-foreground">
                          Final P&amp;L
                        </span>
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            settledTotalPnl >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {settledTotalPnl >= 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {settledTotalPnl >= 0 ? "+" : ""}$
                          {(settledTotalPnl / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )
                ) : myHoldings.length === 0 ? (
                  <div className="animate-fadeInUp">
                    <p className="text-muted-foreground text-sm py-8 text-center">
                      No positions in this market yet.
                    </p>
                  </div>
                ) : (
                  <div className="animate-fadeInUp">
                    <HoldingsTab
                      filteredMarkets={[
                        {
                          marketId: id,
                          question: market.question,
                          endDate: market.resolutionDate,
                          holdings: myHoldings,
                          totalPnl,
                          totalCost: 0,
                          totalValue: 0,
                        },
                      ]}
                      searchQuery=""
                      setSearchQuery={() => {}}
                      openOutcomeDetail={(h) =>
                        setSelectedOutcome({
                          marketId: id,
                          securityId: h.securityId,
                          holding: h,
                        })
                      }
                      hideSearch
                      hideMarketLinks
                      listMode
                    />
                    <div className="flex justify-between items-center px-1 pt-2 text-sm border-t mt-2">
                      <span className="text-muted-foreground">
                        Total P&amp;L
                      </span>
                      <span
                        className={`font-semibold flex items-center gap-1 ${
                          totalPnl >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {totalPnl >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        {totalPnl >= 0 ? "+" : ""}${(totalPnl / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* My History */}
              <TabsContent value="history">
                {loadingUserData ? (
                  <div className="animate-pulse h-20 bg-muted rounded" />
                ) : (
                  <HistoryTab
                    orders={historyOrders}
                    loading={false}
                    searchQuery=""
                    setSearchQuery={() => {}}
                    hideSearch
                    showOrderStateFilter
                    defaultOrderStateFilter={
                      searchParams.get("tab") === "orders" ? "open" : "all"
                    }
                    disableMarketLink
                    onOrderClick={(order) => setSelectedOrder(order)}
                  />
                )}
              </TabsContent>

              {isMarketMakerView && (
                <TabsContent value="market-history">
                  {loadingMarketOrders ? (
                    <div className="animate-pulse h-20 bg-muted rounded" />
                  ) : (
                    <HistoryTab
                      orders={marketOrders}
                      loading={false}
                      searchQuery=""
                      setSearchQuery={() => {}}
                      hideSearch
                      showUserId
                      disableMarketLink
                      onOrderClick={(order) => setSelectedOrder(order)}
                    />
                  )}
                </TabsContent>
              )}

              {market.status === "resolved" && isMarketMakerView && (
                <TabsContent value="maker-settlement">
                  {!hasPayoutDistribution ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">
                      No non-zero settlement transfers for this market.
                    </p>
                  ) : (
                    <Card className="p-4">
                      <h4 className="text-sm font-semibold mb-3">
                        User Settlement Transfers
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Positive values were paid out by the market maker.
                        Negative values were collected back from traders.
                      </p>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {payoutDistribution.map((entry) => {
                          const label =
                            entry.userId === user?.id
                              ? "You"
                              : `Trader ${entry.userId.slice(0, 8)}`;
                          const isPositive = entry.payoutCents >= 0;

                          return (
                            <div
                              key={entry.userId}
                              className="flex justify-between items-center px-3 py-2 rounded border bg-background text-sm"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {entry.userId}
                                </span>
                              </div>
                              <span
                                className={`font-semibold ${isPositive ? "text-green-600" : "text-red-600"}`}
                              >
                                {isPositive ? "+" : "-"}$
                                {(Math.abs(entry.payoutCents) / 100).toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </TabsContent>
              )}
            </Tabs>
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-muted-foreground text-sm mb-3">
              Sign in to view your positions and order history for this market.
            </p>
          </Card>
        )}
      </div>

      <TradeDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (
            !open &&
            viewMode === "individual" &&
            market.status !== "resolved" &&
            market.status !== "closed"
          ) {
            setIntervalRange([-1, -1]);
          }
        }}
        market={market}
        historyOnly={market.status === "resolved" || market.status === "closed"}
        defaultTab={
          market.status === "resolved" || market.status === "closed"
            ? "history"
            : "trade"
        }
        selectedOutcomes={dialogOutcomes}
        onSuccess={() => {
          setDialogOpen(false);
          setIntervalRange([-1, -1]);
          refreshMarket();
          fetchUserData();
        }}
        onSignInClick={() => setAuthDialogOpen(true)}
      />

      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />

      <AdminDialogsController
        market={market}
        showSettleForm={showSettleForm}
        setShowSettleForm={setShowSettleForm}
        showEditForm={showEditForm}
        setShowEditForm={setShowEditForm}
        onSuccess={async () => {
          await refreshMarket();
          await fetchUserData();
        }}
      />

      <OrderDetailSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onCancel={handleCancelOrder}
        cancellingOrder={cancellingOrder}
      />

      <OutcomeDetailSheet
        selectedOutcome={selectedOutcome}
        onClose={() => setSelectedOutcome(null)}
        tradeHistory={tradeHistory}
        loadingHistory={loadingHistory}
        fetchTradeHistory={fetchTradeHistory}
      />
    </>
  );
}
