"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Calendar, Wallet } from "lucide-react";
import { usersApi, type PortfolioSnapshot } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";

// Tutorial steps data (same as in tutorial page)
const UNDERSTANDING_PNL_STEPS = [
  {
    id: 1,
    elementId: "pnl-cost-basis",
    title: "Cost Basis",
    description:
      "This is the total amount you paid to acquire your positions. It's the sum of all your initial investments in the current holdings.",
  },
  {
    id: 2,
    elementId: "pnl-market-value",
    title: "Market Value",
    description:
      "The current value of all your positions at today's market prices. This changes throughout the day as market prices move.",
  },
  {
    id: 3,
    elementId: "pnl-unrealized",
    title: "Profit & Loss (P&L)",
    description:
      "The difference between your market value and cost basis. Green means you're making money, red means you're losing money. This is unrealized - it's the profit/loss if you close all positions now.",
  },
  {
    id: 4,
    elementId: "pnl-roi",
    title: "Return on Investment (ROI)",
    description:
      "Your P&L expressed as a percentage of your initial investment. This shows your return efficiency. For example, 10% ROI means you've made 10% profit on your initial investment.",
  },
];

export default function PortfolioPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const tutorialMode = searchParams?.get("tutorial");

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
    if (tutorialMode === "understanding-pnl" && !loading) {
      setTutorialActive(true);
      setCurrentStep(0);
    }
  }, [tutorialMode, loading]);

  const handleNextStep = () => {
    if (currentStep < UNDERSTANDING_PNL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setTutorialActive(false);
    }
  };

  const handleCloseTutorial = () => {
    setTutorialActive(false);
  };

  const currentStepData = UNDERSTANDING_PNL_STEPS[currentStep];
  const targetElement = tutorialActive
    ? document.getElementById(currentStepData?.elementId || "")
    : null;
  const rect = targetElement?.getBoundingClientRect();

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
      {/* Tutorial Overlay */}
      {tutorialActive && (
        <>
          {/* Fade overlay */}
          <div
            className="fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
            onClick={handleCloseTutorial}
          />

          {/* Highlight and tooltip */}
          {rect && (
            <>
              {/* Highlighted element border */}
              <div
                className="fixed z-50 pointer-events-none border-2 border-yellow-400 rounded-lg shadow-lg"
                style={{
                  top: `${rect.top - 4}px`,
                  left: `${rect.left - 4}px`,
                  width: `${rect.width + 8}px`,
                  height: `${rect.height + 8}px`,
                  boxShadow: "0 0 20px rgba(250, 204, 21, 0.6)",
                }}
              />

              {/* Tooltip */}
              <div
                className="fixed z-50 bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 w-96 border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-300"
                style={{
                  top: `${Math.min(
                    rect.bottom + 20,
                    window.innerHeight - 300,
                  )}px`,
                  left: `${Math.max(
                    Math.min(
                      rect.left + rect.width / 2 - 192,
                      window.innerWidth - 400,
                    ),
                    16,
                  )}px`,
                }}
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {currentStepData?.title}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {currentStepData?.description}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <div className="text-xs text-gray-500">
                    Step {currentStep + 1} of {UNDERSTANDING_PNL_STEPS.length}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseTutorial}
                    >
                      Skip
                    </Button>
                    <Button size="sm" onClick={handleNextStep}>
                      {currentStep === UNDERSTANDING_PNL_STEPS.length - 1
                        ? "Done"
                        : "OK"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
          <Wallet className="w-7 h-7" /> Your Portfolio
        </h1>
        <p className="text-muted-foreground mt-1">
          Open positions and performance
        </p>
      </div>

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
