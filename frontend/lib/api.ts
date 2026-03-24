const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "tempora_access_token";

export interface ApiError {
  detail: string;
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error: ApiError = await response
      .json()
      .catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

// Auth API
export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: "user" | "market_maker" | "admin";
    createdAt?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: "bearer";
  };
}

export const authApi = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetchWithAuth<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
      }),
    });
    setAccessToken(response.tokens.accessToken);
    return response;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetchWithAuth<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setAccessToken(response.tokens.accessToken);
    return response;
  },

  async getCurrentUser(): Promise<AuthResponse["user"]> {
    return fetchWithAuth("/auth/me");
  },

  logout(): void {
    setAccessToken(null);
  },
};

// Markets API
export type MarketStatus = "open" | "closed" | "resolved" | "suspended";

export interface Market {
  id: string;
  question: string;
  category: string;
  status: MarketStatus;
  resolutionDate: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  tags: string[];
  uiType:
    | "bars-ordered"
    | "bars-categorical"
    | "year"
    | "quarter"
    | "month"
    | "day"
    | "interval";
  creatorId: string;
  winningSecurityId?: string;
  quotes: Array<{
    securityId: string;
    quantityTraded: number;
    buyUnitPriceCents: number;
    sellUnitPriceCents: number;
    impliedProbability: number;
    lastCalculatedAt: string;
  }>;
  securities: Array<{
    id: string;
    marketId: string;
    outcome: string;
    value: number;
    isCatchAll: boolean;
    createdAt: string;
  }>;
  openInterest: number;
  totalVolume: number;
  liquidityParameter: number | null;
}

export interface MarketListResponse {
  items: Market[];
  count: number;
}

export interface CommentAuthor {
  id: string;
  displayName?: string;
  email: string;
}

export interface CommentReactionCount {
  reaction: string;
  count: number;
}

export interface MarketComment {
  id: string;
  marketId: string;
  userId: string;
  parentCommentId?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  reactions: CommentReactionCount[];
  myReactions: string[];
  replies: MarketComment[];
}

export interface MarketCommentListResponse {
  items: MarketComment[];
  count: number;
}

export interface CreateCommentRequest {
  content: string;
  parentCommentId?: string;
}

export interface CommentReactionResponse {
  commentId: string;
  reaction: string;
  active: boolean;
}

export interface SecurityUpdate {
  id: string;
  outcome: string;
}

export interface MarketUpdate {
  question: string;
  category: string;
  resolutionDate: string;
  description?: string;
  tags?: string[];
  status?: Exclude<MarketStatus, "resolved">;
  securities: SecurityUpdate[];
}

export interface MarketSettlementResponse {
  id: string;
  winningOutcome: string;
  netPayout: number;
}

export interface SettlementUserTotals {
  positionCount: number;
  totalCostCents: number;
  totalPayoutCents: number;
  totalPnlCents: number;
}

export interface SettlementPayoutEntry {
  userId: string;
  payoutCents: number;
}

export interface SettlementInfo {
  marketId: string;
  winningSecurityId: string;
  winningOutcome: string;
  settlementDate: string;
  userTotals?: SettlementUserTotals;
  payoutDistribution?: SettlementPayoutEntry[];
  marketTotalRevenueCents?: number;
  marketTotalPayoutCents?: number;
  marketNetPnlCents?: number;
}

