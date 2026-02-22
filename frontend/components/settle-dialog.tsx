"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gavel } from "lucide-react";
import { marketsApi, type Market } from "@/lib/api";
import { toast } from "sonner";

interface SettleDialogProps {
  market: Market;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettleSuccess?: () => void;
  asMarketMaker?: boolean;
}

export function SettleDialog({
  market,
  open,
  onOpenChange,
  onSettleSuccess,
  asMarketMaker = false,
}: SettleDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const outcomes = useMemo(() => {
    if (!market?.securities) return [];
    return market.securities;
  }, [market?.securities]);

  const handleSettle = async () => {
    if (!selectedOutcome) {
      toast.error("Please select a winning outcome");
      return;
    }

    setLoading(true);
    try {
      if (asMarketMaker) {
        await marketsApi.settleMarketAsMaker(selectedOutcome);
      } else {
        await marketsApi.settleMarket(selectedOutcome);
      }
      toast.success("Market settled successfully");
      setSelectedOutcome("");
      onOpenChange(false);
      onSettleSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to settle market",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gavel className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Settle Market</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Select the winning outcome for: <strong>{market.question}</strong>
        </p>

        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
          {outcomes.map((outcome) => (
            <button
              key={outcome.id}
              onClick={() => setSelectedOutcome(outcome.id)}
              className={`w-full p-3 rounded-lg border-2 text-left transition ${
                selectedOutcome === outcome.id
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="font-medium">{outcome.outcome}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSettle}
            disabled={loading || !selectedOutcome}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {loading ? "Settling..." : "Settle"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
