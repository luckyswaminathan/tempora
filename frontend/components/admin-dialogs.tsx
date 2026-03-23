"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gavel, Pen } from "lucide-react";
import { marketsApi, type Market, type MarketStatus } from "@/lib/api";
import { toast } from "sonner";

interface AdminDialogsControllerProps {
  market: Market;
  showSettleForm: boolean;
  setShowSettleForm: (show: boolean) => void;
  showEditForm: boolean;
  setShowEditForm: (show: boolean) => void;
  onSuccess: () => void;
}

export function AdminDialogsController({
  market,
  showSettleForm,
  setShowSettleForm,
  showEditForm,
  setShowEditForm,
  onSuccess,
}: AdminDialogsControllerProps) {
  return (
    <>
      <AdminSettleDialog
        market={market}
        open={showSettleForm}
        onOpenChange={setShowSettleForm}
        onSettleSuccess={() => {
          setShowSettleForm(false);
          onSuccess();
        }}
      />
      <AdminEditDialog
        market={market}
        open={showEditForm}
        onOpenChange={setShowEditForm}
        onEditSuccess={() => {
          setShowEditForm(false);
          onSuccess();
        }}
      />
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
      toast.error("Please select a winning outcome");
      return;
    }

    setLoading(true);
    try {
      await marketsApi.settleMarket(selectedOutcome);
      toast.success("Market settled successfully");
      setSelectedOutcome("");
      onOpenChange(false);
      onSettleSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to settle market",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] p-0 gap-0"
        showCloseButton={false}
      >
        <div className="surface-panel px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              Settle Market
            </DialogTitle>
            <DialogDescription>
              Select the winning outcome for: <strong>{market.question}</strong>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-4 overflow-y-auto">
          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {outcomes.map((outcome) => (
              <button
                key={outcome.id}
                onClick={() => setSelectedOutcome(outcome.id)}
                className={`w-full p-3 rounded-lg border-2 text-left transition ${
                  selectedOutcome === outcome.id
                    ? "border-primary bg-primary/12"
                    : "border-border/70 bg-muted/35 hover:border-primary/35"
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
              className="flex-1"
            >
              {loading ? "Settling..." : "Settle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [status, setStatus] = useState<MarketStatus>(market.status);
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
      toast.error("Question cannot be empty");
      return;
    }

    if (!resolutionDate) {
      toast.error("Please set a resolution date");
      return;
    }

    setLoading(true);
    try {
      await marketsApi.updateMarket(market.id, {
        question: question.trim(),
        description: description.trim(),
        resolutionDate: new Date(resolutionDate).toISOString(),
        ...(status !== "resolved" && { status }),
        securities: outcomes,
      });
      toast.success("Market updated successfully");
      onOpenChange(false);
      onEditSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update market",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] p-0 gap-0"
        showCloseButton={false}
      >
        <div className="surface-panel px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pen className="w-5 h-5" />
              Edit Market
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-4 overflow-y-auto">
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
              <label className="text-sm font-medium block mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MarketStatus)}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="suspended">Suspended</option>
              </select>
              {status === "closed" && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <strong>Closed:</strong> No new trades can be placed.
                    Existing positions remain until market is resolved.
                  </p>
                </div>
              )}
              {status === "suspended" && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Suspended:</strong> Trading is temporarily halted
                    due to administrative review or technical issues.
                  </p>
                </div>
              )}
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
                          onChange={(e) =>
                            setEditingOutcomeText(e.target.value)
                          }
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
                        <div className="flex-1 p-2 bg-muted/50 rounded-lg">
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
            <Button
              onClick={handleUpdate}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Updating..." : "Update"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
