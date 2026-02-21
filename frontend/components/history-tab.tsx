import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, Search, Calendar } from "lucide-react";
import type { OrderRecord } from "@/lib/api";

interface HistoryTabProps {
  orders: OrderRecord[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export function HistoryTab({
  orders,
  loading,
  searchQuery,
  setSearchQuery,
}: HistoryTabProps) {
  // Filter orders by search query
  const filteredOrders = orders.filter((order) =>
    searchQuery.trim()
      ? order.question.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading trade history...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Clock className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No trade history yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your completed trades will appear here
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No trades match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            // Determine buy/sell from leg quantities (positive = buy, negative = sell)
            const isBuy =
              order.legs.length > 0 ? order.legs[0].quantity > 0 : true;
            const isLimit = order.type === "limit";
            const totalShares = order.legs.reduce(
              (sum, e) => sum + Math.abs(e.quantity),
              0,
            );
            // For filled orders use actual price, for unfilled use limit price if available
            const priceToUse = order.filled
              ? order.priceCents
              : order.type === "limit"
                ? order.limitPriceCents
                : 0;
            const avgPricePerShare =
              totalShares > 0 ? priceToUse / totalShares : 0;

            // Get outcomes from legs if available, otherwise from trades
            const outcomes =
              order.legs.length > 0
                ? order.legs.map((leg) => ({
                    outcome: leg.outcome,
                    quantity: leg.quantity,
                  }))
                : order.trades.map((trade) => ({
                    outcome: trade.outcome,
                    quantity: trade.quantity,
                  }));

            return (
              <Card key={order.id} className="p-4">
                {/* Header row with date and badges */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={isBuy ? "default" : "secondary"}
                      className={`font-mono text-xs ${
                        isBuy ? "bg-green-600" : "bg-red-600 text-white"
                      }`}
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
                    {order.filled && (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-300"
                      >
                        FILLED
                      </Badge>
                    )}
                    {order.canceled && (
                      <Badge
                        variant="outline"
                        className="text-red-600 border-red-300"
                      >
                        CANCELED
                      </Badge>
                    )}
                    {!order.filled && !order.canceled && (
                      <Badge
                        variant="outline"
                        className="text-amber-600 border-amber-300"
                      >
                        PENDING
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(order.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {new Date(order.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {/* Market question */}
                <div className="mb-3">
                  <h3 className="font-medium text-sm line-clamp-2 text-balance">
                    {order.question}
                  </h3>
                </div>

                {/* Order details in grid */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Outcomes - More compact */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Outcomes ({outcomes.length})
                    </div>
                    <div className="text-xs">
                      {outcomes.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="truncate">
                          <span className="font-medium">{item.outcome}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            ({item.quantity > 0 ? "+" : ""}
                            {item.quantity})
                          </span>
                        </div>
                      ))}
                      {outcomes.length > 3 && (
                        <div className="text-muted-foreground italic">
                          +{outcomes.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Pricing
                    </div>
                    <div className="space-y-1 text-xs">
                      {order.filled ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Avg per share:
                            </span>
                            <span className="font-medium tabular-nums">
                              {Math.abs(avgPricePerShare).toFixed(2)}¢
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Total {isBuy ? "cost" : "received"}:
                            </span>
                            <span className="font-semibold tabular-nums">
                              ${(Math.abs(order.priceCents) / 100).toFixed(2)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          {isLimit && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Limit price:
                              </span>
                              <span className="font-medium tabular-nums text-purple-600">
                                ${(order.limitPriceCents / 100).toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Status:
                            </span>
                            <span className="font-medium">
                              {order.canceled ? "Canceled" : "Pending"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
