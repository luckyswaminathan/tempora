import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Wallet,
  History,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";
import { ordersApi, type PortfolioSnapshot, type OrderRecord } from "@/lib/api";

interface OutcomeDetailSheetProps {
  selectedOutcome: {
    marketId: string;
    securityId: string;
    holding: PortfolioSnapshot["holdings"][0];
  } | null;
  onClose: () => void;
  tradeHistory: Record<string, OrderRecord[]>;
  loadingHistory: Set<string>;
  fetchTradeHistory: (marketId: string) => Promise<void>;
}

export function OutcomeDetailSheet({
  selectedOutcome,
  onClose,
  tradeHistory,
  loadingHistory,
  fetchTradeHistory,
}: OutcomeDetailSheetProps) {
  // Fetch trade history when outcome is selected
  useEffect(() => {
    if (selectedOutcome && !tradeHistory[selectedOutcome.marketId]) {
      fetchTradeHistory(selectedOutcome.marketId);
    }
  }, [selectedOutcome, tradeHistory, fetchTradeHistory]);

  // Filter trades for the selected security
  const selectedOutcomeTrades = useMemo(() => {
    if (!selectedOutcome) return [];

    const marketOrders = tradeHistory[selectedOutcome.marketId] || [];
    // Filter orders that have trades for this specific security
    return marketOrders
      .map((order) => ({
        ...order,
        trades: order.trades.filter(
          (t) => t.securityId === selectedOutcome.securityId,
        ),
      }))
      .filter((order) => order.trades.length > 0);
  }, [selectedOutcome, tradeHistory]);

  return (
    <Sheet open={!!selectedOutcome} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {selectedOutcome && (
          <>
            <SheetHeader className="mb-6">
              <SheetTitle className="text-left">
                <Badge variant="secondary" className="font-mono text-lg mb-2">
                  {selectedOutcome.holding.outcome}
                </Badge>
                <p className="text-sm font-normal text-muted-foreground mt-2 line-clamp-2">
                  {selectedOutcome.holding.question}
                </p>
              </SheetTitle>
            </SheetHeader>

            {/* Position Summary */}
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                Current Position
              </h4>
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Quantity
                    </div>
                    <div className="text-xl font-semibold">
                      {selectedOutcome.holding.quantity}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Avg Price
                    </div>
                    <div className="text-xl font-semibold">
                      {selectedOutcome.holding.avgPriceCents.toFixed(1)}¢
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Mark Price
                    </div>
                    <div className="text-xl font-semibold">
                      {selectedOutcome.holding.markPriceCents.toFixed(1)}¢
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">P&L</div>
                    <div
                      className={`text-xl font-semibold flex items-center gap-1 ${
                        selectedOutcome.holding.pnl >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {selectedOutcome.holding.pnl >= 0 ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5" />
                      )}
                      ${(selectedOutcome.holding.pnl / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Trade History */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <History className="w-4 h-4" />
                Trade History
              </h4>

              {loadingHistory.has(selectedOutcome.marketId) ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading trades...
                </div>
              ) : selectedOutcomeTrades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No trades found for this outcome
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedOutcomeTrades.map((order) => {
                    const isLimit = order.type === "limit";
                    const isBuy =
                      order.legs.length > 0 ? order.legs[0].quantity > 0 : true;
                    return (
                      <Card key={order.id} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={isBuy ? "default" : "secondary"}
                              className={
                                isBuy ? "bg-green-600" : "bg-red-600 text-white"
                              }
                            >
                              {isBuy ? "BUY" : "SELL"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                isLimit
                                  ? "text-purple-600 border-purple-300"
                                  : "text-blue-600 border-blue-300"
                              }
                            >
                              {isLimit ? "LIMIT" : "MARKET"}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {order.trades.map((trade) => (
                            <div
                              key={trade.id}
                              className="flex items-center justify-between py-2 border-b last:border-0"
                            >
                              <div>
                                <span className="font-medium">
                                  {trade.quantity} shares
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  @{" "}
                                  {(trade.priceCents / trade.quantity).toFixed(
                                    2,
                                  )}
                                  ¢ avg
                                </span>
                              </div>
                              <div className="font-mono font-medium">
                                ${(trade.priceCents / 100).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.trades.length > 1 && (
                          <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-mono font-medium">
                              $
                              {(
                                order.trades.reduce(
                                  (sum, t) => sum + t.priceCents,
                                  0,
                                ) / 100
                              ).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
