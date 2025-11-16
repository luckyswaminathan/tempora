"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Calendar } from "lucide-react";
import { BetDialog } from "@/components/bet-dialog";
import type { Market } from "@/lib/api";
import { format } from "date-fns";

export function MarketCard({ market }: { market: Market; }) {
  const [betDialogOpen, setBetDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<"YES" | "NO">("YES");

  const handleBet = (outcome: "YES" | "NO") => {
    setSelectedOutcome(outcome);
    setBetDialogOpen(true);
  };

  const endDate = format(new Date(market.resolutionDate), "MMM d, yyyy");
  const yesPrice = Math.round(market.quote.yesPriceCents);
  const noPrice = Math.round(market.quote.noPriceCents);

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <Badge variant="secondary" className="text-xs">
            {market.category}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{endDate}</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4 leading-snug text-balance">{market.question}</h3>

        {market.settlementDates.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2">Settlement Dates</div>
            <div className="flex flex-wrap gap-2">
              {market.settlementDates.map((settlement, idx) => (
                <Badge key={idx} variant="outline" className="text-xs font-mono">
                  {settlement.label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => handleBet("YES")}
            className="p-4 rounded-lg border-2 border-success/20 bg-success/5 hover:bg-success/10 transition-colors text-left"
          >
            <div className="text-xs text-muted-foreground mb-1">YES</div>
            <div className="text-2xl font-bold text-success">{yesPrice}¢</div>
          </button>
          <button
            onClick={() => handleBet("NO")}
            className="p-4 rounded-lg border-2 border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left"
          >
            <div className="text-xs text-muted-foreground mb-1">NO</div>
            <div className="text-2xl font-bold text-destructive">{noPrice}¢</div>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>${(market.totalVolume / 1000).toFixed(0)}k volume</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{Math.round(market.openInterest)} shares</span>
          </div>
        </div>
      </Card>

      <BetDialog open={betDialogOpen} onOpenChange={setBetDialogOpen} market={market} outcome={selectedOutcome} onSuccess={() => window.location.reload()} />
    </>
  );
}
