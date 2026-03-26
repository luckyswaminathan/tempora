"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Lock, History, CheckCircle2 } from "lucide-react";
import {
  usersApi,
  ordersApi,
  type PortfolioSnapshot,
  type OrderRecord,
} from "@/lib/api";

type WalletPoint = { t: string; v: number };
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import {
  UNDERSTANDING_PNL_STEPS,
  MANAGING_ORDERS_STEPS,
  HOLDINGS_STEPS,
  COLLATERAL_STEPS,
  SETTLED_POSITIONS_STEPS,
} from "@/lib/tutorial-steps";
import { PortfolioSummaryCards } from "@/components/portfolio-summary-cards";
import { HoldingsTab } from "@/components/holdings-tab";
import { CollateralTab } from "@/components/collateral-tab";
import { HistoryTab } from "@/components/history-tab";
import { SettledPositionsTab } from "@/components/settled-positions-tab";
import { PortfolioAnalyticsSection } from "@/components/portfolio-analytics-section";
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
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return tab === "orders" ? "history" : (tab ?? "holdings");
  });
  const [pendingOrders, setPendingOrders] = useState<OrderRecord[]>([]);
  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [collateralRefreshKey, setCollateralRefreshKey] = useState(0);
  const [walletHistory, setWalletHistory] = useState<WalletPoint[]>([]);
  const tutorialStartedRef = useRef(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      requestAnimationFrame(() => {
        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [pathname, router, searchParams],
  );

  const pnlTutorial = useTutorial({
    steps: UNDERSTANDING_PNL_STEPS,
    lessonKey: "understanding-pnl",
  });
  const managingOrdersTutorial = useTutorial({
    steps: MANAGING_ORDERS_STEPS,
    lessonKey: "managing-orders",
  });
  const holdingsTutorial = useTutorial({
    steps: HOLDINGS_STEPS,
    lessonKey: "holdings-positions",
  });
  const collateralTutorial = useTutorial({
    steps: COLLATERAL_STEPS,
    lessonKey: "collateral",
  });
  const settledTutorial = useTutorial({
    steps: SETTLED_POSITIONS_STEPS,
    lessonKey: "settled-positions",
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
        const [portfolioData, ordersData, historyData] = await Promise.all([
          usersApi.getPortfolio(),
          ordersApi.listOrders(),
          usersApi.getWalletHistory(30),
        ]);
        setPortfolio(portfolioData);
        setWalletHistory(historyData.data);
        setPendingOrders(
          ordersData.items.filter((o) => !o.filled && !o.canceled),
        );
        setAllOrders(
          ordersData.items.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
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

  // allOrders is populated eagerly in the initial fetch above.

  // Callback to refresh orders after cancellation
  const handleOrderCancelled = useCallback(() => {
    if (user) {
      Promise.all([ordersApi.listOrders(), usersApi.getPortfolio()])
        .then(([ordersResponse, portfolioData]) => {
          const pending = ordersResponse.items.filter(
            (order) => !order.filled && !order.canceled,
          );
          setPendingOrders(pending);
          setAllOrders(
            ordersResponse.items.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            ),
          );
          setPortfolio(portfolioData);
          setCollateralRefreshKey((k) => k + 1);
        })
        .catch((err) => console.error("Failed to refresh after cancel:", err));
    }
  }, [user]);

  // Scroll to tabs on initial load if ?tab= is in the URL
  useEffect(() => {
    if (mounted && !loading && searchParams?.get("tab")) {
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [mounted, loading]);

  useEffect(() => {
    if (mounted && !loading && !tutorialStartedRef.current) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "understanding-pnl") {
        tutorialStartedRef.current = true;
        pnlTutorial.start();
      } else if (tutorialMode === "managing-orders") {
        tutorialStartedRef.current = true;
        setActiveTab("history");
        managingOrdersTutorial.start();
      } else if (tutorialMode === "holdings-positions") {
        tutorialStartedRef.current = true;
        setActiveTab("holdings");
        holdingsTutorial.start();
      } else if (tutorialMode === "collateral") {
        tutorialStartedRef.current = true;
        setActiveTab("collateral");
        collateralTutorial.start();
      } else if (tutorialMode === "settled-positions") {
        tutorialStartedRef.current = true;
        setActiveTab("settled");
        settledTutorial.start();
      }
    }
  }, [mounted, searchParams, loading, pnlTutorial, managingOrdersTutorial, holdingsTutorial, collateralTutorial, settledTutorial]);

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
      <TutorialOverlay steps={MANAGING_ORDERS_STEPS} currentStep={managingOrdersTutorial.currentStep} isActive={managingOrdersTutorial.isActive} elementRect={managingOrdersTutorial.elementRect} onNext={managingOrdersTutorial.next} onClose={managingOrdersTutorial.close} />
      <TutorialOverlay steps={HOLDINGS_STEPS} currentStep={holdingsTutorial.currentStep} isActive={holdingsTutorial.isActive} elementRect={holdingsTutorial.elementRect} onNext={holdingsTutorial.next} onClose={holdingsTutorial.close} />
      <TutorialOverlay steps={COLLATERAL_STEPS} currentStep={collateralTutorial.currentStep} isActive={collateralTutorial.isActive} elementRect={collateralTutorial.elementRect} onNext={collateralTutorial.next} onClose={collateralTutorial.close} />
      <TutorialOverlay steps={SETTLED_POSITIONS_STEPS} currentStep={settledTutorial.currentStep} isActive={settledTutorial.isActive} elementRect={settledTutorial.elementRect} onNext={settledTutorial.next} onClose={settledTutorial.close} />

      <div className="mb-8" id="portfolio-title">
        <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
          <Wallet className="w-7 h-7" /> Your Portfolio
        </h1>
        <p className="text-muted-foreground mt-1">
          Open positions and performance
        </p>
      </div>

      <div id="portfolio-summary">
      <PortfolioSummaryCards
        portfolio={portfolio}
        walletHistory={walletHistory}
      />
      </div>

      <PortfolioAnalyticsSection
        portfolio={portfolio}
        allOrders={allOrders}
        onSelectOutcome={openOutcomeDetail}
      />

      <div ref={tabsRef} className="scroll-mt-24" id="portfolio-tabs">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="mb-6">
            <TabsTrigger value="holdings" className="gap-2">
              <Wallet className="w-4 h-4" />
              Open Positions
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
            <TabsTrigger value="settled" className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Settled Positions
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              Order History
              {pendingOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {pendingOrders.length} open
                </Badge>
              )}
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

          {/* Settled Positions Tab */}
          <TabsContent value="settled">
            <SettledPositionsTab
              positions={portfolio.settledPositions}
              onOpenOutcomeDetail={(marketId, securityId, outcome) => {
                const settled = portfolio.settledPositions.find(
                  (p) => p.marketId === marketId && p.securityId === securityId,
                );
                const quantity = settled?.quantity ?? 0;
                const costBasisCents = settled?.costBasisCents ?? 0;
                const payoutCents = settled?.payoutCents ?? 0;
                setSelectedOutcome({
                  marketId,
                  securityId,
                  holding: {
                    marketId,
                    securityId,
                    question: settled?.question || "",
                    outcome,
                    avgPriceCents: quantity > 0 ? costBasisCents / quantity : 0,
                    quantity,
                    markPriceCents: quantity > 0 ? payoutCents / quantity : 0,
                    endDate: settled?.settlementDate || "",
                    pnl: settled?.pnlCents ?? 0,
                    category: settled?.category || "",
                  },
                });
              }}
            />
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <HistoryTab
              orders={allOrders}
              loading={false}
              searchQuery={historySearchQuery}
              setSearchQuery={setHistorySearchQuery}
              showOrderStateFilter
              defaultOrderStateFilter={
                searchParams.get("tab") === "orders" ? "open" : "all"
              }
              onOrderClick={(order) => setSelectedOrder(order)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <OutcomeDetailSheet
        selectedOutcome={selectedOutcome}
        onClose={() => setSelectedOutcome(null)}
        tradeHistory={tradeHistory}
        loadingHistory={loadingHistory}
        fetchTradeHistory={fetchTradeHistory}
      />

      <OrderDetailSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderCancelled={handleOrderCancelled}
      />
    </div>
  );
}
