"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  SlidersHorizontal,
  X,
  Pen,
  Gavel,
} from "lucide-react";
import { BetDialog } from "@/components/bet-dialog";
import { marketsApi, type Market } from "@/lib/api";
import { format } from "date-fns";
import { useAuth } from "@/contexts/auth-context";

interface MarketCardProps {
  initialMarket: Market;
}

type ViewMode = "individual" | "interval";

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="px-2 py-1 rounded-full bg-white/60 backdrop-blur text-black text-xs font-semibold shadow-md">
    {children}
  </span>
);

export function MarketCard({ initialMarket }: MarketCardProps) {
  const { user } = useAuth();
  const [market, setMarket] = useState(initialMarket);
  const [viewMode, setViewMode] = useState<ViewMode>("individual");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [hoveredOutcome, setHoveredOutcome] = useState<string | null>(null);
  const [intervalRange, setIntervalRange] = useState<[number, number]>([
    -1, -1,
  ]);
  const [lastSelected, setLastSelected] = useState<number>(-1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const refreshMarket = async () => {
    setIsRefreshing(true);
    try {
      const updated = await marketsApi.getMarket(market.id);
      setMarket(updated);
    } catch (error) {
      console.error("Failed to refresh market:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const outcomes = useMemo(() => {
    if (!market?.securities || !market?.quotes) return [];

    return market.securities
      .map((security) => {
        const quote = market.quotes.find((q) => q.securityId === security.id);
        return {
          ...security,
          quote: quote || null,
          probability: quote?.impliedProbability || 0,
          quantityTraded: quote?.quantityTraded || 0,
        };
      })
      .sort((a, b) => a.outcome.localeCompare(b.outcome));
  }, [market?.securities, market?.quotes]);

  const maxProbability = Math.max(...outcomes.map((o) => o.probability), 0);
  const creationDate = market?.createdAt
    ? format(new Date(market.createdAt), "MMM d, yyyy")
    : "—";

  const handleBarClick = (index: number) => {
    if (viewMode === "interval") {
      if (lastSelected === -1) {
        // First click - set both start and end to same index
        setIntervalRange([index, index]);
      } else {
        // Already have a selection - update the range
        // User can click anywhere to extend/shrink the range
        setIntervalRange([
          Math.min(lastSelected, index),
          Math.max(lastSelected, index),
        ]);
      }
      setLastSelected(index);
    } else {
      // Individual mode - open dialog immediately with single outcome
      const outcome = outcomes[index];
      setSelectedOutcome(outcome.id);
      setDialogOpen(true);
    }
  };

  const handleOpenIntervalDialog = () => {
    if (intervalRange[0] >= 0) {
      setDialogOpen(true);
    }
  };

  const handleResetInterval = () => {
    setIntervalRange([-1, -1]);
    setLastSelected(-1);
  };

  const handleTradeSuccess = () => {
    setDialogOpen(false);
    setIntervalRange([-1, -1]);
    setLastSelected(-1);
    refreshMarket();
  };

  const getBarColor = (index: number) => {
    if (viewMode === "interval") {
      const [start, end] = intervalRange;
      if (start >= 0 && end >= 0 && index >= start && index <= end) {
        return "bg-green-500/70 hover:bg-green-500";
      }
    }
    if (hoveredOutcome === outcomes[index]?.id) {
      return "bg-blue-400";
    }
    return "bg-blue-500/70 hover:bg-blue-500";
  };

  if (!market) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </Card>
    );
  }

  const [rangeStart, rangeEnd] = intervalRange;
  const selectedOutcomes =
    rangeStart >= 0 && rangeEnd >= 0
      ? outcomes.slice(rangeStart, rangeEnd + 1)
      : [];
  const intervalText =
    rangeStart >= 0 && rangeEnd >= 0
      ? rangeStart === rangeEnd
        ? outcomes[rangeStart]?.outcome
        : `${outcomes[rangeStart]?.outcome} - ${outcomes[rangeEnd]?.outcome}`
      : "";

  return (
    <>
      <Card
        className={`p-6 hover:shadow-lg transition-shadow relative ${
          isRefreshing ? "opacity-70" : ""
        }`}
      >
        {/* Floating interval selection overlay - stick to top of this card */}
        {viewMode === "interval" && rangeStart >= 0 && (
          <div className="absolute -top-3 left-4 right-4 z-10 animate-in slide-in-from-top-2 duration-300">
            <div className="bg-gradient-to-r from-green-500 to-green-400 text-white px-4 py-3 rounded-lg shadow-lg border-2 border-green-400">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold mb-1 truncate">
                    {intervalText}
                  </div>
                  <div className="text-xs opacity-90">
                    {selectedOutcomes.length} outcome
                    {selectedOutcomes.length !== 1 ? "s" : ""} selected
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={handleOpenIntervalDialog}
                    className="h-9 bg-white text-green-600 hover:bg-green-50"
                  >
                    Trade
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleResetInterval}
                    className="h-9 w-9 p-0 text-white hover:bg-green-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <Badge variant="secondary" className="text-xs">
            {market.category || "Uncategorized"}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{creationDate}</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4 leading-snug text-balance">
          {market.question || "Untitled Market"}
        </h3>

        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === "individual" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("individual");
              setIntervalRange([-1, -1]);
              setLastSelected(-1);
            }}
            className="flex-1"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            Individual
          </Button>
          <Button
            variant={viewMode === "interval" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewMode("interval");
              setIntervalRange([-1, -1]);
              setLastSelected(-1);
            }}
            className="flex-1"
          >
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            Interval
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mb-3 font-medium">
          {viewMode === "individual"
            ? "Click to trade individual outcomes"
            : rangeStart === -1
              ? "Click to select interval start"
              : "Click another outcome to adjust interval range"}
        </div>

        <div className="mb-4">
          <div className="space-y-2">
            {outcomes.map((outcome, index) => {
              const widthPercent =
                maxProbability > 0
                  ? (outcome.probability / maxProbability) * 100
                  : 0;
              const isInInterval =
                viewMode === "interval" &&
                rangeStart >= 0 &&
                index >= rangeStart &&
                index <= rangeEnd;

              return (
                <button
                  key={outcome.id}
                  onClick={() => handleBarClick(index)}
                  onMouseEnter={() => setHoveredOutcome(outcome.id)}
                  onMouseLeave={() => setHoveredOutcome(null)}
                  className={`w-full h-12 rounded-lg relative overflow-visible transition ring-offset-2 ${
                    isInInterval
                      ? "ring-2 ring-green-500"
                      : "hover:ring-2 hover:ring-primary"
                  }`}
                >
                  <div
                    className={`absolute left-0 top-0 h-full rounded-lg transition-all duration-300 ${getBarColor(
                      index,
                    )}`}
                    style={{ width: `${widthPercent}%` }}
                  />

                  <div className="absolute left-3 top-0 h-full flex items-center z-10">
                    <Pill>{outcome.outcome}</Pill>
                  </div>

                  <div
                    className="absolute top-0 h-full flex items-center gap-2 z-10"
                    style={{ right: "12px" }}
                  >
                    <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
                  </div>

                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full px-2 py-1 rounded-md bg-gray-900 text-white text-xs opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-lg">
                    <Pill>{outcome.quantityTraded} shares traded</Pill>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* {market.settlementDates && market.settlementDates.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-muted-foreground mb-2">
              Settlement Dates
            </div>
            <div className="flex flex-wrap gap-2">
              {market.settlementDates.map((settlement, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {settlement.label}
                </Badge>
              ))}
            </div>
          </div>
        )} */}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>${(market.totalVolume / 100).toFixed(0)} volume</span>
          </div>
          {user?.role === "admin" && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEditForm(true)}
                className="h-8 px-2"
              >
                <Pen className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSettleForm(true)}
                className="h-8 px-2"
              >
                <Gavel className="w-3 h-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{Math.round(market.openInterest)} shares</span>
          </div>
        </div>
      </Card>

      <BetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        market={market}
        selectedOutcomes={
          viewMode === "interval"
            ? selectedOutcomes
            : selectedOutcome
              ? [outcomes.find((o) => o.id === selectedOutcome)!]
              : []
        }
        onSuccess={handleTradeSuccess}
      />

      {showSettleForm && (
        <AdminSettleDialog
          market={market}
          open={showSettleForm}
          onOpenChange={setShowSettleForm}
          onSettleSuccess={() => {
            setShowSettleForm(false);
            refreshMarket();
          }}
        />
      )}

      {showEditForm && (
        <AdminEditDialog
          market={market}
          open={showEditForm}
          onOpenChange={setShowEditForm}
          onEditSuccess={() => {
            setShowEditForm(false);
            refreshMarket();
          }}
        />
      )}
    </>
  );
}

