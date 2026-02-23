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
import { Loader2, AlertTriangle, Wallet, Settings2 } from "lucide-react";
import type { Market, PortfolioSnapshot, OrderType } from "@/lib/api";
import { ordersApi, usersApi } from "@/lib/api";
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
  const [suggestedMarketPrice, setSuggestedMarketPrice] = useState<
    number | null
  >(null);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [limitPrice, setLimitPrice] = useState("");

  // The last successfully resolved price snapshot — used for both display and
  // button/balance logic so there is a single source of truth.
  const [committedPrice, setCommittedPrice] = useState<number | null>(null);
  const [committedShares, setCommittedShares] = useState(0);
  const [committedOrderType, setCommittedOrderType] =
    useState<OrderType>("market");
  // Collateral from server (null = unknown/not applicable)
  const [committedCollateralCents, setCommittedCollateralCents] = useState<
    number | null
  >(null);

  // Fetch portfolio when dialog opens
  useEffect(() => {
    if (open && user) {
      usersApi
        .getPortfolio()
        .then(setPortfolio)
        .catch(() => setPortfolio(null));
    }
  }, [open, user]);

  // Reset history index when outcomes change (e.g. switching interval → single)
  useEffect(() => {
    setSelectedHistoryIndex(0);
  }, [selectedOutcomes]);

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

        const priceData = await ordersApi.priceOrder({
          marketId: market.id,
          legs,
        });

        setSuggestedMarketPrice(priceData.priceCents);
      } catch {
        setSuggestedMarketPrice(null);
      }
    };

    const timer = setTimeout(fetchMarketPrice, 150);
    return () => clearTimeout(timer);
  }, [shares, selectedOutcomes, market.id]);

  useEffect(() => {
    const fetchPrice = async () => {
      if (shares === 0 || selectedOutcomes.length === 0) {
        setCommittedPrice(null);
        setCommittedShares(0);
        setCommittedCollateralCents(null);
        setFetchingPrice(false);
        return;
      }

      setFetchingPrice(true);
      try {
        const legs = selectedOutcomes.map((outcome) => ({
          securityId: outcome.id,
          quantity: shares,
        }));
        const priceData = user
          ? await ordersApi.priceOrderAuthenticated({
              marketId: market.id,
              legs,
            })
          : await ordersApi.priceOrder({ marketId: market.id, legs });
        setCommittedPrice(priceData.priceCents);
        setCommittedShares(shares);
        setCommittedOrderType("market");
        setCommittedCollateralCents(priceData.collateralRequiredCents ?? null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to fetch price",
        );
        // Keep committedPrice as-is so height doesn't jump
      } finally {
        setFetchingPrice(false);
      }
    };

    if (orderType === "limit") {
      // Display price comes from the user's entered limit price (local math).
      // Collateral still needs the server (authenticated endpoint).
      const timer = setTimeout(async () => {
        const limitPriceCents = limitPrice
          ? Math.round(parseFloat(limitPrice) * 100)
          : null;
        const signsMatch =
          limitPriceCents === null ||
          shares === 0 ||
          Math.sign(limitPriceCents) === Math.sign(shares);
        // Only commit when signs are valid — prevents wrong breakdown from showing
        if (limitPriceCents && shares !== 0 && signsMatch) {
          setCommittedPrice(limitPriceCents);
          setCommittedShares(shares);
          setCommittedOrderType("limit");
          // Fetch collateral from server for logged-in users
          if (user) {
            try {
              const legs = selectedOutcomes.map((outcome) => ({
                securityId: outcome.id,
                quantity: shares,
              }));
              const priceData = await ordersApi.priceOrderAuthenticated({
                marketId: market.id,
                legs,
              });
              setCommittedCollateralCents(
                priceData.collateralRequiredCents ?? null,
              );
            } catch {
              setCommittedCollateralCents(null);
            }
          } else {
            setCommittedCollateralCents(null);
          }
        } else if (!signsMatch) {
          // Clear stale committed price so breakdown disappears
          setCommittedPrice(null);
          setCommittedShares(0);
          setCommittedCollateralCents(null);
        }
        setFetchingPrice(false);
      }, 150);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(fetchPrice, 150);
    return () => clearTimeout(timer);
  }, [shares, selectedOutcomes, market.id, orderType, user, limitPrice]);

  const numOutcomes = selectedOutcomes.length;

  // All display and logic is driven by the committed snapshot
  const committedCostCents = Math.abs(committedPrice ?? 0);
  const committedCostDollars = committedCostCents / 100;
  const committedIsBuy = committedShares > 0;
  const committedIsSell = committedShares < 0;
  const committedPricePerShare =
    committedShares !== 0
      ? committedCostCents / Math.abs(committedShares * numOutcomes)
      : 0;
  const committedReturn = committedIsBuy ? Math.abs(committedShares) : 0;
  const committedProfit = committedIsBuy
    ? committedReturn - committedCostDollars
    : committedCostDollars;

  // Limit order sign validation: quantity and limit price must have the same sign
  const limitPriceParsed = limitPrice ? parseFloat(limitPrice) : null;
  const limitPriceSignMismatch =
    orderType === "limit" &&
    shares !== 0 &&
    limitPriceParsed !== null &&
    !isNaN(limitPriceParsed) &&
    Math.sign(limitPriceParsed) !== Math.sign(shares);

  // Balance
  const spendableBalance = portfolio?.spendableBalance ?? 0;
  const spendableBalanceDollars = spendableBalance / 100;

  const hasInsufficientBalance =
    committedIsBuy &&
    committedPrice !== null &&
    !fetchingPrice &&
    committedCostCents > spendableBalance;
  const hasInsufficientCollateral =
    committedIsSell &&
    user !== null &&
    committedCollateralCents !== null &&
    !fetchingPrice &&
    committedCollateralCents > spendableBalance + committedCostCents;

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

    if (orderType === "market" && committedPrice === null) {
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
      const tradeRequest: Parameters<typeof ordersApi.placeOrder>[0] = {
        marketId: market.id,
        legs,
        orderType,
        limitPriceCents:
          orderType === "limit" && limitPrice
            ? Math.round(parseFloat(limitPrice) * 100)
            : undefined,
      };

      const result = await ordersApi.placeOrder(tradeRequest);

      const action = shares > 0 ? "Bought" : "Sold";
      const orderTypeLabel = orderType === "market" ? "" : " (limit order)";

      if (!result.filled) {
        toast.success(`Limit order placed successfully!`);
      } else if (isInterval) {
        toast.success(
          `Interval trade${orderTypeLabel} filled! ${action} ${Math.abs(
            shares,
          )} shares across ${numOutcomes} outcomes for $${(
            Math.abs(result.priceCents) / 100
          ).toFixed(2)}`,
        );
      } else {
        toast.success(
          `Trade${orderTypeLabel} filled! ${action} ${Math.abs(shares)} shares of ${
            selectedSecurity?.outcome
          } for $${(Math.abs(result.priceCents) / 100).toFixed(2)}`,
        );
      }

      onOpenChange(false);
      setQuantity("");
      setCommittedPrice(null);
      setCommittedShares(0);
      setCommittedOrderType("market");
      setCommittedCollateralCents(null);
      setSuggestedMarketPrice(null);
      setLimitPrice("");
      setOrderType("market");
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

              {/* Order Type Tabs */}
              <Tabs
                defaultValue="market"
                onValueChange={(value) => {
                  const newType = value as OrderType;
                  setOrderType(newType);
                  // Only market orders need a re-fetch; limit price is local math
                  if (newType === "market" && shares !== 0) {
                    setFetchingPrice(true);
                  }
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market">Market Order</TabsTrigger>
                  <TabsTrigger value="limit">Limit Order</TabsTrigger>
                </TabsList>

                {/* Market Order Content */}
                <TabsContent value="market" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity-market">
                      {isInterval
                        ? "Quantity per outcome (shares)"
                        : "Quantity (shares)"}
                    </Label>
                    <Input
                      id="quantity-market"
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
                </TabsContent>

                {/* Limit Order Content */}
                <TabsContent value="limit" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity-limit">
                      {isInterval
                        ? "Quantity per outcome (shares)"
                        : "Quantity (shares)"}
                    </Label>
                    <Input
                      id="quantity-limit"
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
                          shares of EACH of the {numOutcomes} outcomes.
                        </>
                      ) : (
                        "Positive = buy (long), Negative = sell (short)."
                      )}
                    </p>
                  </div>
                  {/* Total Limit Price input */}
                  <div className="space-y-2">
                    <Label htmlFor="limitPrice">Maximum Total Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="limitPrice"
                        type="number"
                        placeholder={
                          suggestedMarketPrice && shares !== 0
                            ? (suggestedMarketPrice / 100).toFixed(2)
                            : "0.00"
                        }
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        step="0.01"
                        className={`pl-7 ${
                          limitPriceSignMismatch
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }`}
                      />
                    </div>
                    {limitPriceSignMismatch ? (
                      <p className="text-xs text-red-600 font-medium">
                        {shares > 0
                          ? "Buying requires a positive limit price."
                          : "Selling requires a negative limit price."}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Total maximum price you're willing to trade at. Use a
                        negative value when selling.
                        {suggestedMarketPrice && shares !== 0 && (
                          <span className="block mt-1 text-blue-600 font-medium">
                            Current market quote: $
                            {(suggestedMarketPrice / 100).toFixed(2)}
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Limit order info card */}
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-start gap-2">
                      <Settings2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-700">
                        <span className="font-medium">
                          How limit orders work:
                        </span>{" "}
                        Your order will execute when the market price reaches
                        your limit. Orders are good-til-canceled (GTC) and
                        remain active until filled or manually cancelled.
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Price display */}
              <div className="relative space-y-2 p-4 rounded-lg bg-muted/50">
                {/* Spinner overlay — shown during re-fetches so height never changes */}
                {fetchingPrice && committedPrice !== null && (
                  <div className="absolute top-3 right-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {fetchingPrice && committedPrice === null ? (
                  // First-ever load: no previous content to preserve, show full spinner
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {isInterval
                        ? "Calculating basket price..."
                        : "Calculating price..."}
                    </span>
                  </div>
                ) : committedPrice !== null &&
                  !(orderType === "limit" && !limitPrice) &&
                  !limitPriceSignMismatch ? (
                  // Render frozen committed values; dim while a re-fetch is in flight
                  <div
                    className={`space-y-2 transition-opacity duration-150 ${
                      fetchingPrice ? "opacity-50" : "opacity-100"
                    }`}
                  >
                    {/* Order type badge */}
                    {committedOrderType !== "market" && (
                      <div className="flex justify-between text-sm mb-2 pb-2 border-b">
                        <span className="text-muted-foreground">
                          Order Type
                        </span>
                        <Badge variant="outline" className="font-mono">
                          {committedOrderType.replace("_", "-").toUpperCase()}
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Action</span>
                      <span
                        className={`font-mono font-medium ${committedIsBuy ? "text-green-600" : "text-red-600"}`}
                      >
                        {committedIsBuy ? "BUY" : "SELL"}{" "}
                        {Math.abs(committedShares)}
                        {isInterval && ` × ${numOutcomes}`}
                      </span>
                    </div>
                    {isInterval && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Total shares
                        </span>
                        <span className="font-mono font-medium">
                          {Math.abs(committedShares) * numOutcomes} shares
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {committedOrderType === "market"
                          ? "Avg price per share"
                          : "Limit price per share"}
                      </span>
                      <span className="font-mono font-medium">
                        {committedPricePerShare.toFixed(2)}¢
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground font-medium">
                        {committedOrderType === "market"
                          ? committedIsBuy
                            ? "Total cost"
                            : "You receive"
                          : committedIsBuy
                            ? "Max cost (if filled)"
                            : "Min receive (if filled)"}
                      </span>
                      <span className="font-mono font-bold text-lg">
                        ${committedCostDollars.toFixed(2)}
                      </span>
                    </div>
                    {committedIsBuy && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {isInterval
                              ? "If ANY outcome wins"
                              : "If outcome wins"}
                          </span>
                          <span className="font-mono font-medium text-green-600">
                            ${committedReturn.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Potential profit
                          </span>
                          <span
                            className={`font-mono font-medium ${committedProfit > 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {committedProfit > 0 ? "+" : ""}$
                            {committedProfit.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                    {committedIsSell && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Profit if sold
                        </span>
                        <span className="font-mono font-medium text-green-600">
                          +${committedProfit.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {committedIsSell &&
                      committedCollateralCents !== null &&
                      committedCollateralCents > 0 && (
                        <div className="flex justify-between text-sm border-t pt-2">
                          <span className="text-muted-foreground">
                            Collateral required
                          </span>
                          <span className="font-mono font-medium text-amber-600">
                            ${(committedCollateralCents / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                    <div className="pt-2 border-t text-xs text-muted-foreground">
                      {committedOrderType === "market" ? (
                        <>
                          ✓ Real-time {isInterval ? "basket " : ""}price from
                          LMSR market maker
                        </>
                      ) : (
                        <>✓ {committedOrderType.replace("_", "-")} order</>
                      )}
                    </div>
                  </div>
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
                    You need ${committedCostDollars.toFixed(2)} but only have $
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
                    {(committedCollateralCents / 100).toFixed(2)} collateral.
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
                    limitPriceSignMismatch ||
                    (orderType === "market" &&
                      (committedPrice === null || fetchingPrice)) ||
                    (orderType === "limit" && !limitPrice) ||
                    (user !== null &&
                      (hasInsufficientBalance || hasInsufficientCollateral))
                  }
                  className="flex-1"
                  variant={shares < 0 ? "destructive" : "default"}
                >
                  {loading
                    ? "Placing..."
                    : !user
                      ? "Sign In Required"
                      : limitPriceSignMismatch
                        ? "Fix limit price sign"
                        : fetchingPrice && orderType === "market"
                          ? "Loading..."
                          : hasInsufficientBalance
                            ? "Insufficient Balance"
                            : hasInsufficientCollateral
                              ? "Insufficient Collateral"
                              : committedPrice !== null
                                ? orderType === "market"
                                  ? committedIsBuy
                                    ? `Buy for $${committedCostDollars.toFixed(2)}`
                                    : `Sell for $${committedCostDollars.toFixed(2)}`
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
