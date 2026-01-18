"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, Wallet } from "lucide-react";
import { usersApi, type PortfolioSnapshot } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { UNDERSTANDING_PNL_STEPS } from "@/lib/tutorial-steps";

export default function PortfolioPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const pnlTutorial = useTutorial({
    steps: UNDERSTANDING_PNL_STEPS,
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

  useEffect(() => {
    if (mounted && !loading) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "understanding-pnl") {
        pnlTutorial.start();
      }
    }
  }, [mounted, searchParams, loading]);

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
              Available Balance
            </div>
            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              ${(portfolio.wallet / 100.0).toFixed(2)}
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

      {portfolio.holdings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No open positions yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {portfolio.holdings.map((h) => {
            const isUp = h.pnl >= 0;
            return (
              <Card key={`${h.marketId}:${h.securityId}`} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="mb-1 font-medium leading-snug text-balance">
                      {h.question}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-mono">
                        {h.outcome}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {h.endDate}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Avg Price
                      </div>
                      <div className="font-semibold">
                        {h.avgPriceCents.toFixed(2)}¢
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Qty</div>
                      <div className="font-semibold">{h.quantity}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Mark</div>
                      <div className="font-semibold">
                        {h.markPriceCents.toFixed(2)}¢
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">P&L</div>
                      <div
                        className={`font-semibold flex items-center justify-end gap-1 ${
                          isUp ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {isUp ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}{" "}
                        ${(h.pnl / 100.0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