interface AdminDialogProps {
  market: Market;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettleSuccess?: () => void;
  onEditSuccess?: () => void;
}

function AdminSettleDialog({
  market,
  open,
  onOpenChange,
  onSettleSuccess,
}: AdminDialogProps & { onSettleSuccess?: () => void }) {
  const [selectedOutcome, setSelectedOutcome] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const outcomes = useMemo(() => {
    if (!market?.securities) return [];
    return market.securities;
  }, [market?.securities]);

  const handleSettle = async () => {
    if (!selectedOutcome) {
      alert("Please select a winning outcome");
      return;
    }

    setLoading(true);
    try {
      await marketsApi.settleMarket(selectedOutcome);
      alert("Market settled successfully");
      setSelectedOutcome("");
      onOpenChange(false);
      onSettleSuccess?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to settle market");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gavel className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Settle Market</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Select the winning outcome for: <strong>{market.question}</strong>
        </p>

        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
          {outcomes.map((outcome) => (
            <button
              key={outcome.id}
              onClick={() => setSelectedOutcome(outcome.id)}
              className={`w-full p-3 rounded-lg border-2 text-left transition ${
                selectedOutcome === outcome.id
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">{outcome.outcome}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSettle}
            disabled={loading || !selectedOutcome}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {loading ? "Settling..." : "Settle"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AdminEditDialog({
  market,
  open,
  onOpenChange,
  onEditSuccess,
}: AdminDialogProps & { onEditSuccess?: () => void }) {
  const [question, setQuestion] = useState(market.question);
  const [description, setDescription] = useState(market.description || "");
  const [resolutionDate, setResolutionDate] = useState(
    market.resolutionDate.split("T")[0],
  );
  const [outcomes, setOutcomes] = useState<
    Array<{ id: string; outcome: string }>
  >(market.securities);
  const [loading, setLoading] = useState(false);
  const [editingOutcomeId, setEditingOutcomeId] = useState<string | null>(null);
  const [editingOutcomeText, setEditingOutcomeText] = useState("");

  const handleStartEditOutcome = (id: string, text: string) => {
    setEditingOutcomeId(id);
    setEditingOutcomeText(text);
  };

  const handleSaveOutcome = () => {
    setOutcomes(
      outcomes.map((o) =>
        o.id === editingOutcomeId ? { ...o, outcome: editingOutcomeText } : o,
      ),
    );
    setEditingOutcomeId(null);
    setEditingOutcomeText("");
  };

  const handleUpdate = async () => {
    if (!question.trim()) {
      alert("Question cannot be empty");
      return;
    }

    if (!resolutionDate) {
      alert("Please set a resolution date");
      return;
    }

    setLoading(true);
    try {
      await marketsApi.updateMarket(market.id, {
        question: question.trim(),
        description: description.trim(),
        resolutionDate: new Date(resolutionDate).toISOString(),
        securities: outcomes,
      });
      alert("Market updated successfully");
      onOpenChange(false);
      onEditSuccess?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to update market");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <Pen className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Edit Market</h2>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm font-medium block mb-2">Question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">
              Resolution Date
            </label>
            <input
              type="date"
              value={resolutionDate}
              onChange={(e) => setResolutionDate(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-2">Outcomes</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {outcomes.map((outcome) => (
                <div key={outcome.id} className="flex gap-2 items-center">
                  {editingOutcomeId === outcome.id ? (
                    <>
                      <input
                        type="text"
                        value={editingOutcomeText}
                        onChange={(e) => setEditingOutcomeText(e.target.value)}
                        className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveOutcome}
                        className="h-8"
                      >
                        Save
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 p-2 bg-gray-50 rounded-lg">
                        {outcome.outcome}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleStartEditOutcome(outcome.id, outcome.outcome)
                        }
                        className="h-8"
                      >
                        <Pen className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={loading} className="flex-1">
            {loading ? "Updating..." : "Update"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
