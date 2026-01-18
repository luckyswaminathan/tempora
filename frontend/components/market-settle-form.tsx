"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Market } from "@/lib/api";
import { marketsApi } from "@/lib/api";

interface MarketSettleFormProps {
  market: Market;
  onSettled?: () => void;
  onSettleSuccess?: () => void;
  onCancel?: () => void;
}

export function MarketSettleForm({
  market,
  onSettled,
  onSettleSuccess,
  onCancel,
}: MarketSettleFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [settled, setSettled] = useState(market.status === "resolved");

  const handleSettle = async () => {
    if (!selectedOutcome) {
      toast.error("Please select a winning outcome");
      return;
    }

    setLoading(true);
    try {
      await marketsApi.settleMarket(selectedOutcome);
      toast.success(`Market settled with outcome: ${selectedOutcome}`);
      setSettled(true);
      onSettled?.();
      onSettleSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to settle market",
      );
    } finally {
      setLoading(false);
    }
  };

  if (settled) {
    return (
      <Card className="p-4 border-green-200 bg-green-50 dark:bg-green-950/20">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-green-900 dark:text-green-100">
              Settled
            </h4>
            <p className="text-sm text-green-700 dark:text-green-300">
              This market has been resolved
            </p>
          </div>
          <Badge className="bg-green-600">Resolved</Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold mb-3">Settle Market</h4>
          <p className="text-sm text-muted-foreground mb-4">
            {market.question}
          </p>
        </div>

        <div>
          <Label htmlFor={`outcomes-${market.id}`}>
            Select Winning Outcome
          </Label>
          <select
            id={`outcomes-${market.id}`}
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Choose outcome --</option>
            {market.securities.map((security) => (
              <option key={security.id} value={security.id}>
                {security.outcome}
              </option>
            ))}
          </select>
        </div>

        <Button
          onClick={handleSettle}
          disabled={loading || !selectedOutcome}
          className="w-full"
        >
          {loading ? "Settling..." : "Settle Market"}
        </Button>

        {onCancel && (
          <Button
            onClick={onCancel}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
