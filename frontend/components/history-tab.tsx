import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Clock, Search, ExternalLink } from "lucide-react";
import type { OrderRecord } from "@/lib/api";

interface HistoryTabProps {
  orders: OrderRecord[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Hide the search bar (e.g. when used on a single-market page) */
  hideSearch?: boolean;
  /** Show trader UID (for market-maker market history only) */
  showUserId?: boolean;
  /** Called when a history card is clicked */
  onOrderClick?: (order: OrderRecord) => void;
}

export function HistoryTab({
  orders,
  loading,
  searchQuery,
  setSearchQuery,
  hideSearch = false,
  showUserId = false,
  onOrderClick,
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
      {!hideSearch && (
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
      )}

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No trades match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            // Determine buy/sell from leg quantities (positive = buy, negative = sell)
            const isBuy = order.legs[0].quantity > 0;
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

            // Get outcomes from legs
            const outcomes = order.legs.map((leg) => ({
              outcome: leg.outcome,
              quantity: leg.quantity,
            }));

            return (
              <Card
                key={order.id}
                className={`px-4 py-3${
                  onOrderClick
                    ? " cursor-pointer hover:bg-muted/30 transition-colors"
                    : ""
                }`}
                onClick={() => onOrderClick?.(order)}
              >
                {/* Row 1: badges left, timestamp right */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1">
                    <Badge
                      variant={isBuy ? "default" : "secondary"}
                      className={`font-mono text-xs px-1.5 py-0 h-5 ${
                        isBuy ? "bg-green-600" : "bg-red-600 text-white"
                      }`}
                    >
                      {isBuy ? "BUY" : "SELL"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs px-1.5 py-0 h-5 ${
                        isLimit
                          ? "text-purple-600 border-purple-300"
                          : "text-blue-600 border-blue-300"
                      }`}
                    >
                      {isLimit ? "LIMIT" : "MARKET"}
                    </Badge>
                    {order.filled ? (
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0 h-5 text-green-600 border-green-300"
                      >
                        FILLED
                      </Badge>
                    ) : order.canceled ? (
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0 h-5 text-red-600 border-red-300"
                      >
                        CANCELED
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0 h-5 text-amber-600 border-amber-300"
                      >
                        PENDING
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(order.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Row 2: question left, price right */}
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/market/${order.marketId}`}
                      className="group/link text-sm font-medium line-clamp-1 leading-snug hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {order.question}
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity" />
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate leading-snug">
                      {outcomes
                        .slice(0, 3)
                        .map(
                          (o) =>
                            `${o.outcome} (${o.quantity > 0 ? "+" : ""}${o.quantity})`,
                        )
                        .join(" · ")}
                      {outcomes.length > 3 && ` +${outcomes.length - 3} more`}
                    </p>
                    {showUserId && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate leading-snug">
                        Trader UID: {order.userId}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold font-mono tabular-nums">
                      {order.filled
                        ? `$${(order.priceCents / 100).toFixed(2)}`
                        : isLimit
                          ? `$${(order.limitPriceCents / 100).toFixed(2)}`
                          : "—"}
                    </p>
                    {totalShares > 0 && avgPricePerShare > 0 && (
                      <p className="text-xs text-muted-foreground font-mono tabular-nums">
                        {avgPricePerShare.toFixed(2)}¢/sh
                      </p>
                    )}
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
