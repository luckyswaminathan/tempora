"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Clock, Lock, History } from "lucide-react";
import {
  usersApi,
  ordersApi,
  type PortfolioSnapshot,
  type OrderRecord,
} from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { UNDERSTANDING_PNL_STEPS } from "@/lib/tutorial-steps";
import { PortfolioSummaryCards } from "@/components/portfolio-summary-cards";
import { HoldingsTab } from "@/components/holdings-tab";
import { OpenOrdersTab } from "@/components/open-orders-tab";
import { CollateralTab } from "@/components/collateral-tab";
import { HistoryTab } from "@/components/history-tab";
import { OutcomeDetailSheet } from "@/components/outcome-detail-sheet";
import { OrderDetailSheet } from "@/components/order-detail-sheet";

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
  const router = useRouter();
  const pathname = usePathname();
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
  const [activeTab, setActiveTab] = useState(
    () => searchParams.get("tab") ?? "holdings",
  );
  const [pendingOrders, setPendingOrders] = useState<OrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [loadingAllOrders, setLoadingAllOrders] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [collateralRefreshKey, setCollateralRefreshKey] = useState(0);
  const tutorialStartedRef = useRef(false);

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

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
        const [portfolioData, ordersData] = await Promise.all([
          usersApi.getPortfolio(),
          ordersApi.listOrders(),
        ]);
        setPortfolio(portfolioData);
        setPendingOrders(
          ordersData.items.filter((o) => !o.filled && !o.canceled),
        );
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

  // Fetch all filled orders when History tab is active
  useEffect(() => {
    async function fetchAllOrders() {
      if (!user || activeTab !== "history") return;

      try {
        setLoadingAllOrders(true);
        const response = await ordersApi.listOrders();
        // Show all orders (filled, unfilled, canceled), sorted by creation date (most recent first)
        const allOrders = response.items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setAllOrders(allOrders);
      } catch (err) {
        console.error("Failed to fetch order history:", err);
      } finally {
        setLoadingAllOrders(false);
      }
    }

    fetchAllOrders();
  }, [user, activeTab]);

  // Callback to refresh orders after cancellation
  const handleOrderCancelled = useCallback(() => {
    if (user) {
      setLoadingOrders(true);
      Promise.all([ordersApi.listOrders(), usersApi.getPortfolio()])
        .then(([ordersResponse, portfolioData]) => {
          const pending = ordersResponse.items.filter(
            (order) => !order.filled && !order.canceled,
          );
          setPendingOrders(pending);
          setPortfolio(portfolioData);
          setCollateralRefreshKey((k) => k + 1);
        })
        .catch((err) => console.error("Failed to refresh after cancel:", err))
        .finally(() => setLoadingOrders(false));
    }
  }, [user]);

  useEffect(() => {
    if (mounted && !loading && !tutorialStartedRef.current) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "understanding-pnl") {
        tutorialStartedRef.current = true;
        pnlTutorial.start();
      }
    }
  }, [mounted, searchParams, loading, pnlTutorial]);

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
    if (!tradeHistory[holding.marketId]) {
      await fetchTradeHistory(holding.marketId);
    }
  };

  // Fetch trade history for a market
  const fetchTradeHistory = useCallback(async (marketId: string) => {
    setLoadingHistory((prev) => {
      const newSet = new Set(prev);
      newSet.add(marketId);
      return newSet;
    });

    try {
      const orders = await ordersApi.listOrders({ marketId });
      setTradeHistory((prev) => ({
        ...prev,
        [marketId]: orders.items,
      }));
    } catch (err) {
      console.error("Failed to fetch trade history:", err);
    } finally {
      setLoadingHistory((prev) => {
        const newSet = new Set(prev);
        newSet.delete(marketId);
        return newSet;
      });
    }
  }, []);

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
            <div key={i} className="h-16 bg-muted animate-pulse rounded" />
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

      {/* Summary Cards */}
      <PortfolioSummaryCards portfolio={portfolio} />

      {/* Tabs for Holdings vs Open Orders vs Collateral */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
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
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Holdings Tab */}
        <TabsContent value="holdings">
          <HoldingsTab
            filteredMarkets={filteredMarkets}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            openOutcomeDetail={openOutcomeDetail}
          />
        </TabsContent>

        {/* Open Orders Tab */}
        <TabsContent value="orders">
          <OpenOrdersTab
            pendingOrders={pendingOrders}
            loadingOrders={loadingOrders}
            onOrderCancelled={handleOrderCancelled}
          />
        </TabsContent>

        {/* Collateral Tab */}
        <TabsContent value="collateral">
          <CollateralTab
            totalCollateralLocked={portfolio.collateralLocked}
            holdings={portfolio.holdings}
            openOutcomeDetail={openOutcomeDetail}
            refreshKey={collateralRefreshKey}
            pendingOrders={pendingOrders}
            openOrderDetail={(order) => setSelectedOrder(order)}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <HistoryTab
            orders={allOrders}
            loading={loadingAllOrders}
            searchQuery={historySearchQuery}
            setSearchQuery={setHistorySearchQuery}
            onOrderClick={(order) => setSelectedOrder(order)}
          />
        </TabsContent>
      </Tabs>

      {/* Outcome Detail Sheet */}
      <OutcomeDetailSheet
        selectedOutcome={selectedOutcome}
        onClose={() => setSelectedOutcome(null)}
        tradeHistory={tradeHistory}
        loadingHistory={loadingHistory}
        fetchTradeHistory={fetchTradeHistory}
      />

      {/* Order Detail Sheet (history tab) */}
      <OrderDetailSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderCancelled={handleOrderCancelled}
      />
    </div>
  );
}
