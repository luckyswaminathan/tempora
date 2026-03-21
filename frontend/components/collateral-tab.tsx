import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  ShieldAlert,
  Wallet,
  AlertCircle,
  Clock,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  usersApi,
  type CollateralBreakdown,
  type PortfolioSnapshot,
  type OrderRecord,
} from "@/lib/api";

interface CollateralTabProps {
  totalCollateralLocked: number;
  /** Portfolio holdings, used to open OutcomeDetailSheet for short positions */
  holdings?: PortfolioSnapshot["holdings"];
  /** Open an outcome detail sheet for a holding */
  openOutcomeDetail?: (holding: PortfolioSnapshot["holdings"][0]) => void;
  /** Increment to trigger a re-fetch */
  refreshKey?: number;
  /** Pending orders, used to open OrderDetailSheet for limit order rows */
  pendingOrders?: OrderRecord[];
  /** Open an order detail sheet for a pending order */
  openOrderDetail?: (order: OrderRecord) => void;
}

export function CollateralTab({
  totalCollateralLocked,
  holdings = [],
  openOutcomeDetail,
  refreshKey = 0,
  pendingOrders = [],
  openOrderDetail,
}: CollateralTabProps) {
  const [collateralBreakdown, setCollateralBreakdown] =
    useState<CollateralBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMarkets, setExpandedMarkets] = useState<Set<number>>(
    new Set(),
  );

  const toggleMarket = (idx: number) => {
    const newExpanded = new Set(expandedMarkets);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedMarkets(newExpanded);
  };

  useEffect(() => {
    async function fetchCollateral() {
      try {
        setLoading(true);
        setError(null);
        const data = await usersApi.getCollateral();
        setCollateralBreakdown(data);
      } catch (err) {
        console.error("Failed to fetch collateral:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load collateral",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchCollateral();
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading collateral details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  if (totalCollateralLocked === 0 || !collateralBreakdown) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No collateral locked</p>
        <p className="text-sm text-muted-foreground mt-1">
          Collateral is locked when you hold short positions, have pending limit
          orders, or create markets
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Collateral Summary */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Collateral Summary
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-muted-foreground">Total Locked</span>
            <span className="text-xl font-bold">
              ${(collateralBreakdown.totalLocked / 100).toFixed(2)}
            </span>
          </div>
          {collateralBreakdown.totalShortCollateral > 0 && (
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-destructive" />
                Short Positions
              </span>
              <span className="font-semibold text-destructive">
                ${(collateralBreakdown.totalShortCollateral / 100).toFixed(2)}
              </span>
            </div>
          )}
          {collateralBreakdown.totalLimitOrderCollateral > 0 && (
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-secondary" />
                Limit Orders
              </span>
              <span className="font-semibold text-secondary">
                $
                {(collateralBreakdown.totalLimitOrderCollateral / 100).toFixed(
                  2,
                )}
              </span>
            </div>
          )}
          {collateralBreakdown.totalMarketMakerCollateral > 0 && (
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                Market Making
              </span>
              <span className="font-semibold text-primary">
                $
                {(collateralBreakdown.totalMarketMakerCollateral / 100).toFixed(
                  2,
                )}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Short Positions Detail */}
      {collateralBreakdown.shortMarkets.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Short Position Collateral
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Collateral = max short position per market (only one outcome can
            win)
          </p>
          <div className="space-y-3">
            {collateralBreakdown.shortMarkets.map((market, idx) => {
              const isExpanded = expandedMarkets.has(idx);
              return (
                <Card key={idx} className="p-4">
                  {/* Market header */}
                  <div className="w-full flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/market/${market.marketId}`}
                        className="group/link font-medium text-sm line-clamp-2 mb-1 inline-flex items-start gap-1 hover:underline"
                      >
                        {market.question}
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity mt-0.5" />
                      </Link>
                      <div>
                        <button
                          onClick={() => toggleMarket(idx)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          {market.positions.length} short position
                          {market.positions.length !== 1 ? "s" : ""}
                        </button>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-muted-foreground">
                        Max Liability
                      </div>
                      <div className="font-semibold text-destructive">
                        ${(market.collateralCents / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Expanded positions detail */}
                  {isExpanded && (
                    <div className="space-y-1 mt-3 pt-3 border-t">
                      {market.positions.map((pos, posIdx) => {
                        const matchingHolding = holdings.find(
                          (h) =>
                            h.marketId === market.marketId &&
                            h.outcome === pos.outcome,
                        );
                        const isClickable = !!(
                          matchingHolding && openOutcomeDetail
                        );
                        return isClickable ? (
                          <button
                            key={posIdx}
                            onClick={() => openOutcomeDetail!(matchingHolding!)}
                            className="w-full flex items-center gap-2 text-xs pl-6 py-1 rounded hover:bg-muted/50 transition-colors group"
                          >
                            <Badge
                              variant="outline"
                              className="text-destructive border-destructive/40"
                            >
                              {pos.outcome}
                            </Badge>
                            <span className="text-muted-foreground flex-1 text-left">
                              {pos.quantity} shares
                            </span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <div
                            key={posIdx}
                            className="flex items-center gap-2 text-xs pl-6"
                          >
                            <Badge
                              variant="outline"
                              className="text-destructive border-destructive/40"
                            >
                              {pos.outcome}
                            </Badge>
                            <span className="text-muted-foreground">
                              {pos.quantity} shares
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Limit Orders Detail */}
      {collateralBreakdown.limitOrders.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-secondary" />
            Limit Order Collateral
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Collateral locked for pending limit orders (covers purchase price
            and potential short position)
          </p>
          <div className="space-y-2">
            {collateralBreakdown.limitOrders.map((order) => {
              const matchingOrder = pendingOrders.find(
                (o) => o.id === order.orderId,
              );
              const isClickable = !!(matchingOrder && openOrderDetail);
              return (
                <Card
                  key={order.orderId}
                  className={`p-4 ${
                    isClickable
                      ? "cursor-pointer hover:bg-muted/30 transition-colors group"
                      : ""
                  }`}
                  onClick={
                    isClickable
                      ? () => openOrderDetail!(matchingOrder!)
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/market/${order.marketId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="group/link font-medium text-sm line-clamp-1 mb-1 inline-flex items-center gap-1 hover:underline"
                      >
                        {order.question}
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity" />
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          variant="outline"
                          className="text-secondary border-secondary/40"
                        >
                          LIMIT ORDER
                        </Badge>
                        <span>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          Locked
                        </div>
                        <div className="font-semibold">
                          ${(order.collateralCents / 100).toFixed(2)}
                        </div>
                      </div>
                      {isClickable && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Market Making Detail */}
      {collateralBreakdown.marketMakerMarkets.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Market Making Collateral
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Collateral locked for markets pending resolution (covers worst-case
            payout).
          </p>
          <div className="space-y-2">
            {collateralBreakdown.marketMakerMarkets.map((market) => (
              <Card key={market.marketId} className="p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/market/${market.marketId}`}
                      className="group/link font-medium text-sm line-clamp-1 mb-1 inline-flex items-center gap-1 hover:underline"
                    >
                      {market.question}
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity" />
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="text-primary border-primary/40"
                      >
                        MARKET MAKER
                      </Badge>
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(market.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">
                      Currently locked
                    </div>
                    <div className="font-semibold">
                      ${(market.effectiveCollateralCents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
                {/* Breakdown row */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                  <div>
                    <p className="text-muted-foreground">Initial funding</p>
                    <p className="font-medium text-primary">
                      ${(market.initialFundingCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Revenue received</p>
                    <p className="font-medium text-accent-foreground">
                      ${(market.revenueCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total locked</p>
                    <p className="font-medium font-semibold">
                      ${(market.effectiveCollateralCents / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-muted/35 border-border/70">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">How collateral works</p>
            <p className="text-muted-foreground mt-1">
              Collateral ensures you can cover potential losses. For short
              positions, $1.00 per share is locked (max payout if that outcome
              wins). Limit orders lock funds to cover the order and any
              resulting short position. For market makers, initial funding is
              locked at creation in order to guarantee liquidity on all future
              trades. Market collateral shifts as trade revenue accumulates in
              your wallet so that you can always cover the worst-case payout
              when the market resolves. Collateral is fully released when
              positions close or markets resolve.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
