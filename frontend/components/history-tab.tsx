import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  /** Show all/open/filled/canceled filter controls */
  showOrderStateFilter?: boolean;
  /** Initial order-state filter */
  defaultOrderStateFilter?: "all" | "open" | "filled" | "canceled";
  /** Disable market link in card title (e.g. when already on market page) */
  disableMarketLink?: boolean;
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
  showOrderStateFilter = true,
  defaultOrderStateFilter = "all",
  disableMarketLink = false,
  onOrderClick,
}: HistoryTabProps) {
  const [orderStateFilter, setOrderStateFilter] = useState<
    "all" | "open" | "filled" | "canceled"
  >(defaultOrderStateFilter);

  const orderMatchesState = (order: OrderRecord) => {
    if (orderStateFilter === "all") return true;
    if (orderStateFilter === "open") return !order.filled && !order.canceled;
    if (orderStateFilter === "filled") return order.filled;
    return order.canceled;
  };

  // Filter orders by search query
  const filteredOrders = orders.filter(
    (order) =>
      orderMatchesState(order) &&
      (searchQuery.trim()
        ? order.question.toLowerCase().includes(searchQuery.toLowerCase())
        : true),
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
      {/* Search + filters row */}
      {(!hideSearch || showOrderStateFilter) && (
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          {!hideSearch && (
            <div className="relative max-w-md flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {showOrderStateFilter && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={orderStateFilter === "all" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setOrderStateFilter("all")}
              >
                All
              </Button>
              <Button
                variant={orderStateFilter === "open" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setOrderStateFilter("open")}
              >
                Open
              </Button>
              <Button
                variant={orderStateFilter === "filled" ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setOrderStateFilter("filled")}
              >
                Filled
              </Button>
              <Button
                variant={
                  orderStateFilter === "canceled" ? "default" : "outline"
                }
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setOrderStateFilter("canceled")}
              >
                Canceled
              </Button>
            </div>
          )}
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No {orderStateFilter === "all" ? "trades" : orderStateFilter} orders
            match your search
          </p>
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
            const uniqueLegQuantities = new Set(
              order.legs.map((leg) => Math.abs(leg.quantity)),
            );
            const firstLegQuantity = Math.abs(order.legs[0]?.quantity ?? 0);
            const quantityLabel =
              uniqueLegQuantities.size === 1 && firstLegQuantity > 0
                ? order.legs.length > 1
                  ? `${firstLegQuantity} shares x ${order.legs.length}`
                  : `${firstLegQuantity} shares`
                : `${totalShares} shares total`;
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
            const outcomesSummary = outcomes
              .slice(0, 3)
              .map((o) => `${o.outcome} (x${Math.abs(o.quantity)})`)
              .join(" · ");

            return (
              <Card
                key={order.id}
                className={`px-3 py-2.5${
                  onOrderClick
                    ? " cursor-pointer hover:bg-muted/30 transition-colors"
                    : ""
                }`}
                onClick={() => onOrderClick?.(order)}
              >
                {/* Primary row: action + transaction value + quantity */}
                <div className="flex items-start justify-between gap-2.5 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      variant={isBuy ? "default" : "secondary"}
                      className={`font-mono text-xs px-1.5 py-0 h-5 ${
                        isBuy
                          ? "bg-primary text-primary-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }`}
                    >
                      {isBuy ? "BUY" : "SELL"}
                    </Badge>
                    <p className="text-sm font-semibold font-mono tabular-nums text-foreground truncate">
                      {isBuy ? "Cost" : "Gain"}{" "}
                      {order.filled
                        ? `$${(Math.abs(order.priceCents) / 100).toFixed(2)}`
                        : isLimit
                          ? `$${(Math.abs(order.limitPriceCents) / 100).toFixed(2)}`
                          : "—"}
                    </p>
                    <p className="text-xs font-semibold font-mono tabular-nums text-muted-foreground truncate">
                      {quantityLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {order.filled ? (
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0 h-5 text-primary border-primary/45 bg-primary/10"
                      >
                        FILLED
                      </Badge>
                    ) : order.canceled ? (
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0 h-5 text-destructive border-destructive/45 bg-destructive/10"
                      >
                        CANCELED
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs px-1.5 py-0 h-5 text-secondary border-secondary/45 bg-secondary/12"
                      >
                        PENDING
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Row 2: market + outcomes */}
                <div className="space-y-0.5 mb-1.5">
                  <div className="min-w-0">
                    {disableMarketLink ? (
                      <p className="text-base font-semibold line-clamp-2 leading-tight">
                        {order.question}
                      </p>
                    ) : (
                      <Link
                        href={`/market/${order.marketId}`}
                        className="group/link text-base font-semibold line-clamp-2 leading-tight hover:underline inline-flex items-start gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.question}
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity mt-0.5" />
                      </Link>
                    )}
                    <p className="text-sm font-medium text-foreground/85 mt-1 leading-snug line-clamp-2">
                      {outcomesSummary}
                      {outcomes.length > 3 && ` +${outcomes.length - 3} more`}
                    </p>
                    {showUserId && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate leading-snug">
                        Trader UID: {order.userId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Row 3: secondary metadata */}
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">
                      {isLimit ? "Limit" : "Market"}
                    </span>
                    {totalShares > 0 && avgPricePerShare > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-mono tabular-nums">
                          {avgPricePerShare.toFixed(2)}¢/share
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span>
                      {new Date(order.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="font-mono">
                      {new Date(order.createdAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
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
