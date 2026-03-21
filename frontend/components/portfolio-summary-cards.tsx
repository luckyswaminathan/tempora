"use client";

import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import type { PortfolioSnapshot } from "@/lib/api";

interface PortfolioSummaryCardsProps {
  portfolio: PortfolioSnapshot;
  walletHistory?: Array<{ t: string; v: number }>;
}

export function PortfolioSummaryCards({
  portfolio,
}: PortfolioSummaryCardsProps) {
  return (
    <>
      {/* Main Spendable Balance Card */}
      <Card className="p-6 mb-6 animate-fadeInUp">
        {/* Header row: text block + wallet icon */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground mb-1">
              Spendable Balance
            </div>
            <div className="text-4xl font-bold text-primary">
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
                <div className="flex justify-between gap-4 text-secondary">
                  <span>Collateral locked:</span>
                  <span className="font-mono">
                    -${(portfolio.collateralLocked / 100.0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="surface-panel p-4 rounded-full flex-shrink-0">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
        </div>
      </Card>
    </>
  );
}
