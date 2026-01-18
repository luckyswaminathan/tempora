"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import type { Market } from "@/lib/api";
import { tradesApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { PriceHistoryChart } from "@/components/price-history-chart";

interface BetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market;
  selectedOutcomes: Array<{
    id: string;
    outcome: string;
    probability: number;
  }>;
  onSuccess?: () => void;
}

export function BetDialog({
  open,
  onOpenChange,
  market,
  selectedOutcomes,
  onSuccess,
}: BetDialogProps) {
  const { user } = useAuth();
  const isInterval = selectedOutcomes.length > 1;
  const isSingle = selectedOutcomes.length === 1;

  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("trade");

  // For single outcome, get the security directly
  const securityId = isSingle ? selectedOutcomes[0].id : undefined;

  const selectedSecurity = useMemo(() => {
    if (!securityId) return null;
    return market.securities.find((s) => s.id === securityId);
  }, [market.securities, securityId]);

  const quote = useMemo(() => {
    if (!securityId) return null;
    return market.quotes.find((q) => q.securityId === securityId);
  }, [market.quotes, securityId]);

  const shares = quantity ? Number.parseInt(quantity) : 0;
  const isBuy = shares > 0;
  const isSell = shares < 0;

  useEffect(() => {
    const fetchPrice = async () => {
      if (shares === 0 || selectedOutcomes.length === 0) {
        setFetchingPrice(false);
        setCalculatedPrice(null);
        return;
      }

      setFetchingPrice(true);
      try {
        // Build legs from selectedOutcomes
        const legs = selectedOutcomes.map((outcome) => ({
          securityId: outcome.id,
          quantity: shares,
        }));

        const priceData = await tradesApi.priceTrade({
          marketId: market.id,
          legs,
        });

        setCalculatedPrice(priceData.priceCents);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to fetch price",
        );
        setCalculatedPrice(null);
      } finally {
        setFetchingPrice(false);
      }
    };

    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [shares, selectedOutcomes, market.id]);

  const totalCostCents = Math.abs(calculatedPrice || 0);
  const totalCostDollars = totalCostCents / 100;
  const pricePerShareCents =
    shares !== 0 ? totalCostCents / Math.abs(shares) : 0;
  const numOutcomes = selectedOutcomes.length;

  // Compute interval text from selected outcomes
  const intervalText =
    numOutcomes > 1
      ? `${selectedOutcomes[0].outcome} - ${
          selectedOutcomes[numOutcomes - 1].outcome
        }`
      : selectedOutcomes[0]?.outcome || "";

  const intervalProbability = selectedOutcomes.reduce(
    (sum, o) => sum + o.probability,
    0,
  );

  const potentialReturnDollars = isBuy ? Math.abs(shares) : 0;
  const potentialProfitDollars = isBuy
    ? potentialReturnDollars - totalCostDollars
    : totalCostDollars;

  const handlePlaceTrade = async () => {
    if (!user) {
      toast.error("Please sign in to place a trade");
      return;
    }

    if (shares === 0) {
      toast.error("Enter a quantity (positive to buy, negative to sell)");
      return;
    }

    if (selectedOutcomes.length === 0) {
      toast.error("No outcomes selected");
      return;
    }

    if (!calculatedPrice) {
      toast.error("Please wait for price to load");
      return;
    }

    try {
      setLoading(true);

      const legs = selectedOutcomes.map((outcome) => ({
        securityId: outcome.id,
        quantity: shares,
      }));

      await tradesApi.placeTrade({
        marketId: market.id,
        legs,
      });

      const action = isBuy ? "Bought" : "Sold";
      if (isInterval) {
        toast.success(
          `Interval trade placed! ${action} ${Math.abs(
            shares,
          )} shares across ${numOutcomes} outcomes`,
        );
      } else {
        toast.success(
          `Trade placed! ${action} ${Math.abs(shares)} shares of ${
            selectedSecurity?.outcome
          }`,
        );
      }

      onOpenChange(false);
      setQuantity("");
      setCalculatedPrice(null);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to place trade",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-x-auto">
        <DialogHeader>
          <DialogTitle className="text-balance">
            {isInterval ? "Trade Interval" : "Place Your Trade"}
          </DialogTitle>
          <DialogDescription className="text-balance">
            {market.question}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          defaultValue="trade"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="trade">Trade Details</TabsTrigger>
            {!isInterval && securityId && (
              <TabsTrigger value="history">Price History</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="trade" className="space-y-4 py-4">
            {/* Header card */}
            {isInterval ? (
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-sm text-muted-foreground mb-1">
                  Trading interval
                </div>
                <div className="text-2xl font-bold mb-2">{intervalText}</div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Outcomes: </span>
                    <span className="font-medium">{numOutcomes}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Combined prob:{" "}
                    </span>
                    <span className="font-medium">
                      {(intervalProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Trading
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedSecurity?.outcome || "UNKNOWN"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">
                    Current price
                  </div>
                  <div className="text-lg font-mono">
                    {quote?.buyUnitPriceCents
                      ? `${quote.buyUnitPriceCents}¢`
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Quantity input */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {isInterval
                  ? "Quantity per outcome (shares)"
                  : "Quantity (shares)"}
              </Label>
              <Input
                id="quantity"
                type="number"
                placeholder="10 (or -10 to sell)"
                value={quantity}
                onChange={(e) => {
                  setFetchingPrice(true);
                  setQuantity(e.target.value);
                }}
                step="1"
              />
              <p className="text-xs text-muted-foreground">
                {isInterval ? (
                  <>
                    You'll trade {shares !== 0 ? Math.abs(shares) : "N"} shares
                    of EACH of the {numOutcomes} outcomes. Only one outcome can
                    win, paying $1 per share.
                  </>
                ) : (
                  "Positive = buy (long), Negative = sell (short). Each share pays $1 if outcome occurs."
                )}
              </p>
            </div>

            {/* Price display */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              {fetchingPrice ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {isInterval
                      ? "Calculating basket price..."
                      : "Calculating price..."}
                  </span>
                </div>
              ) : calculatedPrice !== null ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Action</span>
                    <span
                      className={`font-mono font-medium ${
                        isBuy ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isBuy ? "BUY" : "SELL"} {Math.abs(shares)}
                      {isInterval && ` × ${numOutcomes}`}
                    </span>
                  </div>
                  {isInterval && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total shares
                      </span>
                      <span className="font-mono font-medium">
                        {Math.abs(shares) * numOutcomes} shares
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Avg price per share
                    </span>
                    <span className="font-mono font-medium">
                      {pricePerShareCents < 100
                        ? `${pricePerShareCents.toFixed(2)}¢`
                        : `$${(pricePerShareCents / 100).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground font-medium">
                      {isBuy ? "Total cost" : "You receive"}
                    </span>
                    <span className="font-mono font-bold text-lg">
                      ${totalCostDollars.toFixed(2)}
                    </span>
                  </div>
                  {isBuy && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {isInterval
                            ? "If ANY outcome wins"
                            : "If outcome wins"}
                        </span>
                        <span className="font-mono font-medium text-green-600">
                          ${potentialReturnDollars.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Potential profit
                        </span>
                        <span
                          className={`font-mono font-medium ${
                            potentialProfitDollars > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {potentialProfitDollars > 0 ? "+" : ""}$
                          {potentialProfitDollars.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  {isSell && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Profit if sold
                      </span>
                      <span className="font-mono font-medium text-green-600">
                        +${potentialProfitDollars.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    ✓ Real-time {isInterval ? "basket " : ""}price from LMSR
                    market maker
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Enter quantity to see price
                </div>
              )}
            </div>

            {/* Interval outcomes list */}
            {isInterval && selectedOutcomes.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Outcomes in basket</div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {selectedOutcomes.map((outcome) => (
                    <Badge
                      key={outcome.id}
                      variant="outline"
                      className="text-xs"
                    >
                      {outcome.outcome}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Settlement dates */}
            {!isInterval &&
              market.settlementDates &&
              market.settlementDates.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Settlement Dates</div>
                  <div className="flex flex-wrap gap-2">
                    {market.settlementDates.map((settlement, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs font-mono"
                      >
                        {settlement.label}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Market evaluated at multiple dates. Cash out at any
                    settlement if favorable.
                  </p>
                </div>
              )}
          </TabsContent>

          {!isInterval && securityId && (
            <TabsContent value="history" className="py-4">
              <PriceHistoryChart
                securityId={securityId}
                outcome={selectedSecurity?.outcome || "Unknown"}
              />
            </TabsContent>
          )}
        </Tabs>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePlaceTrade}
            disabled={
              shares === 0 ||
              loading ||
              !user ||
              !calculatedPrice ||
              fetchingPrice
            }
            className="flex-1"
            variant={isSell ? "destructive" : "default"}
          >
            {loading
              ? "Placing..."
              : !user
                ? "Sign In Required"
                : fetchingPrice
                  ? "Loading..."
                  : calculatedPrice
                    ? isBuy
                      ? `Buy for $${totalCostDollars.toFixed(2)}`
                      : `Sell for $${totalCostDollars.toFixed(2)}`
                    : "Enter quantity"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
