"use client";

import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { Market } from "@/lib/api";
import { tradesApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

interface BetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market;
  outcome: string;
  onSuccess?: () => void;
}

export function BetDialog({ 
  open, 
  onOpenChange, 
  market, 
  outcome, 
  onSuccess 
}: BetDialogProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);

  const selectedSecurity = useMemo(() => {
    return market.securities.find(s => s.id === outcome);
  }, [market.securities, outcome]);

  const quote = useMemo(() => {
    return market.quotes.find(q => q.securityId === outcome);
  }, [market.quotes, outcome]);

  const shares = quantity ? Number.parseInt(quantity) : 0;
  const isBuy = shares > 0;
  const isSell = shares < 0;

  // Fetch price from backend whenever quantity changes
  useEffect(() => {
    const fetchPrice = async () => {
      if (shares === 0) {
        setCalculatedPrice(null);
        return;
      }

      setFetchingPrice(true);
      try {
        // Backend handles negative quantities for sells
        const priceData = await tradesApi.priceTrade(outcome, shares);
        setCalculatedPrice(priceData.price);
      } catch (error) {
        console.error("Failed to fetch price:", error);
        setCalculatedPrice(null);
      } finally {
        setFetchingPrice(false);
      }
    };

    // Debounce the price fetch
    const timer = setTimeout(fetchPrice, 500);
    return () => clearTimeout(timer);
  }, [shares, outcome]);

  // Calculate costs (price is always positive, sign is in quantity)
  const totalCostCents = Math.abs(calculatedPrice || 0);
  const totalCostDollars = totalCostCents / 100;
  const pricePerShareCents = shares !== 0 ? totalCostCents / Math.abs(shares) : 0;

  // For buy: pay cost, get shares worth $1 each if win
  // For sell: receive cost, lose shares worth $1 each if win
  const potentialReturnDollars = isBuy ? Math.abs(shares) : 0;
  const potentialProfitDollars = isBuy 
    ? potentialReturnDollars - totalCostDollars
    : totalCostDollars; // For sell, you receive the money

  const handlePlaceTrade = async () => {
    if (!user) {
      toast.error("Please sign in to place a trade");
      return;
    }

    if (shares === 0) {
      toast.error("Enter a quantity (positive to buy, negative to sell)");
      return;
    }

    if (!selectedSecurity) {
      toast.error("Invalid outcome selected");
      return;
    }

    if (!calculatedPrice) {
      toast.error("Please wait for price to load");
      return;
    }

    if (totalCostDollars < 0.5) {
      toast.error("Minimum trade value is $0.50");
      return;
    }

    try {
      setLoading(true);
      
      await tradesApi.placeTrade({
        security_id: outcome,
        quantity: shares, // Negative for sell, positive for buy
      });
      
      const action = isBuy ? "Bought" : "Sold";
      toast.success(`Trade placed! ${action} ${Math.abs(shares)} shares of ${selectedSecurity.outcome}`);
      onOpenChange(false);
      setQuantity("");
      setCalculatedPrice(null);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to place trade");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">Place Your Trade</DialogTitle>
          <DialogDescription className="text-balance">{market.question}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Trading</div>
              <div className="text-2xl font-bold">
                {selectedSecurity?.outcome || outcome}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Current price</div>
              <div className="text-lg font-mono">
                {quote?.buyUnitPriceCents 
                  ? `${quote.buyUnitPriceCents.toFixed(2)}¢`
                  : "—"
                }
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (shares)</Label>
            <Input
              id="quantity"
              type="number"
              placeholder="10 (or -10 to sell)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              step="1"
            />
            <p className="text-xs text-muted-foreground">
              Positive = buy (long), Negative = sell (short). Each share pays $1 if outcome occurs.
            </p>
          </div>

          {quantity && shares !== 0 && (
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Action</span>
                <span className={`font-mono font-medium ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                  {isBuy ? `BUY ${shares}` : `SELL ${Math.abs(shares)}`}
                </span>
              </div>
              
              {fetchingPrice ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Calculating price...
                  </span>
                </div>
              ) : calculatedPrice ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg price per share</span>
                    <span className="font-mono font-medium">
                      {pricePerShareCents < 100 
                        ? `${pricePerShareCents.toFixed(2)}¢`
                        : `$${(pricePerShareCents / 100).toFixed(2)}`
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground font-medium">
                      {isBuy ? 'Total cost' : 'You receive'}
                    </span>
                    <span className="font-mono font-bold text-lg">
                      ${totalCostDollars.toFixed(2)}
                    </span>
                  </div>
                  {isBuy && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">If outcome wins</span>
                        <span className="font-mono font-medium text-green-600">
                          ${potentialReturnDollars.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Potential profit</span>
                        <span className={`font-mono font-medium ${potentialProfitDollars > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {potentialProfitDollars > 0 ? '+' : ''}${potentialProfitDollars.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  {isSell && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profit if sold</span>
                      <span className="font-mono font-medium text-green-600">
                        +${potentialProfitDollars.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    ✓ Real-time price from LMSR market maker
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Enter quantity to see price
                </div>
              )}
            </div>
          )}

          {market.settlementDates.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Settlement Dates</div>
              <div className="flex flex-wrap gap-2">
                {market.settlementDates.map((settlement, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs font-mono">
                    {settlement.label}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Market evaluated at multiple dates. Cash out at any settlement if favorable.
              </p>
            </div>
          )}
        </div>

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
            disabled={shares === 0 || loading || !user || !calculatedPrice || fetchingPrice}
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
                    : "Enter quantity"
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}