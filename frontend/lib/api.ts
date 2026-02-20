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
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
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
export interface Market {
  id: string;
  question: string;
  category: string;
  status: "open" | "closed" | "resolved" | "suspended";
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
  status?: "open" | "closed" | "suspended";
  securities: SecurityUpdate[];
}

export interface MarketSettlementResponse {
  id: string;
  winningOutcome: string;
  netPayout: number;
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

// Orders API
export interface Leg {
  securityId: string;
  quantity: number;
}

export interface OrderCreateRequest {
  marketId: string;
  legs: Leg[];
}

export interface TradeRecord {
  id: string;
  securityId: string;
  quantity: number;
  priceCents: number;
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  type: string;
  userId: string;
  marketId: string;
  createdAt: string;
  filled: boolean;
  trades: TradeRecord[];
  priceCents: number;
}

export interface OrderListResponse {
  items: OrderRecord[];
  count: number;
}

export interface OrderPriceResponse {
  priceCents: number;
  pricedAt: string;
}

export interface ProbabilityHistData {
  probability: number;
  date: string;
}

export interface ProbabilityHistResponse {
  history: ProbabilityHistData[];
}

export const ordersApi = {
  async listOrders(params?: { marketId?: string }): Promise<OrderListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.marketId) searchParams.set("marketId", params.marketId);

    const query = searchParams.toString();
    return fetchWithAuth(`/orders${query ? `?${query}` : ""}`);
  },

  async priceOrder(data: OrderCreateRequest): Promise<OrderPriceResponse> {
    return fetchWithAuth("/orders/price", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async placeOrder(data: OrderCreateRequest): Promise<OrderRecord> {
    return fetchWithAuth("/orders", {
      method: "POST",
      body: JSON.stringify(data),
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
  }>;
  summary: {
    costBasis: number;
    marketValue: number;
    unrealisedPnL: number;
    roi: number;
  };
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
  status: "pending" | "approved" | "rejected" | "live";
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
};

// Market Maker Dashboard Types
export interface MarketMakerMarket {
  id: string;
  question: string;
  category: string;
  status: string;
  resolutionDate: string;
  createdAt: string;
  fundingCollateralCents: number;
  revenueCents: number;
  liabilityCents: number;
  netPnlCents: number;
  numTrades: number;
  winningSecurityId?: string;
}

export interface MarketMakerDashboard {
  markets: MarketMakerMarket[];
  totalFundingCollateralCents: number;
  totalRevenueCents: number;
  totalLiabilityCents: number;
  totalNetPnlCents: number;
}

export const marketMakerApi = {
  async getDashboard(): Promise<MarketMakerDashboard> {
    return fetchWithAuth("/markets/maker/dashboard");
  },
};
