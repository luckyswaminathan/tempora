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
  Clock,
  History,
  X,
  TrendingDown,
} from "lucide-react";
import {
  marketsApi,
  ordersApi,
  usersApi,
  type Market,
  type PortfolioSnapshot,
  type OrderRecord,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { SecurityPicker, getUITypeConfig } from "@/components/security-picker";
import { TradeDialog } from "@/components/trade-dialog";
import { AuthDialog } from "@/components/auth-dialog";
import { OrderDetailSheet } from "@/components/order-detail-sheet";
import { OpenOrdersTab } from "@/components/open-orders-tab";
import { HistoryTab } from "@/components/history-tab";
import { HoldingsTab } from "@/components/holdings-tab";
import { OutcomeDetailSheet } from "@/components/outcome-detail-sheet";
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

  // User data
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);

  // Trade UI state (same pattern as MarketCard)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
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
  const [marketTab, setMarketTab] = useState(
    () => searchParams.get("tab") ?? "position",
  );
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

  // Holdings for this market only
  const myHoldings = useMemo(
    () => portfolio?.holdings.filter((h) => h.marketId === id) ?? [],
    [portfolio?.holdings, id],
  );
  const totalPnl = myHoldings.reduce((s, h) => s + h.pnl, 0);

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

  const statusBadgeClass: Record<string, string> = {
    open: "bg-green-600 text-white",
    closed: "bg-amber-600 text-white",
    resolved: "bg-blue-600 text-white",
    suspended: "bg-red-600 text-white",
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
            <Badge className={statusBadgeClass[market.status] ?? ""}>
              {market.status}
            </Badge>
            <Badge
              variant="secondary"
              className="text-white"
              style={{ backgroundColor: categoryColor(market.category || "") }}
            >
              {market.category}
            </Badge>
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
          <Card className="p-4 mb-6 border-green-200 bg-green-50 dark:bg-green-950">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600 text-white">Resolved</Badge>
              <span className="text-sm font-medium">
                Winning outcome:{" "}
                {outcomes.find((o) => o.id === market.winningSecurityId)
                  ?.outcome ?? "—"}
              </span>
            </div>
          </Card>
        )}
        {market.status === "closed" && (
          <Card className="p-4 mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-600 text-white">Closed</Badge>
              <span className="text-sm font-medium">
                Trading closed — positions remain until resolution.
              </span>
            </div>
          </Card>
        )}
        {market.status === "suspended" && (
          <Card className="p-4 mb-6 border-red-200 bg-red-50 dark:bg-red-950">
            <div className="flex items-center gap-2">
              <Badge className="bg-red-600 text-white">Suspended</Badge>
              <span className="text-sm font-medium">
                Trading is temporarily halted.
              </span>
            </div>
          </Card>
        )}

        {/* Trade panel */}
        {market.status === "open" && (
          <Card className="p-4 mb-6">
            <SecurityPicker
              outcomes={outcomes}
              uiType={market.uiType}
              selectedRange={intervalRange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onRangeChange={(range) => {
                setIntervalRange(range);
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
            {viewMode === "interval" && rangeStart >= 0 && rangeEnd >= 0 && (
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" onClick={() => setDialogOpen(true)}>
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
          <div ref={tabsRef}>
            <Tabs
              value={marketTab}
              onValueChange={handleMarketTabChange}
              className="w-full"
            >
              <TabsList className="mb-4">
                <TabsTrigger value="position" className="gap-2">
                  <Wallet className="w-4 h-4" />
                  My Position
                  {myHoldings.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {myHoldings.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="orders" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Open Orders
                  {pendingOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {pendingOrders.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="w-4 h-4" />
                  My History
                </TabsTrigger>
              </TabsList>

              {/* My Position */}
              <TabsContent value="position">
                {loadingUserData ? (
                  <div className="animate-pulse h-20 bg-muted rounded" />
                ) : myHoldings.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    No positions in this market yet.
                  </p>
                ) : (
                  <>
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
                        {totalPnl >= 0 ? "+" : ""}
                        {(totalPnl / 100).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Open Orders */}
              <TabsContent value="orders">
                {loadingUserData ? (
                  <div className="animate-pulse h-20 bg-muted rounded" />
                ) : (
                  <OpenOrdersTab
                    pendingOrders={pendingOrders}
                    loadingOrders={false}
                    onOrderCancelled={fetchUserData}
                    hideSearch
                    hideMarketLinks
                    listMode
                  />
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
                    onOrderClick={(order) => setSelectedOrder(order)}
                  />
                )}
              </TabsContent>
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
          if (!open && viewMode === "individual") setIntervalRange([-1, -1]);
        }}
        market={market}
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
