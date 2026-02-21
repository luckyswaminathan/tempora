import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Search,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from "lucide-react";
import type { PortfolioSnapshot } from "@/lib/api";

interface MarketGroup {
  marketId: string;
  question: string;
  endDate: string;
  holdings: PortfolioSnapshot["holdings"];
  totalPnl: number;
  totalCost: number;
  totalValue: number;
}

interface HoldingsTabProps {
  filteredMarkets: MarketGroup[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  openOutcomeDetail: (holding: PortfolioSnapshot["holdings"][0]) => void;
  /** Hide the search bar */
  hideSearch?: boolean;
  /** Hide market question links */
  hideMarketLinks?: boolean;
  /** Render as a flat list of rows instead of grouped cards */
  listMode?: boolean;
}

export function HoldingsTab({
  filteredMarkets,
  searchQuery,
  setSearchQuery,
  openOutcomeDetail,
  hideSearch = false,
  hideMarketLinks = false,
  listMode = false,
}: HoldingsTabProps) {
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

      {filteredMarkets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery
              ? "No markets match your search"
              : "No open positions yet"}
          </p>
        </div>
      ) : listMode ? (
        <div className="space-y-1.5">
          {filteredMarkets.flatMap((group) =>
            group.holdings.map((h) => (
              <button
                key={`${h.marketId}:${h.securityId}`}
                onClick={() => openOutcomeDetail(h)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <Badge variant="secondary" className="font-mono shrink-0">
                  {h.outcome}
                </Badge>
                <span className="text-sm text-muted-foreground flex-1 truncate">
                  {h.quantity} × {h.avgPriceCents.toFixed(0)}¢ avg
                </span>
                <span className="text-sm font-semibold shrink-0">
                  {h.markPriceCents.toFixed(0)}¢ mark
                </span>
                <span
                  className={`text-sm font-medium tabular-nums shrink-0 ${
                    h.pnl >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {h.pnl >= 0 ? "+" : ""}${(h.pnl / 100).toFixed(2)}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            )),
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((group) => {
            const isUp = group.totalPnl >= 0;

            return (
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
                      className="group/link inline-flex items-start gap-1 font-medium leading-snug text-balance line-clamp-2 mb-2 hover:underline"
                    >
                      {group.question}
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity mt-0.5" />
                    </Link>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{group.endDate}</span>
                    <Badge variant="outline" className="ml-auto">
                      {group.holdings.length} position
                      {group.holdings.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>

                {/* Holdings Summary - Compact view */}
                <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto flex-1">
                  {group.holdings.map((h) => (
                    <button
                      key={`${h.marketId}:${h.securityId}`}
                      onClick={() => openOutcomeDetail(h)}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs px-1.5 py-0 h-5 shrink-0"
                        >
                          {h.outcome}
                        </Badge>
                        <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <span className="text-muted-foreground">
                          {h.quantity}×{h.avgPriceCents.toFixed(0)}¢
                        </span>
                        <span
                          className={`font-medium tabular-nums ${
                            h.pnl >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {h.pnl >= 0 ? "+" : ""}${(h.pnl / 100).toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Total P&L - Compact */}
                <div className="px-3 py-2 bg-muted/50 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total P&L</span>
                  <div
                    className={`flex items-center gap-1 font-semibold ${
                      isUp ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isUp ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    ${(group.totalPnl / 100).toFixed(2)}
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
