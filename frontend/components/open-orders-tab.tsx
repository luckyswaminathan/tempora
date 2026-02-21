import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Clock,
  X,
  AlertCircle,
  Calendar,
  Search,
  ChevronRight,
} from "lucide-react";
import { ordersApi, type OrderRecord } from "@/lib/api";
import { OrderDetailSheet } from "@/components/order-detail-sheet";

interface MarketOrderGroup {
  marketId: string;
  question: string;
  orders: OrderRecord[];
  totalLimitPrice: number;
}

interface OpenOrdersTabProps {
  pendingOrders: OrderRecord[];
  loadingOrders: boolean;
  onOrderCancelled: () => void;
}

export function OpenOrdersTab({
  pendingOrders,
  loadingOrders,
  onOrderCancelled,
}: OpenOrdersTabProps) {
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  // Group orders by market
  const marketGroups = useMemo(() => {
    const groupMap = new Map<string, MarketOrderGroup>();

    for (const order of pendingOrders) {
      const existing = groupMap.get(order.marketId);
      if (existing) {
        existing.orders.push(order);
        existing.totalLimitPrice +=
          order.type === "limit" ? order.limitPriceCents : 0;
      } else {
        groupMap.set(order.marketId, {
          marketId: order.marketId,
          question: order.question,
          orders: [order],
          totalLimitPrice: order.type === "limit" ? order.limitPriceCents : 0,
        });
      }
    }

    return Array.from(groupMap.values());
  }, [pendingOrders]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return marketGroups;

    const query = searchQuery.toLowerCase();
    return marketGroups.filter((group) =>
      group.question.toLowerCase().includes(query),
    );
  }, [marketGroups, searchQuery]);

  const handleCancelOrder = async (orderId: string) => {
    try {
      setCancellingOrder(orderId);
      await ordersApi.cancelOrder(orderId);
      setSelectedOrder(null); // Close detail sheet
      onOrderCancelled();
    } catch (err) {
      console.error("Failed to cancel order:", err);
      alert(err instanceof Error ? err.message : "Failed to cancel order");
    } finally {
      setCancellingOrder(null);
    }
  };

  if (loadingOrders) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  if (pendingOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Clock className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No pending orders</p>
        <p className="text-sm text-muted-foreground mt-1">
          Limit orders that haven&apos;t been filled will appear here
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

      {filteredGroups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No markets match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => (
            <Card
              key={group.marketId}
              className="flex flex-col overflow-hidden"
            >
              {/* Market Header */}
              <div className="p-4 border-b">
                <h3 className="font-medium leading-snug text-balance line-clamp-2 mb-2">
                  {group.question}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {group.orders.length} pending order
                    {group.orders.length > 1 ? "s" : ""}
                  </span>
                  <Badge
                    variant="outline"
                    className="ml-auto text-purple-600 border-purple-300"
                  >
                    LIMIT
                  </Badge>
                </div>
              </div>

              {/* Orders List - Compact view */}
              <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto flex-1">
                {group.orders.map((order) => {
                  const isBuy =
                    order.legs.length > 0 ? order.legs[0].quantity > 0 : true;
                  return (
                    <div
                      key={order.id}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Badge
                          variant={isBuy ? "default" : "secondary"}
                          className={`font-mono text-xs px-1.5 py-0 h-5 shrink-0 ${
                            isBuy ? "bg-green-600" : "bg-red-600 text-white"
                          }`}
                        >
                          {isBuy ? "BUY" : "SELL"}
                        </Badge>
                        <span className="text-muted-foreground truncate">
                          {order.legs.map((leg) => leg.outcome).join(", ")}
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-medium tabular-nums">
                          $
                          {(order.type === "limit"
                            ? order.limitPriceCents / 100
                            : 0
                          ).toFixed(2)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelOrder(order.id);
                          }}
                          disabled={cancellingOrder === order.id}
                          className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          {cancellingOrder === order.id ? (
                            <span className="animate-spin text-xs">⏳</span>
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total Limit Price - Compact */}
              <div className="px-3 py-2 bg-muted/50 border-t flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Limit</span>
                <div className="font-semibold text-purple-600">
                  ${(group.totalLimitPrice / 100).toFixed(2)}
                </div>
              </div>

              {/* Hint */}
              <div className="px-3 py-1.5 border-t bg-muted/30 text-center">
                <span className="text-xs text-muted-foreground">
                  Click order for details or <X className="w-3 h-3 inline" /> to
                  cancel
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 mt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Limit Order Info
            </p>
            <p className="text-amber-700 dark:text-amber-300 mt-1">
              Pending limit orders will be filled when the market price reaches
              your limit price. You can cancel unfilled orders at any time.
            </p>
          </div>
        </div>
      </Card>

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onCancel={handleCancelOrder}
        cancellingOrder={cancellingOrder}
      />
    </>
  );
}
