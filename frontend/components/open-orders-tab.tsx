import Link from "next/link";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  X,
  AlertCircle,
  Search,
  ChevronRight,
  ExternalLink,
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
  /** Hide the search bar (e.g. when used on a single-market page) */
  hideSearch?: boolean;
  /** Hide market question links and "View ↗" buttons (e.g. when already on that market's page) */
  hideMarketLinks?: boolean;
  /** Render as a flat list of rows instead of grouped cards (for single-market context) */
  listMode?: boolean;
}

export function OpenOrdersTab({
  pendingOrders,
  loadingOrders,
  onOrderCancelled,
  hideSearch = false,
  hideMarketLinks = false,
  listMode = false,
}: OpenOrdersTabProps) {
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
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

  const handleConfirmCancel = async () => {
    if (!confirmCancelId) return;
    const id = confirmCancelId;
    setConfirmCancelId(null);
    await handleCancelOrder(id);
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

      {filteredGroups.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No markets match your search</p>
        </div>
      ) : listMode ? (
        <div className="space-y-1.5">
          {filteredGroups.flatMap((group) =>
            group.orders.map((order) => {
              const isBuy =
                order.legs.length > 0 ? order.legs[0].quantity > 0 : true;
              return (
                <div
                  key={order.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      className={`text-xs px-1.5 py-0 h-5 ${
                        isBuy ? "bg-green-600" : "bg-red-600 text-white"
                      }`}
                    >
                      {isBuy ? "BUY" : "SELL"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs px-1.5 py-0 h-5 text-purple-600 border-purple-300"
                    >
                      LIMIT
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
                    {order.legs.map((l) => l.outcome).join(", ")}
                  </div>
                  <span className="text-sm font-semibold font-mono shrink-0">
                    $
                    {(order.type === "limit"
                      ? order.limitPriceCents / 100
                      : 0
                    ).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmCancelId(order.id);
                    }}
                    disabled={cancellingOrder === order.id}
                  >
                    {cancellingOrder === order.id ? (
                      <span className="animate-spin text-xs">⏳</span>
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              );
            }),
          )}
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
                {hideMarketLinks ? (
                  <p className="font-medium leading-snug text-balance line-clamp-2 mb-2">
                    {group.question}
                  </p>
                ) : (
                  <Link
                    href={`/market/${group.marketId}`}
                    className="group/link font-medium leading-snug line-clamp-2 mb-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {group.question}
                    <ExternalLink className="inline w-3 h-3 ml-1 opacity-0 group-hover/link:opacity-60 transition-opacity align-middle" />
                  </Link>
                )}
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
                            setConfirmCancelId(order.id);
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

              {/* Cancel hint */}
              <div className="px-3 py-1.5 bg-muted/30 border-t flex items-center">
                <span className="text-xs text-muted-foreground">
                  Click order for details or <X className="w-3 h-3 inline" /> to
                  cancel
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onCancel={handleCancelOrder}
        cancellingOrder={cancellingOrder}
      />

      {/* Inline X cancel confirmation */}
      <AlertDialog
        open={confirmCancelId !== null}
        onOpenChange={(open) => !open && setConfirmCancelId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the pending limit order. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancel}
            >
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
