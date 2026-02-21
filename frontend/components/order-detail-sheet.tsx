import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Clock, X, Calendar, TrendingUp } from "lucide-react";
import type { OrderRecord } from "@/lib/api";

interface OrderDetailSheetProps {
  order: OrderRecord | null;
  onClose: () => void;
  onCancel?: (orderId: string) => Promise<void>;
  cancellingOrder?: string | null;
}

export function OrderDetailSheet({
  order,
  onClose,
  onCancel,
  cancellingOrder,
}: OrderDetailSheetProps) {
  if (!order) return null;

  const isBuy = order.legs.length > 0 ? order.legs[0].quantity > 0 : true;
  const isLimit = order.type === "limit";
  const totalShares = order.legs.reduce(
    (sum, leg) => sum + Math.abs(leg.quantity),
    0,
  );
  const priceToUse = order.filled
    ? order.priceCents
    : order.type === "limit"
      ? order.limitPriceCents
      : 0;
  const avgPricePerShare = totalShares > 0 ? priceToUse / totalShares : 0;

  return (
    <Sheet open={!!order} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-left">
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant={isBuy ? "default" : "secondary"}
                className={`font-mono text-lg ${
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
              {order.filled ? (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-300"
                >
                  FILLED
                </Badge>
              ) : order.canceled ? (
                <Badge
                  variant="outline"
                  className="text-red-600 border-red-300"
                >
                  CANCELED
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-amber-600 border-amber-300"
                >
                  PENDING
                </Badge>
              )}
            </div>
            <p className="text-sm font-normal text-muted-foreground mt-2 line-clamp-3">
              {order.question}
            </p>
          </SheetTitle>
        </SheetHeader>

        {/* Order Summary */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Order Details
          </h4>
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Created</span>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  Total Shares
                </span>
                <span className="text-lg font-semibold">{totalShares}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Avg Price per Share
                </span>
                <span className="text-lg font-semibold font-mono">
                  {avgPricePerShare.toFixed(2)}¢
                </span>
              </div>

              {order.type === "limit" && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Limit Price (Total)
                  </span>
                  <span className="text-lg font-semibold font-mono text-purple-600">
                    ${(order.limitPriceCents / 100).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium">
                  Total {isBuy ? "Cost" : "Received"}
                </span>
                <span className="text-xl font-bold font-mono">
                  ${(order.priceCents / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Securities Breakdown */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3">Securities</h4>
          <div className="space-y-2">
            {order.legs.map((leg, idx) => (
              <Card key={`${leg.securityId}-${idx}`} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {leg.outcome}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {leg.quantity > 0 ? "+" : ""}
                      {leg.quantity} shares
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Cancel Button for pending orders */}
        {!order.filled && !order.canceled && onCancel && (
          <div className="mb-6">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => onCancel(order.id)}
              disabled={cancellingOrder === order.id}
            >
              {cancellingOrder === order.id ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Cancelling Order...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Cancel Order
                </span>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