export const marketsApi = {
  async listMarkets(params?: {
    category?: string;
    status?: string;
  }): Promise<MarketListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.status) searchParams.set("status", params.status);

    const query = searchParams.toString();
    return fetchWithAuth(`/markets${query ? `?${query}` : ""}`);
  },

  async getMarket(id: string): Promise<Market> {
    return fetchWithAuth(`/markets/${id}`);
  },

  async updateMarket(id: string, data: Partial<MarketUpdate>): Promise<Market> {
    return fetchWithAuth(`/markets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async getSettlementInfo(marketId: string): Promise<SettlementInfo> {
    return fetchWithAuth(`/markets/${marketId}/settlement-info`);
  },

  async settleMarket(
    winningSecurityId: string,
  ): Promise<MarketSettlementResponse> {
    return fetchWithAuth(`/markets/settle`, {
      method: "PUT",
      body: JSON.stringify({
        winningSecurityId: winningSecurityId,
      }),
    });
  },
};

export const commentsApi = {
  async listComments(marketId: string): Promise<MarketCommentListResponse> {
    return fetchWithAuth(`/markets/${marketId}/comments`);
  },

  async createComment(
    marketId: string,
    data: CreateCommentRequest,
  ): Promise<MarketComment> {
    return fetchWithAuth(`/markets/${marketId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async toggleReaction(
    marketId: string,
    commentId: string,
    reaction: string,
  ): Promise<CommentReactionResponse> {
    return fetchWithAuth(
      `/markets/${marketId}/comments/${commentId}/reactions`,
      {
        method: "POST",
        body: JSON.stringify({ reaction }),
      },
    );
  },
};

// Orders API
export type OrderType = "market" | "limit";

export interface Leg {
  securityId: string;
  quantity: number;
}

export interface LegWithOutcome {
  securityId: string;
  outcome: string;
  quantity: number;
}

export interface OrderCreateRequest {
  marketId: string;
  legs: Leg[];
  // Advanced order options (optional - defaults to market order)
  orderType?: OrderType;
  // Max avg price for limit orders
  limitPriceCents?: number;
  // Optional limit order TTL in minutes before auto-cancel
  expirationMinutes?: number;
}

export interface TradeRecord {
  id: string;
  securityId: string;
  outcome: string;
  quantity: number;
  priceCents: number;
  createdAt: string;
}

interface _BaseOrderFields {
  id: string;
  userId: string;
  marketId: string;
  question: string;
  collateralLockedCents?: number;
  createdAt: string;
  expiresAt?: string;
  filled: boolean;
  canceled: boolean;
  legs: [LegWithOutcome, ...LegWithOutcome[]];
  trades: TradeRecord[];
  priceCents: number;
}

export interface MarketOrderRecord extends _BaseOrderFields {
  type: "market";
}

export interface LimitOrderRecord extends _BaseOrderFields {
  type: "limit";
  limitPriceCents: number;
}

export type OrderRecord = MarketOrderRecord | LimitOrderRecord;

export function isLimitOrder(order: OrderRecord): order is LimitOrderRecord {
  return order.type === "limit";
}

export interface OrderListResponse {
  items: OrderRecord[];
  count: number;
}

export interface OrderPlaceResponse {
  orderId: string;
  filled: boolean;
  priceCents: number;
}

export interface OrderPriceResponse {
  priceCents: number;
  pricedAt: string;
  /** Only present when called via the authenticated /price/me endpoint */
  collateralRequiredCents?: number;
}

export interface ProbabilityHistData {
  probability: number;
  date: string;
}

export interface ProbabilityHistResponse {
  history: ProbabilityHistData[];
}

export type NotificationEventType =
  | "limit_order_filled"
  | "limit_order_expired"
  | "position_market_settled"
  | "market_maker_market_settled"
  | "market_maker_market_status_updated"
  | "admin_market_overdue_closed";

export interface NotificationItem {
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  count: number;
  unreadCount: number;
}

export interface NotificationUnreadCountResponse {
  unreadCount: number;
}

export const notificationsApi = {
  async listNotifications(params?: {
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<NotificationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.unreadOnly) searchParams.set("unreadOnly", "true");
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const query = searchParams.toString();
    return fetchWithAuth(`/notifications${query ? `?${query}` : ""}`);
  },

  async getUnreadCount(): Promise<NotificationUnreadCountResponse> {
    return fetchWithAuth("/notifications/unread-count");
  },

  async markRead(
    notificationId: string,
  ): Promise<{ id: string; isRead: boolean }> {
    return fetchWithAuth(`/notifications/${notificationId}/read`, {
      method: "POST",
    });
  },

  async markAllRead(): Promise<{ updated: number }> {
    return fetchWithAuth("/notifications/read-all", {
      method: "POST",
    });
  },
};

export const ordersApi = {
  async listOrders(params?: { marketId?: string }): Promise<OrderListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.marketId) searchParams.set("marketId", params.marketId);

    const query = searchParams.toString();
    return fetchWithAuth(`/orders${query ? `?${query}` : ""}`);
  },

  async listMarketHistory(marketId: string): Promise<OrderListResponse> {
    return fetchWithAuth(`/orders/market/${marketId}/history`);
  },

  async priceOrder(data: OrderCreateRequest): Promise<OrderPriceResponse> {
    return fetchWithAuth("/orders/price", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /** Authenticated variant — also returns collateralRequiredCents for the current user. */
  async priceOrderAuthenticated(
    data: OrderCreateRequest,
  ): Promise<OrderPriceResponse> {
    return fetchWithAuth("/orders/price/me", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async placeOrder(data: OrderCreateRequest): Promise<OrderPlaceResponse> {
    return fetchWithAuth("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async cancelOrder(orderId: string): Promise<OrderRecord> {
    return fetchWithAuth(`/orders/${orderId}/cancel`, {
      method: "POST",
    });
  },
};

// Users API
export interface UserProfile {
  id: string;
  email: string;
  role: "user" | "market_maker" | "admin";
  displayName?: string;
  wallet: number;
  joinedAt: string;
  lastSeenAt?: string;
  tutorialCompletions?: Record<string, boolean>;
  emailNotificationsEnabled?: boolean;
}

// Admin types
export interface AdminUserListItem {
  id: string;
  email: string;
  role: "user" | "market_maker" | "admin";
  display_name?: string;
  wallet: number;
  created_at?: string;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
  count: number;
}

export interface PortfolioSnapshot {
  wallet: number;
  spendableBalance: number;
  collateralLocked: number;
  holdings: Array<{
    marketId: string;
    securityId: string;
    question: string;
    outcome: string;
    avgPriceCents: number;
    quantity: number;
    markPriceCents: number;
    endDate: string;
    pnl: number;
    category: string;
  }>;
  settledPositions: Array<{
    marketId: string;
    question: string;
    category: string;
    securityId: string;
    outcome: string;
    quantity: number;
    costBasisCents: number;
    payoutCents: number;
    pnlCents: number;
    winningOutcome: string;
    settlementDate: string;
  }>;
  summary: {
    costBasis: number;
    marketValue: number;
    unrealisedPnL: number;
    roi: number;
    avgProbability: number;
  };
}

export interface ShortPosition {
  outcome: string;
  quantity: number; // negative value
}

export interface MarketShortCollateral {
  marketId: string;
  question: string;
  positions: ShortPosition[];
  collateralCents: number; // max(abs(quantity)) * 100
}

export interface LimitOrderCollateral {
  orderId: string;
  marketId: string;
  question: string;
  collateralCents: number;
  createdAt: string;
}

export interface MarketMakerCollateral {
  marketId: string;
  question: string;
  /** b·ln(N) worst-case net loss set at market creation */
  initialFundingCents: number;
  /** Trade revenue already collected into wallet */
  revenueCents: number;
  /**
   * initialFunding + revenue: total worst-case payout obligation.
   * Grows when traders buy (revenue > 0); shrinks when traders sell back to the AMM
   * (revenue < 0, reducing the AMM's payout exposure at resolution).
   */
  effectiveCollateralCents: number;
  endDate: string;
}

export interface CollateralBreakdown {
  totalLocked: number;
  shortMarkets: MarketShortCollateral[];
  totalShortCollateral: number;
  limitOrders: LimitOrderCollateral[];
  totalLimitOrderCollateral: number;
  marketMakerMarkets: MarketMakerCollateral[];
  totalMarketMakerCollateral: number;
}

export interface LeaderboardResponse {
  leaderboard: Array<{
    id: string;
    email: string;
    role: "user" | "market_maker" | "admin";
    displayName?: string;
    wallet: number;
    joinedAt: string;
    lastSeenAt?: string;
  }>;
}

export const usersApi = {
  async getProfile(userId?: string): Promise<UserProfile> {
    const endpoint = userId ? `/users/${userId}/profile` : "/users/me/profile";
    return fetchWithAuth(endpoint);
  },

  async getPortfolio(): Promise<PortfolioSnapshot> {
    return fetchWithAuth("/users/me/portfolio");
  },

  async getCollateral(): Promise<CollateralBreakdown> {
    return fetchWithAuth("/users/me/collateral");
  },

  async syncProfile(displayName: string): Promise<JSON> {
    return fetchWithAuth("/auth/sync-profile", {
      method: "POST",
      body: JSON.stringify({ displayName }),
    });
  },

  async getLeaderboard(params: {
    limit: number;
  }): Promise<LeaderboardResponse> {
    const searchParams = new URLSearchParams();
    searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return fetchWithAuth(`/users/leaderboard?${query}`);
  },

  async updateTutorialCompletion(
    lessonKey: string,
    completed: boolean,
  ): Promise<UserProfile> {
    return fetchWithAuth("/users/me/tutorial", {
      method: "PUT",
      body: JSON.stringify({ lessonKey, completed }),
    });
  },

  async addFunds(amount: number): Promise<UserProfile> {
    return fetchWithAuth("/users/me/wallet/add-funds", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  },

  async updateEmailNotificationsPreference(
    enabled: boolean,
  ): Promise<UserProfile> {
    return fetchWithAuth("/users/me/preferences/notifications/email", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  },

  async getWalletHistory(
    days: number = 30,
  ): Promise<{ data: Array<{ t: string; v: number }> }> {
    return fetchWithAuth(`/users/me/wallet-history?days=${days}`);
  },
};

// History API
export const historyApi = {
  async getProbabilityHistory(
    securityId: string,
  ): Promise<ProbabilityHistResponse> {
    return fetchWithAuth(`/history/probability/${securityId}`);
  },
};

// Admin API
export const adminApi = {
  async listUsers(): Promise<AdminUserListResponse> {
    return fetchWithAuth("/admin/users");
  },

  async listMarketMakers(): Promise<AdminUserListResponse> {
    return fetchWithAuth("/admin/market-makers");
  },

  async updateUserRole(
    userId: string,
    role: "user" | "market_maker" | "admin",
  ): Promise<AdminUserListItem> {
    return fetchWithAuth(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  async getUserProposals(userId: string): Promise<ProposalListResponse> {
    return fetchWithAuth(`/admin/users/${userId}/proposals`);
  },
};

// Proposals API
export interface ProposerInfo {
  id: string;
  email: string;
  displayName?: string;
}

export interface OutcomeWithValue {
  outcome: string;
  value?: number;
  isCatchAll?: boolean;
}

export interface Proposal {
  id: string;
  proposerId: string;
  proposer?: ProposerInfo;
  question: string;
  category: string;
  description?: string;
  resolutionDate: string;
  outcomes: OutcomeWithValue[];
  tags: string[];
  liquidityParameter?: number;
  uiType: string;
  status: "pending" | "approved" | "rejected" | "published";
  reviewerId?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdMarketId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalListResponse {
  proposals: Proposal[];
  count: number;
}

export interface ProposalQuote {
  liquidityParameter: number;
  numOutcomes: number;
  initialFundingCents: number;
}

export interface ProposalCreate {
  question: string;
  category: string;
  description?: string;
  resolutionDate: string;
  outcomes: OutcomeWithValue[];
  tags?: string[];
  liquidityParameter?: number;
  uiType?: string;
}

export const proposalsApi = {
  async createProposal(data: ProposalCreate): Promise<Proposal> {
    return fetchWithAuth("/proposals", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getMyProposals(): Promise<ProposalListResponse> {
    return fetchWithAuth("/proposals/mine");
  },

  async getPendingProposals(): Promise<ProposalListResponse> {
    return fetchWithAuth("/proposals/pending");
  },

  async getAllProposals(status?: string): Promise<ProposalListResponse> {
    const params = status ? `?status=${status}` : "";
    return fetchWithAuth(`/proposals${params}`);
  },

  async reviewProposal(
    proposalId: string,
    approved: boolean,
    note?: string,
  ): Promise<Proposal> {
    return fetchWithAuth(`/proposals/${proposalId}/review`, {
      method: "POST",
      body: JSON.stringify({ approved, note }),
    });
  },

  async publishProposal(proposalId: string): Promise<Proposal> {
    return fetchWithAuth(`/proposals/${proposalId}/publish`, {
      method: "POST",
    });
  },

  async getQuote(
    liquidityParameter: number,
    numOutcomes: number,
  ): Promise<ProposalQuote> {
    return fetchWithAuth(
      `/proposals/quote?liquidityParameter=${liquidityParameter}&numOutcomes=${numOutcomes}`,
    );
  },
};

// Market Maker Dashboard Types
export interface MarketMakerMarket {
  id: string;
  question: string;
  category: string;
  status: string;
  resolutionDate: string;
  createdAt: string;
  /** b·ln(N) worst-case net loss set at market creation */
  initialFundingCents: number;
  revenueCents: number;
  liabilityCents: number;
  netPnlCents: number;
  numTrades: number;
  winningSecurityId?: string;
}

export interface MarketMakerDashboard {
  markets: MarketMakerMarket[];
  totalInitialFundingCents: number;
  totalRevenueCents: number;
  totalLiabilityCents: number;
  totalNetPnlCents: number;
}

export const marketMakerApi = {
  async getDashboard(): Promise<MarketMakerDashboard> {
    return fetchWithAuth("/markets/maker/dashboard");
  },
};
