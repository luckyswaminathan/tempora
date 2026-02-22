"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Users,
  TrendingUp,
  Search,
  Check,
  X,
  Crown,
  Sparkles,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowLeft,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  adminApi,
  proposalsApi,
  type AdminUserListItem,
  type Proposal,
} from "@/lib/api";

type MainTab = "users" | "proposals";

export default function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [marketMakers, setMarketMakers] = useState<AdminUserListItem[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [submittingProposalId, setSubmittingProposalId] = useState<
    string | null
  >(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(
    null,
  );
  const [reviewNote, setReviewNote] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>(
    () => (searchParams.get("tab") as MainTab) ?? "proposals",
  );
  const [activeTab, setActiveTab] = useState<"all" | "market-makers">("all");
  const [proposalFilter, setProposalFilter] = useState<"pending" | "all">(
    "pending",
  );
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(
    null,
  );
  const [selectedUserProposals, setSelectedUserProposals] = useState<
    Proposal[]
  >([]);
  const [loadingUserProposals, setLoadingUserProposals] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const fetchProposals = async () => {
    try {
      const response =
        proposalFilter === "pending"
          ? await proposalsApi.getPendingProposals()
          : await proposalsApi.getAllProposals();
      setProposals(response.proposals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersRes, marketMakersRes, proposalsRes] = await Promise.all([
          adminApi.listUsers(),
          adminApi.listMarketMakers(),
          proposalsApi.getPendingProposals(),
        ]);
        setUsers(usersRes.users);
        setMarketMakers(marketMakersRes.users);
        setProposals(proposalsRes.proposals);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === "admin") {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchProposals();
    }
  }, [proposalFilter, user]);

  const handleSelectUser = async (u: AdminUserListItem) => {
    setSelectedUser(u);
    setLoadingUserProposals(true);
    try {
      const response = await adminApi.getUserProposals(u.id);
      setSelectedUserProposals(response.proposals);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load user proposals",
      );
      setSelectedUserProposals([]);
    } finally {
      setLoadingUserProposals(false);
    }
  };

  const handleCloseUserDetail = () => {
    setSelectedUser(null);
    setSelectedUserProposals([]);
  };

  const handleToggleMarketMaker = async (
    userId: string,
    currentRole: "user" | "market_maker" | "admin",
  ) => {
    setUpdatingUserId(userId);
    try {
      const newRole = currentRole === "market_maker" ? "user" : "market_maker";
      const updated = await adminApi.updateUserRole(userId, newRole);

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)),
      );

      // Update market makers list
      if (updated.role === "market_maker") {
        const userToAdd = users.find((u) => u.id === userId);
        if (userToAdd) {
          setMarketMakers((prev) => [
            ...prev,
            { ...userToAdd, role: "market_maker" },
          ]);
        }
      } else {
        setMarketMakers((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update market maker status",
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleReviewProposal = async (
    proposalId: string,
    approved: boolean,
  ) => {
    setSubmittingProposalId(proposalId);
    try {
      const noteToSend =
        editingProposalId === proposalId ? reviewNote : undefined;
      await proposalsApi.reviewProposal(
        proposalId,
        approved,
        noteToSend || undefined,
      );
      setReviewNote("");
      setEditingProposalId(null);
      // Refresh proposals
      await fetchProposals();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to review proposal",
      );
    } finally {
      setSubmittingProposalId(null);
    }
  };

  const filteredUsers = (activeTab === "all" ? users : marketMakers).filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.display_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()),
  );

  const regularUsers = users.filter((u) => u.role === "user");
  const marketMakerCount = marketMakers.length;
  const pendingProposalsCount = proposals.filter(
    (p) => p.status === "pending",
  ).length;

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header Section */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage users and review market proposals
                </p>
              </div>
            </div>
            {pendingProposalsCount > 0 && (
              <Badge className="bg-amber-500 text-white">
                {pendingProposalsCount} pending
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Main Tabs */}
        <Tabs
          value={mainTab}
          onValueChange={(v) => {
            const tab = v as MainTab;
            setMainTab(tab);
            const params = new URLSearchParams(searchParams?.toString() ?? "");
            params.set("tab", tab);
            router.replace(`${pathname}?${params.toString()}`);
          }}
          className="w-full"
        >
          <TabsList className="mb-8">
            <TabsTrigger value="proposals" className="gap-2">
              <FileText className="w-4 h-4" />
              Market Proposals
              {pendingProposalsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                  {pendingProposalsCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              User Management
            </TabsTrigger>
          </TabsList>

          {/* Proposals Section */}
          <TabsContent value="proposals">
            {/* Proposal Filter */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setProposalFilter("pending")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  proposalFilter === "pending"
                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/30"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                Pending Review
              </button>
              <button
                onClick={() => setProposalFilter("all")}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  proposalFilter === "all"
                    ? "bg-muted text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                All Proposals
              </button>
            </div>

            {/* Proposals List */}
            <div className="space-y-4">
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
                  <h3 className="text-lg font-medium mb-2">
                    {proposalFilter === "pending"
                      ? "No pending proposals"
                      : "No proposals yet"}
                  </h3>
                  <p className="text-muted-foreground">
                    {proposalFilter === "pending"
                      ? "All market proposals have been reviewed."
                      : "Market makers haven't submitted any proposals yet."}
                  </p>
                </Card>
              )}

              {!loading &&
                proposals.map((proposal) => (
                  <Card key={proposal.id} className="p-5 border-border/50">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {proposal.status === "pending" && (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          {proposal.status === "approved" && (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Ready to Publish
                            </Badge>
                          )}
                          {proposal.status === "live" && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              <Zap className="w-3 h-3 mr-1" />
                              Live
                            </Badge>
                          )}
                          {proposal.status === "rejected" && (
                            <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                              <XCircle className="w-3 h-3 mr-1" />
                              Rejected
                            </Badge>
                          )}
                          <Badge variant="outline">{proposal.category}</Badge>
                        </div>
                        <h3 className="font-semibold text-lg mb-1">
                          {proposal.question}
                        </h3>
                        {proposal.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {proposal.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Outcomes:{" "}
                            {proposal.outcomes.map((o) => o.outcome).join(", ")}
                          </span>
                          <span>
                            Resolves:{" "}
                            {new Date(
                              proposal.resolutionDate,
                            ).toLocaleDateString()}
                          </span>
                          {proposal.proposer && (
                            <span>
                              By:{" "}
                              {proposal.proposer.displayName ||
                                proposal.proposer.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(proposal.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {proposal.status === "pending" && (
                      <div className="pt-4 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          <Input
                            placeholder="Add a note (optional)..."
                            value={
                              editingProposalId === proposal.id
                                ? reviewNote
                                : ""
                            }
                            onChange={(e) => {
                              setEditingProposalId(proposal.id);
                              setReviewNote(e.target.value);
                            }}
                            className="flex-1 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              handleReviewProposal(proposal.id, true)
                            }
                            disabled={submittingProposalId === proposal.id}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {submittingProposalId === proposal.id ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleReviewProposal(proposal.id, false)
                            }
                            disabled={submittingProposalId === proposal.id}
                            className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {proposal.reviewNote && proposal.status !== "pending" && (
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
                  </Card>
                ))}
            </div>
          </TabsContent>

          {/* Users Section */}
          <TabsContent value="users">
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Users
                      </p>
                      <p className="text-3xl font-bold mt-1">{users.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Market Makers
                      </p>
                      <p className="text-3xl font-bold mt-1">
                        {marketMakerCount}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-emerald-500" />
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-card to-card/80 border-border/50 hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Regular Users
                      </p>
                      <p className="text-3xl font-bold mt-1">
                        {regularUsers.length}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Crown className="w-6 h-6 text-amber-500" />
                    </div>
                  </div>
                </Card>
              </div>

              {/* User Tabs & Search */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <Tabs
                  value={activeTab}
                  onValueChange={(v) =>
                    setActiveTab(v as "all" | "market-makers")
                  }
                >
                  <TabsList>
                    <TabsTrigger value="all">All Users</TabsTrigger>
                    <TabsTrigger value="market-makers" className="gap-2">
                      <Sparkles className="w-4 h-4" />
                      Market Makers
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background"
                  />
                </div>
              </div>

              {/* Error State */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive mb-6">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 underline hover:no-underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Loading users...
                  </div>
                </div>
              )}

              {/* Users List or User Detail */}
              {!loading && !selectedUser && (
                <div className="space-y-3">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      {searchTerm
                        ? "No users found matching your search."
                        : activeTab === "market-makers"
                          ? "No market makers yet."
                          : "No users found."}
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <Card
                        key={u.id}
                        className="p-4 hover:bg-muted/30 transition-colors border-border/50 cursor-pointer group"
                        onClick={() => handleSelectUser(u)}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                              <span className="text-sm font-semibold text-violet-600">
                                {(u.display_name || u.email)[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">
                                  {u.display_name || u.email}
                                </span>
                                {u.role === "admin" && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-violet-500/10 text-violet-600 border-violet-500/20"
                                  >
                                    Admin
                                  </Badge>
                                )}
                                {u.role === "market_maker" && (
                                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    Market Maker
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {u.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 shrink-0">
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-muted-foreground">
                                Wallet
                              </p>
                              <p className="font-semibold text-emerald-600">
                                ${(u.wallet / 100).toFixed(2)}
                              </p>
                            </div>

                            {u.role === "user" && (
                              <Button
                                variant="default"
                                size="sm"
                                disabled={updatingUserId === u.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleMarketMaker(u.id, u.role);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                {updatingUserId === u.id ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Check className="w-4 h-4 mr-1" />
                                    Make MM
                                  </>
                                )}
                              </Button>
                            )}

                            {u.role === "market_maker" && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={updatingUserId === u.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleMarketMaker(u.id, u.role);
                                }}
                                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                              >
                                {updatingUserId === u.id ? (
                                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <X className="w-4 h-4 mr-1" />
                                    Remove MM
                                  </>
                                )}
                              </Button>
                            )}

                            {u.role === "admin" && (
                              <div className="text-xs text-muted-foreground italic px-3">
                                N/A
                              </div>
                            )}

                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* Selected User Detail */}
              {!loading && selectedUser && (
                <div className="space-y-6">
                  {/* Back button and user header */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCloseUserDetail}
                      className="gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Users
                    </Button>
                  </div>

                  {/* User Info Card */}
                  <Card className="p-6 border-border/50">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                        <span className="text-2xl font-semibold text-violet-600">
                          {(selectedUser.display_name ||
                            selectedUser.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-xl font-bold">
                            {selectedUser.display_name || selectedUser.email}
                          </h2>
                          {selectedUser.role === "admin" && (
                            <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20">
                              Admin
                            </Badge>
                          )}
                          {selectedUser.role === "market_maker" && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Market Maker
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">
                          {selectedUser.email}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">
                          Wallet
                        </p>
                        <p className="text-lg font-semibold text-emerald-600">
                          ${(selectedUser.wallet / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">
                          Role
                        </p>
                        <p className="text-lg font-semibold capitalize">
                          {selectedUser.role}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">
                          Proposals
                        </p>
                        <p className="text-lg font-semibold">
                          {selectedUserProposals.length}
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">
                          Joined
                        </p>
                        <p className="text-lg font-semibold">
                          {selectedUser.created_at
                            ? new Date(
                                selectedUser.created_at,
                              ).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* User's Proposals */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Market Proposals
                    </h3>

                    {loadingUserProposals && (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center gap-2 text-muted-foreground">
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Loading proposals...
                        </div>
                      </div>
                    )}

                    {!loadingUserProposals &&
                      selectedUserProposals.length === 0 && (
                        <Card className="p-8 text-center border-border/50">
                          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                          <p className="text-muted-foreground">
                            This user hasn&apos;t submitted any market proposals
                            yet.
                          </p>
                        </Card>
                      )}

                    {!loadingUserProposals &&
                      selectedUserProposals.length > 0 && (
                        <div className="space-y-3">
                          {selectedUserProposals.map((proposal) => (
                            <Card
                              key={proposal.id}
                              className="p-4 border-border/50"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    {proposal.status === "pending" && (
                                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Pending
                                      </Badge>
                                    )}
                                    {proposal.status === "approved" && (
                                      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Ready to Publish
                                      </Badge>
                                    )}
                                    {proposal.status === "live" && (
                                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                        <Zap className="w-3 h-3 mr-1" />
                                        Live
                                      </Badge>
                                    )}
                                    {proposal.status === "rejected" && (
                                      <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                                        <XCircle className="w-3 h-3 mr-1" />
                                        Rejected
                                      </Badge>
                                    )}
                                    <Badge variant="outline">
                                      {proposal.category}
                                    </Badge>
                                  </div>
                                  <h4 className="font-medium mb-1">
                                    {proposal.question}
                                  </h4>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span>
                                      Outcomes:{" "}
                                      {proposal.outcomes
                                        .map((o) => o.outcome)
                                        .join(", ")}
                                    </span>
                                    <span>
                                      Resolves:{" "}
                                      {new Date(
                                        proposal.resolutionDate,
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {proposal.reviewNote && (
                                    <div
                                      className={`mt-2 p-2 rounded text-xs ${
                                        proposal.status === "rejected"
                                          ? "bg-red-500/10 text-red-700"
                                          : "bg-emerald-500/10 text-emerald-700"
                                      }`}
                                    >
                                      <span className="font-medium">Note:</span>{" "}
                                      {proposal.reviewNote}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {new Date(
                                    proposal.createdAt,
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              )}
            </>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
