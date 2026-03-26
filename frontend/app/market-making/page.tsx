"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { categoryColor } from "@/lib/utils";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Rocket,
  Zap,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  proposalsApi,
  marketMakerApi,
  type Proposal,
  type MarketMakerDashboard,
} from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarketCreateForm } from "@/components/market-create-form";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { MARKET_MAKING_STEPS } from "@/lib/tutorial-steps";

type Tab = "dashboard" | "proposals" | "create";

export default function MarketMakingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, profile, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(
    () => (searchParams.get("tab") as Tab) ?? "dashboard",
  );
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [dashboard, setDashboard] = useState<MarketMakerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [proposalQuotes, setProposalQuotes] = useState<Record<string, number>>(
    {},
  );
  const [mounted, setMounted] = useState(false);

  const marketMakingTutorial = useTutorial({
    steps: MARKET_MAKING_STEPS,
    lessonKey: "market-making",
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !loading && profile?.role === "market_maker") {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "market-making") marketMakingTutorial.start();
    }
  }, [mounted, loading, searchParams, profile]);

  useEffect(() => {
    if (!authLoading && !(profile?.role === "market_maker")) {
      router.push("/");
    }
  }, [profile, authLoading, router]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await proposalsApi.getMyProposals();
      setProposals(response.proposals);

      // Fetch collateral quotes for approved proposals
      const approved = response.proposals.filter(
        (p) => p.status === "approved" && p.liquidityParameter,
      );
      const entries = await Promise.all(
        approved.map(async (p) => {
          try {
            const q = await proposalsApi.getQuote(
              p.liquidityParameter!,
              p.outcomes.length,
            );
            return [p.id, q.initialFundingCents] as [string, number];
          } catch {
            return null;
          }
        }),
      );
      const quotes: Record<string, number> = {};
      entries.forEach((e) => {
        if (e) quotes[e[0]] = e[1];
      });
      setProposalQuotes(quotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await marketMakerApi.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.role === "market_maker") {
      fetchProposals();
      fetchDashboard();
    }
  }, [profile]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleProposalCreated = () => {
    handleTabChange("proposals");
    fetchProposals();
  };

  const handlePublish = async (proposalId: string) => {
    setPublishingId(proposalId);
    try {
      await proposalsApi.publishProposal(proposalId);
      fetchProposals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish market");
    } finally {
      setPublishingId(null);
    }
  };

  const getStatusBadge = (status: Proposal["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Ready to Publish
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "published":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <Zap className="w-3 h-3 mr-1" />
            Published
          </Badge>
        );
    }
  };

  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  const approvedCount = proposals.filter((p) => p.status === "approved").length;
  const liveCount = proposals.filter((p) => p.status === "published").length;
  const rejectedCount = proposals.filter((p) => p.status === "rejected").length;

  if (authLoading || !(profile?.role === "market_maker")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <TutorialOverlay steps={MARKET_MAKING_STEPS} currentStep={marketMakingTutorial.currentStep} isActive={marketMakingTutorial.isActive} elementRect={marketMakingTutorial.elementRect} onNext={marketMakingTutorial.next} onClose={marketMakingTutorial.close} />
      <div className="mb-8 flex items-center gap-3" id="market-making-title">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Making</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage your market proposals
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Pending
              </p>
              <p className="text-2xl font-bold mt-1">{pendingCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ready</p>
              <p className="text-2xl font-bold mt-1">{approvedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Published
              </p>
              <p className="text-2xl font-bold mt-1">{liveCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Rejected
              </p>
              <p className="text-2xl font-bold mt-1">{rejectedCount}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
          </div>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => handleTabChange(v as Tab)}
        className="w-full"
        id="market-making-tabs"
      >
        <TabsList className="mb-8">
          <TabsTrigger value="dashboard" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="proposals" className="gap-2">
            <FileText className="w-4 h-4" />
            My Proposals
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="w-4 h-4" />
            New Proposal
          </TabsTrigger>
        </TabsList>

        {/* Content */}
        <TabsContent value="dashboard">
          <div className="space-y-6">
            {/* P&L Summary Cards */}
            {dashboard && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Initial Funding
                        </p>
                        <p className="text-2xl font-bold mt-1">
                          $
                          {(dashboard.totalInitialFundingCents / 100).toFixed(
                            2,
                          )}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-blue-500" />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Revenue
                        </p>
                        <p className="text-2xl font-bold mt-1 text-emerald-600">
                          ${(dashboard.totalRevenueCents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Total Liability
                        </p>
                        <p className="text-2xl font-bold mt-1 text-amber-600">
                          ${(dashboard.totalLiabilityCents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                        <TrendingDown className="w-5 h-5 text-amber-500" />
                      </div>
                    </div>
                  </Card>

                  <Card className="p-5 bg-gradient-to-br from-card to-card/80 border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Net P&L
                        </p>
                        <p
                          className={`text-2xl font-bold mt-1 ${dashboard.totalNetPnlCents >= 0 ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {dashboard.totalNetPnlCents >= 0 ? "+" : ""}$
                          {(dashboard.totalNetPnlCents / 100).toFixed(2)}
                        </p>
                      </div>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${dashboard.totalNetPnlCents >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}
                      >
                        <BarChart3
                          className={`w-5 h-5 ${dashboard.totalNetPnlCents >= 0 ? "text-emerald-500" : "text-red-500"}`}
                        />
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Markets List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Your Markets</h3>
                  {dashboard.markets.length === 0 ? (
                    <Card className="p-8 text-center">
                      <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">
                        No live markets yet. Create and publish a proposal to
                        get started.
                      </p>
                    </Card>
                  ) : (
                    dashboard.markets.map((market) => (
                      <Card key={market.id} className="p-5 border-border/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                className={
                                  market.status === "resolved"
                                    ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                }
                              >
                                {market.status === "resolved"
                                  ? "Resolved"
                                  : "Live"}
                              </Badge>
                              <Badge
                                className="text-xs text-white"
                                style={{
                                  backgroundColor: categoryColor(
                                    market.category,
                                  ),
                                }}
                              >
                                {market.category}
                              </Badge>
                            </div>
                            <h4 className="font-medium mb-2 line-clamp-2">
                              {market.question}
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">
                                  Init. Funding
                                </p>
                                <p className="font-medium">
                                  $
                                  {(market.initialFundingCents / 100).toFixed(
                                    2,
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Revenue</p>
                                <p className="font-medium text-emerald-600">
                                  ${(market.revenueCents / 100).toFixed(2)}
                                </p>
                              </div>
                              {market.status !== "resolved" ? (
                                <div>
                                  <p className="text-muted-foreground">
                                    Max Liability
                                  </p>
                                  <p className="font-medium text-amber-600">
                                    ${(market.liabilityCents / 100).toFixed(2)}
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-muted-foreground">
                                    Net P&L
                                  </p>
                                  <p
                                    className={`font-medium ${
                                      market.netPnlCents >= 0
                                        ? "text-emerald-600"
                                        : "text-red-600"
                                    }`}
                                  >
                                    {market.netPnlCents >= 0 ? "+" : ""}$
                                    {(market.netPnlCents / 100).toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {market.numTrades} trades
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() =>
                                router.push(`/market/${market.id}`)
                              }
                            >
                              View <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </>
            )}
            {!dashboard && loading && (
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Loading dashboard...
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create">
          <Card className="p-6 max-w-2xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Submit a Market Proposal
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your proposal will be reviewed by an admin before becoming a
                live market.
              </p>
            </div>
            <MarketCreateForm onSuccess={handleProposalCreated} />
          </Card>
        </TabsContent>

        <TabsContent value="proposals">
          <div className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
                {error}
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Loading proposals...
                </div>
              </div>
            )}

            {!loading && proposals.length === 0 && (
              <Card className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No proposals yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first market proposal to get started.
                </p>
                <Button onClick={() => handleTabChange("create")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Proposal
                </Button>
              </Card>
            )}

            {!loading &&
              proposals.map((proposal) => (
                <Card
                  key={proposal.id}
                  className="p-5 hover:bg-muted/30 transition-colors border-border/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusBadge(proposal.status)}
                        <Badge
                          className="text-xs text-white"
                          style={{
                            backgroundColor: categoryColor(proposal.category),
                          }}
                        >
                          {proposal.category}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-lg mb-1 line-clamp-2">
                        {proposal.question}
                      </h3>
                      {proposal.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {proposal.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>
                          Outcomes:{" "}
                          {proposal.outcomes.map((o) => o.outcome).join(", ")}
                        </span>
                        <span>•</span>
                        <span>
                          Resolves:{" "}
                          {new Date(
                            proposal.resolutionDate,
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      {proposal.reviewNote && (
                        <div
                          className={`mt-3 p-3 rounded-lg text-sm ${
                            proposal.status === "rejected"
                              ? "bg-red-500/10 text-red-700"
                              : "bg-emerald-500/10 text-emerald-700"
                          }`}
                        >
                          <span className="font-medium">Review note:</span>{" "}
                          {proposal.reviewNote}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(proposal.createdAt).toLocaleDateString()}
                      </span>
                      {proposal.status === "approved" &&
                        proposalQuotes[proposal.id] != null && (
                          <p className="text-xs text-muted-foreground text-right">
                            Funding required:{" "}
                            <span className="font-semibold text-foreground">
                              ${(proposalQuotes[proposal.id] / 100).toFixed(2)}
                            </span>
                          </p>
                        )}
                      {proposal.status === "approved" && (
                        <Button
                          size="sm"
                          disabled={publishingId === proposal.id}
                          onClick={() => handlePublish(proposal.id)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {publishingId === proposal.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Rocket className="w-4 h-4 mr-1" />
                              Publish Market
                            </>
                          )}
                        </Button>
                      )}
                      {proposal.status === "published" &&
                        proposal.createdMarketId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(`/market/${proposal.createdMarketId}`)
                            }
                          >
                            View Market
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
