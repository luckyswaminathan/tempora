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
import {
  Loader2,
  AlertTriangle,
  Wallet,
  ChevronDown,
  ChevronUp,
  Settings2,
} from "lucide-react";
import type {
  Market,
  PortfolioSnapshot,
  OrderType,
  TimeInForce,
} from "@/lib/api";
import { tradesApi, usersApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { ProbabilityGraph } from "@/components/probability-graph";

interface TradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market;
  selectedOutcomes: Array<{
    id: string;
    outcome: string;
    probability: number;
  }>;
  onSuccess?: () => void;
  onSignInClick?: () => void;
}

export function TradeDialog({
  open,
  onOpenChange,
  market,
  selectedOutcomes,
  onSuccess,
  onSignInClick,
}: TradeDialogProps) {
  const { user } = useAuth();
  const isInterval = selectedOutcomes.length > 1;
  const isSingle = selectedOutcomes.length === 1;

  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [suggestedMarketPrice, setSuggestedMarketPrice] = useState<
    number | null
  >(null); // Avg price from backend for limit placeholder
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);

  // Advanced order options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("gtc");

  // Fetch portfolio when dialog opens
  useEffect(() => {
    if (open && user) {
      usersApi
        .getPortfolio()
        .then(setPortfolio)
        .catch(() => setPortfolio(null));
    }
  }, [open, user]);

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

  // Fetch market price to use as suggested limit price
  useEffect(() => {
    const fetchMarketPrice = async () => {
      if (shares === 0 || selectedOutcomes.length === 0) {
        setSuggestedMarketPrice(null);
        return;
      }

      try {
        const legs = selectedOutcomes.map((outcome) => ({
          securityId: outcome.id,
          quantity: shares,
        }));

        const priceData = await tradesApi.priceTrade({
          marketId: market.id,
          legs,
        });

        // For intervals: calculate price per interval unit (cost to buy 1 share of each outcome)
        // For single: calculate price per share
        const numOutcomes = selectedOutcomes.length;
        const avgPricePerUnit = priceData.priceCents / Math.abs(shares);
        setSuggestedMarketPrice(avgPricePerUnit);
      } catch {
        setSuggestedMarketPrice(null);
      }
    };

    const timer = setTimeout(fetchMarketPrice, 500);
    return () => clearTimeout(timer);
  }, [shares, selectedOutcomes, market.id]);

  useEffect(() => {
    const fetchPrice = async () => {
      // For limit orders, use the user-specified limit price
      // Limit price is per interval unit (cost for 1 share of each outcome)
      if (orderType === "limit") {
        setFetchingPrice(false);
        const limitPriceCents = limitPrice
          ? Math.round(parseFloat(limitPrice) * 100)
          : null;
        if (limitPriceCents && shares !== 0) {
          // Total cost = limit price per unit * number of units (shares)
          setCalculatedPrice(limitPriceCents * Math.abs(shares));
        } else {
          setCalculatedPrice(null);
        }
        return;
      }

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
  }, [shares, selectedOutcomes, market.id, orderType, limitPrice]);

  const totalCostCents = Math.abs(calculatedPrice || 0);
  const totalCostDollars = totalCostCents / 100;
  const pricePerShareCents =
    shares !== 0 ? totalCostCents / Math.abs(shares) : 0;
  const numOutcomes = selectedOutcomes.length;

  // Balance calculations
  const spendableBalance = portfolio?.spendableBalance ?? 0;
  const spendableBalanceDollars = spendableBalance / 100;
  const collateralLocked = portfolio?.collateralLocked ?? 0;
  const walletBalance = portfolio?.wallet ?? 0;

  // For shorts, calculate collateral required ($1 per share)
  const collateralRequiredCents = isSell
    ? Math.abs(shares) * numOutcomes * 100
    : 0;
  const collateralRequiredDollars = collateralRequiredCents / 100;

  // Check if user has enough balance
  const hasInsufficientBalance =
    isBuy && calculatedPrice !== null && totalCostCents > spendableBalance;
  const hasInsufficientCollateral =
    isSell &&
    calculatedPrice !== null &&
    walletBalance + Math.abs(calculatedPrice) <
      collateralLocked + collateralRequiredCents;

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

    // Validate limit price for limit orders
    if (orderType === "limit" && !limitPrice) {
      toast.error("Please enter a limit price");
      return;
    }

    if (orderType === "market" && calculatedPrice === null) {
      toast.error("Please wait for price to load");
      return;
    }

    try {
      setLoading(true);

      const legs = selectedOutcomes.map((outcome) => ({
        securityId: outcome.id,
        quantity: shares,
      }));

      // Build trade request with advanced options
      const tradeRequest: Parameters<typeof tradesApi.placeTrade>[0] = {
        marketId: market.id,
        legs,
        orderType,
        timeInForce: orderType === "limit" ? timeInForce : undefined,
        limitPriceCents:
          orderType === "limit" && limitPrice
            ? Math.round(parseFloat(limitPrice) * 100)
            : undefined,
      };

      const result = await tradesApi.placeTrade(tradeRequest);

      const action = isBuy ? "Bought" : "Sold";
      const orderTypeLabel = orderType === "market" ? "" : " (limit order)";

      if (result.orderStatus === "pending") {
        toast.success(`Limit order placed! Your order is pending execution.`);
      } else if (result.orderStatus === "partial" && result.filledQuantity) {
        toast.success(
          `Partial fill${orderTypeLabel}! ${action} ${result.filledQuantity} of ${Math.abs(shares)} requested shares at your max avg price.`,
        );
      } else if (isInterval) {
        toast.success(
          `Interval trade placed${orderTypeLabel}! ${action} ${Math.abs(
            shares,
          )} shares across ${numOutcomes} outcomes`,
        );
      } else {
        toast.success(
          `Trade placed${orderTypeLabel}! ${action} ${Math.abs(shares)} shares of ${
            selectedSecurity?.outcome
          }`,
        );
      }

      onOpenChange(false);
      setQuantity("");
      setCalculatedPrice(null);
      setSuggestedMarketPrice(null);
      setLimitPrice("");
      setOrderType("market");
      setShowAdvanced(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to place trade",
      );
    } finally {
      setLoading(false);
    }
  };

  const probabilityContent = (
    <>
      {selectedOutcomes.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="history-security">Select outcome</Label>
          <select
            id="history-security"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={selectedHistoryIndex}
            onChange={(e) => setSelectedHistoryIndex(Number(e.target.value))}
          >
            {selectedOutcomes.map((outcome, idx) => (
              <option key={outcome.id} value={idx}>
                {outcome.outcome}
              </option>
            ))}
          </select>
        </div>
      )}
      {selectedOutcomes.map((outcome, idx) => (
        <div
          key={outcome.id}
          style={{
            display: idx === selectedHistoryIndex ? "block" : "none",
          }}
        >
          <ProbabilityGraph securityId={outcome.id} outcome={outcome.outcome} />
        </div>
      ))}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] flex flex-col p-0 gap-0"
        showCloseButton={false}
      >
        {/* Fixed header with close button */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 pt-6 pb-4">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            <span className="sr-only">Close</span>
          </button>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-balance">
              {isInterval ? "Trade Interval" : "Place Your Trade"}
            </DialogTitle>
            <DialogDescription className="text-balance">
              {market.question}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <Tabs defaultValue="trade">
            <TabsList className="grid w-full grid-cols-2 mt-4">
              <TabsTrigger value="trade">Trade</TabsTrigger>
              <TabsTrigger value="history">Probability</TabsTrigger>
            </TabsList>

            <TabsContent value="trade" className="space-y-4 py-4">
              {/* Balance display */}
              {user && portfolio && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Spendable Balance
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-green-700">
                      ${spendableBalanceDollars.toFixed(2)}
                    </div>
                    {collateralLocked > 0 && (
                      <div className="text-xs text-muted-foreground">
                        (${(collateralLocked / 100).toFixed(2)} locked as
                        collateral)
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                      You'll trade {shares !== 0 ? Math.abs(shares) : "N"}{" "}
                      shares of EACH of the {numOutcomes} outcomes. Only one
                      outcome can win, paying $1 per share.
                    </>
                  ) : (
                    "Positive = buy (long), Negative = sell (short). Each share pays $1 if outcome occurs."
                  )}
                </p>
              </div>

              {/* Advanced Options Toggle */}
              <div className="border rounded-lg">
                <button
                  type="button"
                  className="flex items-center justify-between w-full p-3 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    <span>Advanced Options</span>
                    {orderType !== "market" && (
                      <Badge variant="secondary" className="text-xs">
                        {orderType.replace("_", "-")}
                      </Badge>
                    )}
                  </div>
                  {showAdvanced ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="p-3 pt-0 space-y-4 border-t">
                    {/* Order Type Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="orderType">Order Type</Label>
                      <select
                        id="orderType"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={orderType}
                        onChange={(e) =>
                          setOrderType(e.target.value as OrderType)
                        }
                      >
                        <option value="market">Market Order</option>
                        <option value="limit">Limit Order</option>
                      </select>
                      <p className="text-xs text-muted-foreground">
                        {orderType === "market" &&
                          "Execute immediately at current market price."}
                        {orderType === "limit" &&
                          "Execute only at your specified price or better."}
                      </p>
                    </div>

                    {/* Limit Price Input */}
                    {orderType === "limit" && (
                      <div className="space-y-2">
                        <Label htmlFor="limitPrice">
                          {isInterval
                            ? "Max Price (per interval unit)"
                            : "Max Average Price (per share)"}
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            $
                          </span>
                          <Input
                            id="limitPrice"
                            type="number"
                            placeholder={
                              suggestedMarketPrice
                                ? (suggestedMarketPrice / 100).toFixed(2)
                                : quote?.buyUnitPriceCents
                                  ? (quote.buyUnitPriceCents / 100).toFixed(2)
                                  : selectedOutcomes.length > 0
                                    ? selectedOutcomes
                                        .reduce(
                                          (sum, o) => sum + o.probability,
                                          0,
                                        )
                                        .toFixed(2)
                                    : "0.50"
                            }
                            value={limitPrice}
                            onChange={(e) => setLimitPrice(e.target.value)}
                            step="0.01"
                            min="0"
                            max={
                              isInterval
                                ? selectedOutcomes.length.toString()
                                : "1"
                            }
                            className="pl-7"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isInterval
                            ? isBuy
                              ? `Max price for 1 share of each of the ${numOutcomes} outcomes. Only one can win ($1 payout).`
                              : `Min price for selling 1 share of each of the ${numOutcomes} outcomes.`
                            : isBuy
                              ? "Maximum average price you're willing to pay per share."
                              : "Minimum average price for your sale per share."}
                          {suggestedMarketPrice && shares !== 0 && (
                            <span className="block mt-1 text-blue-600">
                              Current market: $
                              {(suggestedMarketPrice / 100).toFixed(2)}
                              {isInterval ? "/interval" : "/share"} for{" "}
                              {Math.abs(shares)}{" "}
                              {isInterval ? "intervals" : "shares"}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Time In Force */}
                    {orderType === "limit" && (
                      <div className="space-y-2">
                        <Label htmlFor="timeInForce">Time In Force</Label>
                        <select
                          id="timeInForce"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={timeInForce}
                          onChange={(e) =>
                            setTimeInForce(e.target.value as TimeInForce)
                          }
                        >
                          <option value="gtc">Good Til Cancelled (GTC)</option>
                          <option value="day">Day Only</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          {timeInForce === "gtc" &&
                            "Order remains active until filled or cancelled."}
                          {timeInForce === "day" &&
                            "Order expires at end of trading day."}
                        </p>
                      </div>
                    )}

                    {/* Order type indicator info */}
                    {orderType === "limit" && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-start gap-2">
                          <Settings2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-blue-700">
                            <span className="font-medium">
                              How LMSR limit orders work:
                            </span>{" "}
                            The system will fill as many shares as possible
                            while keeping your average price at or below your
                            limit. For example, if you request 1000 shares at
                            $0.50 avg but LMSR can only fill 500 at that price,
                            you'll get a partial fill of 500 shares.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                    {/* Order type badge */}
                    {orderType !== "market" && (
                      <div className="flex justify-between text-sm mb-2 pb-2 border-b">
                        <span className="text-muted-foreground">
                          Order Type
                        </span>
                        <Badge variant="outline" className="font-mono">
                          {orderType.replace("_", "-").toUpperCase()}
                        </Badge>
                      </div>
                    )}
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
                        {orderType === "market"
                          ? "Avg price per share"
                          : "Limit price per share"}
                      </span>
                      <span className="font-mono font-medium">
                        {pricePerShareCents < 100
                          ? `${pricePerShareCents.toFixed(2)}¢`
                          : `$${(pricePerShareCents / 100).toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground font-medium">
                        {orderType === "market"
                          ? isBuy
                            ? "Total cost"
                            : "You receive"
                          : isBuy
                            ? "Max cost (if filled)"
                            : "Min receive (if filled)"}
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
                    {isSell && collateralRequiredCents > 0 && (
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground">
                          Collateral required
                        </span>
                        <span className="font-mono font-medium text-amber-600">
                          ${collateralRequiredDollars.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      {orderType === "market" ? (
                        <>
                          ✓ Real-time {isInterval ? "basket " : ""}price from
                          LMSR market maker
                        </>
                      ) : (
                        <>
                          ✓ {orderType.replace("_", "-")} order •{" "}
                          {timeInForce.toUpperCase()}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    {orderType === "market"
                      ? "Enter quantity to see price"
                      : "Enter quantity and limit price"}
                  </div>
                )}
              </div>

              {/* Insufficient balance warning */}
              {hasInsufficientBalance && user && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <div className="text-sm text-red-700">
                    <span className="font-medium">Insufficient balance.</span>{" "}
                    You need ${totalCostDollars.toFixed(2)} but only have $
                    {spendableBalanceDollars.toFixed(2)} available to spend.
                  </div>
                </div>
              )}

              {/* Insufficient collateral warning for shorts */}
              {hasInsufficientCollateral && user && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div className="text-sm text-amber-700">
                    <span className="font-medium">
                      Insufficient collateral.
                    </span>{" "}
                    Short positions require $
                    {collateralRequiredDollars.toFixed(2)} collateral.
                  </div>
                </div>
              )}

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
                  onClick={() => {
                    if (!user && onSignInClick) {
                      onOpenChange(false);
                      onSignInClick();
                    } else {
                      handlePlaceTrade();
                    }
                  }}
                  disabled={
                    shares === 0 ||
                    loading ||
                    (orderType === "market" &&
                      (calculatedPrice === null || fetchingPrice)) ||
                    (orderType === "limit" && !limitPrice) ||
                    (user !== null &&
                      (hasInsufficientBalance || hasInsufficientCollateral))
                  }
                  className="flex-1"
                  variant={isSell ? "destructive" : "default"}
                >
                  {loading
                    ? "Placing..."
                    : !user
                      ? "Sign In Required"
                      : fetchingPrice && orderType === "market"
                        ? "Loading..."
                        : hasInsufficientBalance
                          ? "Insufficient Balance"
                          : hasInsufficientCollateral
                            ? "Insufficient Collateral"
                            : calculatedPrice !== null
                              ? orderType === "market"
                                ? isBuy
                                  ? `Buy for $${totalCostDollars.toFixed(2)}`
                                  : `Sell for $${totalCostDollars.toFixed(2)}`
                                : "Place limit order"
                              : orderType === "limit"
                                ? "Place limit order"
                                : "Enter quantity"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="py-4 space-y-4">
              {probabilityContent}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
