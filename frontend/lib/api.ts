const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ApiError {
  detail: string;
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
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
    const error: ApiError = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { supabase } = await import("./supabase");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
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
    displayName?: string;
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
    return response;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await fetchWithAuth<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return response;
  },

  async getCurrentUser(): Promise<AuthResponse["user"]> {
    return fetchWithAuth("/auth/me");
  },
};

// Markets API
export interface MarketWithQuote {
  id: string;
  question: string;
  category: string;
  status: "open" | "closed" | "resolved" | "suspended";
  resolutionDate: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  tags: string[];
  quotes: Array<{
    securityId: string;
    buyUnitPriceCents: number;
    sellUnitPriceCents: number;
    impliedProbability: number;
    lastCalculatedAt: string;
  }>;
  totalVolume: number;
  openInterest: number;
  liquidityParameter: number;
  settlementDates: Array<{
    label: string;
    date: string;
  }>;
}

export interface MarketListResponse {
  items: MarketWithQuote[];
  count: number;
}

export interface MarketCreate {
  question: string;
  outcomes: string[];
  category: string;
  resolutionDate: string;
  description?: string;
  tags?: string[];
  initialLiquidity?: number;
}

export const marketsApi = {
  async listMarkets(params?: { category?: string; status?: string; }): Promise<MarketListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set("category", params.category);
    if (params?.status) searchParams.set("status", params.status);

    const query = searchParams.toString();
    return fetchWithAuth(`/markets${query ? `?${query}` : ""}`);
  },

  async getMarket(id: string): Promise<MarketWithQuote> {
    return fetchWithAuth(`/markets/${id}`);
  },

  async createMarket(data: MarketCreate): Promise<MarketWithQuote> {
    return fetchWithAuth("/markets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateMarket(id: string, data: Partial<MarketCreate>): Promise<MarketWithQuote> {
    return fetchWithAuth(`/markets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

// Trades API
export interface TradeCreate {
  security_id: string;
  quantity: number;
}

export interface TradeRecord {
  id: string;
  userId: string;
  marketId: string;
  securityId: string;
  quantity: number;
  priceCents: number;
  createdAt: string;
}

export interface TradeListResponse {
  items: TradeRecord[];
  count: number;
}

export const tradesApi = {
  async listTrades(params?: { marketId?: string; }): Promise<TradeListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.marketId) searchParams.set("marketId", params.marketId);

    const query = searchParams.toString();
    return fetchWithAuth(`/trades${query ? `?${query}` : ""}`);
  },

  async placeTrade(data: TradeCreate): Promise<TradeRecord> {
    return fetchWithAuth("/trades", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// Users API
export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  joinedAt: string;
  lastSeenAt?: string;
  totalTrades: number;
  openPositions: number;
  realisedPnL: number;
}

export interface PortfolioSnapshot {
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

export const usersApi = {
  async getProfile(userId?: string): Promise<UserProfile> {
    const endpoint = userId ? `/users/${userId}/profile` : "/users/me/profile";
    return fetchWithAuth(endpoint);
  },

  async getPortfolio(): Promise<PortfolioSnapshot> {
    return fetchWithAuth("/users/me/portfolio");
  },
}

