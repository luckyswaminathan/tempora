"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { authApi, usersApi, setAccessToken, type UserProfile } from "@/lib/api";
import { migrateLocalCompletions } from "@/hooks/useTutorial";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const profileData = await usersApi.getProfile();
      setProfile(profileData);
      return profileData;
    } catch {
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Fetch fresh data in background
        const me = await authApi.getCurrentUser();
        setUser(me);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(me));

        // Also fetch profile
        await fetchProfile();
      } catch {
        setUser(null);
        setProfile(null);
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
    await fetchProfile();

    // Migrate local tutorial completions to backend after sign in
    await migrateLocalCompletions(fetchProfile);
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    const resp = await authApi.register({ email, password, displayName });
    setUser(resp.user);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(resp.user));
    await fetchProfile();

    // Migrate local tutorial completions to backend after sign up
    await migrateLocalCompletions(fetchProfile);
  };

  const signOut = async () => {
    authApi.logout();
    setUser(null);
    setProfile(null);
    setAccessToken(null);
    localStorage.removeItem(USER_CACHE_KEY);
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
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
