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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const me = await authApi.getCurrentUser();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const signIn = async (email: string, password: string) => {
    const resp = await authApi.login({ email, password });
    setUser(resp.user);
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    const resp = await authApi.register({ email, password, displayName });
    setUser(resp.user);
  };

  const signOut = async () => {
    authApi.logout();
    setUser(null);
    setAccessToken(null);
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
