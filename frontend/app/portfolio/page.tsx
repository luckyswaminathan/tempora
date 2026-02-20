"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  Search,
  ChevronRight,
  History,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  X,
  AlertCircle,
  Lock,
  ShieldAlert,
} from "lucide-react";
import {
  usersApi,
  ordersApi,
  type PortfolioSnapshot,
  type OrderRecord,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { UNDERSTANDING_PNL_STEPS } from "@/lib/tutorial-steps";

// Group holdings by market
interface MarketGroup {
  marketId: string;
  question: string;
  endDate: string;
  holdings: PortfolioSnapshot["holdings"];
  totalPnl: number;
  totalCost: number;
  totalValue: number;
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tradeHistory, setTradeHistory] = useState<
    Record<string, OrderRecord[]>
  >({});
  const [loadingHistory, setLoadingHistory] = useState<Set<string>>(new Set());
  const [selectedOutcome, setSelectedOutcome] = useState<{
    marketId: string;
    securityId: string;
    holding: PortfolioSnapshot["holdings"][0];
  } | null>(null);
  const [activeTab, setActiveTab] = useState("holdings");
  const [pendingOrders, setPendingOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);

  const pnlTutorial = useTutorial({
    steps: UNDERSTANDING_PNL_STEPS,
    lessonKey: "understanding-pnl",
  });

  // Ensure component is mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchPortfolio() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await usersApi.getPortfolio();
        setPortfolio(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load portfolio",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
  }, [user]);

  // Fetch pending orders when Orders tab is active
  useEffect(() => {
    async function fetchPendingOrders() {
      if (!user || activeTab !== "orders") return;

      try {
        setLoadingOrders(true);
        const response = await ordersApi.listOrders();
        // Filter to only show unfilled orders (pending limit orders)
        const pending = response.items.filter((order) => !order.filled);
        setPendingOrders(pending);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
      } finally {
        setLoadingOrders(false);
      }
    }

    fetchPendingOrders();
  }, [user, activeTab]);

  // Handle cancel order (UI only for now - API not implemented yet)
  const handleCancelOrder = async (orderId: string) => {
    setCancellingOrder(orderId);
    // TODO: Call API to cancel order when endpoint is available
    // For now, just simulate a delay and show feedback
    setTimeout(() => {
      setCancellingOrder(null);
      alert("Cancel order API not yet implemented");
    }, 500);
  };

  useEffect(() => {
    if (mounted && !loading) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "understanding-pnl") {
        pnlTutorial.start();
      }
    }
  }, [mounted, searchParams, loading]);

  // Group holdings by market
  const marketGroups = useMemo(() => {
    if (!portfolio?.holdings) return [];

    const groupMap = new Map<string, MarketGroup>();

    for (const h of portfolio.holdings) {
      const existing = groupMap.get(h.marketId);
      if (existing) {
        existing.holdings.push(h);
        existing.totalPnl += h.pnl;
        existing.totalCost += h.avgPriceCents * h.quantity;
        existing.totalValue += h.markPriceCents * h.quantity;
      } else {
        groupMap.set(h.marketId, {
          marketId: h.marketId,
          question: h.question,
          endDate: h.endDate,
          holdings: [h],
          totalPnl: h.pnl,
          totalCost: h.avgPriceCents * h.quantity,
          totalValue: h.markPriceCents * h.quantity,
        });
      }
    }

    return Array.from(groupMap.values());
  }, [portfolio?.holdings]);

  // Calculate collateral breakdown from holdings
  const collateralBreakdown = useMemo(() => {
    if (!portfolio?.holdings) {
      return {
        shortPositions: [],
        totalShortCollateral: 0,
        marketMakerCollateral: 0,
      };
    }

    const shortPositions: Array<{
      marketId: string;
      question: string;
      outcome: string;
      quantity: number;
      collateralCents: number;
    }> = [];

    for (const h of portfolio.holdings) {
      if (h.quantity < 0) {
        // Short position - collateral = |quantity| * 100 cents ($1 per share)
        const collateral = Math.abs(h.quantity) * 100;
        shortPositions.push({
          marketId: h.marketId,
          question: h.question,
          outcome: h.outcome,
          quantity: h.quantity,
          collateralCents: collateral,
        });
      }
    }

    const totalShortCollateral = shortPositions.reduce(
      (sum, p) => sum + p.collateralCents,
      0,
    );

    // Market maker collateral is the difference
    const marketMakerCollateral =
      portfolio.collateralLocked - totalShortCollateral;

    return {
      shortPositions,
      totalShortCollateral,
      marketMakerCollateral: Math.max(0, marketMakerCollateral),
    };
  }, [portfolio?.holdings, portfolio?.collateralLocked]);

  // Filter markets by search query
  const filteredMarkets = useMemo(() => {
    if (!searchQuery.trim()) return marketGroups;

    const query = searchQuery.toLowerCase();
    return marketGroups.filter(
      (group) =>
        group.question.toLowerCase().includes(query) ||
        group.holdings.some((h) => h.outcome.toLowerCase().includes(query)),
    );
  }, [marketGroups, searchQuery]);

  // Open outcome detail panel
  const openOutcomeDetail = async (
    holding: PortfolioSnapshot["holdings"][0],
  ) => {
    setSelectedOutcome({
      marketId: holding.marketId,
      securityId: holding.securityId,
      holding,
    });

    // Fetch trade history if not already loaded
    if (
      !tradeHistory[holding.marketId] &&
      !loadingHistory.has(holding.marketId)
    ) {
      setLoadingHistory((prev) => new Set(prev).add(holding.marketId));
      try {
        const orders = await ordersApi.listOrders({
          marketId: holding.marketId,
        });
        setTradeHistory((prev) => ({
          ...prev,
          [holding.marketId]: orders.items,
        }));
      } catch (err) {
        console.error("Failed to fetch trade history:", err);
      } finally {
        setLoadingHistory((prev) => {
          const next = new Set(prev);
          next.delete(holding.marketId);
          return next;
        });
      }
    }
  };

  // Get trades for selected outcome
  const selectedOutcomeTrades = useMemo(() => {
    if (!selectedOutcome) return [];
    const marketOrders = tradeHistory[selectedOutcome.marketId] || [];
    // Filter orders that have trades for this specific security
    return marketOrders
      .map((order) => ({
        ...order,
        trades: order.trades.filter(
          (t) => t.securityId === selectedOutcome.securityId,
        ),
      }))
      .filter((order) => order.trades.length > 0);
  }, [selectedOutcome, tradeHistory]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Please sign in to view your portfolio
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
            <Wallet className="w-7 h-7" /> Your Portfolio
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <div className="h-16 bg-muted animate-pulse rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Error loading portfolio: {error}
          </p>
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No portfolio data available</p>
        </div>
      </div>
    );
  }

  const summary = portfolio.summary;

  return (
    <div className="container mx-auto px-4 py-8">
      <TutorialOverlay
        steps={UNDERSTANDING_PNL_STEPS}
        currentStep={pnlTutorial.currentStep}
        isActive={pnlTutorial.isActive}
        elementRect={pnlTutorial.elementRect}
        onNext={pnlTutorial.next}
        onClose={pnlTutorial.close}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
          <Wallet className="w-7 h-7" /> Your Portfolio
        </h1>
        <p className="text-muted-foreground mt-1">
          Open positions and performance
        </p>
      </div>

      <Card className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div>
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
          <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
            <Wallet className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card id="pnl-cost-basis" className="p-4">
          <div className="text-xs text-muted-foreground">Cost Basis</div>
          <div className="text-2xl font-semibold">
            ${(summary.costBasis / 100.0).toFixed(2)}
          </div>
        </Card>
        <Card id="pnl-market-value" className="p-4">
          <div className="text-xs text-muted-foreground">Market Value</div>
          <div className="text-2xl font-semibold">
            ${(summary.marketValue / 100.0).toFixed(2)}
          </div>
        </Card>
        <Card id="pnl-unrealized" className="p-4">
          <div className="text-xs text-muted-foreground">P&L</div>
          <div
            className={`text-2xl font-semibold ${
              summary.unrealisedPnL >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            ${(summary.unrealisedPnL / 100.0).toFixed(2)}
          </div>
        </Card>
        <Card id="pnl-roi" className="p-4">
          <div className="text-xs text-muted-foreground">ROI</div>
          <div
            className={`text-2xl font-semibold ${
              summary.roi >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {summary.roi.toFixed(1)}%
          </div>
        </Card>
      </div>

      {/* Tabs for Holdings vs Open Orders vs Collateral */}
      <Tabs
        defaultValue="holdings"
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="holdings" className="gap-2">
            <Wallet className="w-4 h-4" />
            Holdings
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
          <TabsTrigger value="collateral" className="gap-2">
            <Lock className="w-4 h-4" />
            Collateral
            {portfolio.collateralLocked > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                ${(portfolio.collateralLocked / 100).toFixed(0)}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Holdings Tab */}
        <TabsContent value="holdings">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredMarkets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No markets match your search"
                  : "No open positions yet"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMarkets.map((group) => {
                const isUp = group.totalPnl >= 0;

                return (
                  <Card
                    key={group.marketId}
                    className="flex flex-col overflow-hidden"
                  >
                    {/* Market Header */}
                    <div className="p-4 border-b">
                      <h3 className="font-medium leading-snug text-balance line-clamp-2 mb-2">
                        {group.question}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{group.endDate}</span>
                        <Badge variant="outline" className="ml-auto">
                          {group.holdings.length} position
                          {group.holdings.length > 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>

                    {/* Holdings Summary - Compact view */}
                    <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto flex-1">
                      {group.holdings.map((h) => (
                        <button
                          key={`${h.marketId}:${h.securityId}`}
                          onClick={() => openOutcomeDetail(h)}
                          className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Badge
                              variant="secondary"
                              className="font-mono text-xs px-1.5 py-0 h-5 shrink-0"
                            >
                              {h.outcome}
                            </Badge>
                            <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 text-xs shrink-0">
                            <span className="text-muted-foreground">
                              {h.quantity}×{h.avgPriceCents.toFixed(0)}¢
                            </span>
                            <span
                              className={`font-medium tabular-nums ${
                                h.pnl >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {h.pnl >= 0 ? "+" : ""}${(h.pnl / 100).toFixed(2)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Total P&L - Compact */}
                    <div className="px-3 py-2 bg-muted/50 border-t flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total P&L</span>
                      <div
                        className={`flex items-center gap-1 font-semibold ${
                          isUp ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isUp ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        ${(group.totalPnl / 100).toFixed(2)}
                      </div>
                    </div>

                    {/* Hint to click outcomes */}
                    <div className="px-3 py-1.5 border-t bg-muted/30 text-center">
                      <span className="text-xs text-muted-foreground">
                        Click an outcome to view trade history
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Open Orders Tab */}
        <TabsContent value="orders">
          {loadingOrders ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading orders...</p>
            </div>
          ) : pendingOrders.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No pending orders</p>
              <p className="text-sm text-muted-foreground mt-1">
                Limit orders that haven&apos;t been filled will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={
                            order.type === "buy" ? "default" : "secondary"
                          }
                          className={
                            order.type === "buy"
                              ? "bg-green-600"
                              : "bg-red-600 text-white"
                          }
                        >
                          {order.type.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Clock className="w-3 h-3" />
                          Pending
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Market ID: {order.marketId.slice(0, 8)}...
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span>
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-medium">
                            ${(Math.abs(order.priceCents) / 100).toFixed(2)}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingOrder === order.id}
                    >
                      {cancellingOrder === order.id ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span>
                          Cancelling...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <X className="w-4 h-4" />
                          Cancel Order
                        </span>
                      )}
                    </Button>
                  </div>
                </Card>
              ))}

              <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Limit Order Info
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-1">
                      Pending limit orders will be filled when the market price
                      reaches your limit price. You can cancel unfilled orders
                      at any time.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Collateral Tab */}
        <TabsContent value="collateral">
          {portfolio.collateralLocked === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                <Lock className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No collateral locked</p>
              <p className="text-sm text-muted-foreground mt-1">
                Collateral is locked when you hold short positions or create
                markets
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Collateral Summary */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Collateral Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Total Locked</span>
                    <span className="text-xl font-bold">
                      ${(portfolio.collateralLocked / 100).toFixed(2)}
                    </span>
                  </div>
                  {collateralBreakdown.totalShortCollateral > 0 && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        Short Positions
                      </span>
                      <span className="font-semibold text-red-600">
                        $
                        {(
                          collateralBreakdown.totalShortCollateral / 100
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {collateralBreakdown.marketMakerCollateral > 0 && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-blue-500" />
                        Market Making
                      </span>
                      <span className="font-semibold text-blue-600">
                        $
                        {(
                          collateralBreakdown.marketMakerCollateral / 100
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Short Positions Detail */}
              {collateralBreakdown.shortPositions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    Short Position Collateral
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Collateral locked at $1.00 per share for short positions
                    (max liability if outcome wins)
                  </p>
                  <div className="space-y-2">
                    {collateralBreakdown.shortPositions.map((pos, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm line-clamp-1 mb-1">
                              {pos.question}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge
                                variant="outline"
                                className="text-red-600 border-red-300"
                              >
                                SHORT: {pos.outcome}
                              </Badge>
                              <span>{Math.abs(pos.quantity)} shares</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">
                              Locked
                            </div>
                            <div className="font-semibold">
                              ${(pos.collateralCents / 100).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Market Making Info */}
              {collateralBreakdown.marketMakerCollateral > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-blue-500" />
                    Market Making Collateral
                  </h3>
                  <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800 dark:text-blue-200">
                          Funding Collateral
                        </p>
                        <p className="text-blue-700 dark:text-blue-300 mt-1">
                          $
                          {(
                            collateralBreakdown.marketMakerCollateral / 100
                          ).toFixed(2)}{" "}
                          locked as liquidity funding for markets you created.
                          This will be released when markets are resolved.
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Info Card */}
              <Card className="p-4 bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      How Collateral Works
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 mt-1">
                      Collateral ensures you can cover potential losses. For
                      short positions, $1.00 per share is locked (max payout if
                      that outcome wins). Market makers lock funding to provide
                      initial liquidity. Collateral is automatically released
                      when positions close or markets resolve.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Outcome Detail Sheet */}
      <Sheet
        open={!!selectedOutcome}
        onOpenChange={(open) => !open && setSelectedOutcome(null)}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
        >
          {selectedOutcome && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-left">
                  <Badge variant="secondary" className="font-mono text-lg mb-2">
                    {selectedOutcome.holding.outcome}
                  </Badge>
                  <p className="text-sm font-normal text-muted-foreground mt-2 line-clamp-2">
                    {selectedOutcome.holding.question}
                  </p>
                </SheetTitle>
              </SheetHeader>

              {/* Position Summary */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Current Position
                </h4>
                <Card className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Quantity
                      </div>
                      <div className="text-xl font-semibold">
                        {selectedOutcome.holding.quantity}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Avg Price
                      </div>
                      <div className="text-xl font-semibold">
                        {selectedOutcome.holding.avgPriceCents.toFixed(1)}¢
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">
                        Mark Price
                      </div>
                      <div className="text-xl font-semibold">
                        {selectedOutcome.holding.markPriceCents.toFixed(1)}¢
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">P&L</div>
                      <div
                        className={`text-xl font-semibold flex items-center gap-1 ${
                          selectedOutcome.holding.pnl >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {selectedOutcome.holding.pnl >= 0 ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5" />
                        )}
                        ${(selectedOutcome.holding.pnl / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Trade History */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Trade History
                </h4>

                {loadingHistory.has(selectedOutcome.marketId) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading trades...
                  </div>
                ) : selectedOutcomeTrades.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No trades found for this outcome
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedOutcomeTrades.map((order) => (
                      <Card key={order.id} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge
                            variant={
                              order.type === "buy" ? "default" : "secondary"
                            }
                            className={
                              order.type === "buy"
                                ? "bg-green-600"
                                : "bg-red-600 text-white"
                            }
                          >
                            {order.type.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {order.trades.map((trade) => (
                            <div
                              key={trade.id}
                              className="flex items-center justify-between py-2 border-b last:border-0"
                            >
                              <div>
                                <span className="font-medium">
                                  {trade.quantity} shares
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  @{" "}
                                  {(trade.priceCents / trade.quantity).toFixed(
                                    2,
                                  )}
                                  ¢ avg
                                </span>
                              </div>
                              <div className="font-mono font-medium">
                                ${(trade.priceCents / 100).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.trades.length > 1 && (
                          <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-mono font-medium">
                              $
                              {(
                                order.trades.reduce(
                                  (sum, t) => sum + t.priceCents,
                                  0,
                                ) / 100
                              ).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
