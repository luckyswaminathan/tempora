"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { authApi, setAccessToken } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_CACHE_KEY = "tempora_user_cache";

// Load cached user synchronously on app start
function getCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(USER_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getCachedUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Fetch fresh data in background
        const me = await authApi.getCurrentUser();
        setUser(me);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(me));
      } catch {
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const signIn = async (email: string, password: string) => {
    const resp = await authApi.login({ email, password });
    setUser(resp.user);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(resp.user));
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    const resp = await authApi.register({ email, password, displayName });
    setUser(resp.user);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(resp.user));
  };

  const signOut = async () => {
    authApi.logout();
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(USER_CACHE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
