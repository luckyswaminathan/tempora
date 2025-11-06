"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)

      // Sync profile to backend when user signs in
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const metadata = session.user.user_metadata || {}
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/sync-profile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              displayName: metadata.display_name || null,
            }),
          })
        } catch (error) {
          // Non-critical error, just log it
          console.warn("Failed to sync profile:", error)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // Handle email confirmation error specifically
      if (error.message.includes("email not confirmed") || error.message.includes("Email not confirmed")) {
        throw new Error(
          "Please check your email and click the confirmation link before signing in. " +
          "If you didn't receive it, check your spam folder."
        )
      }
      throw error
    }

    if (!data.user) {
      throw new Error("Sign in failed - no user returned")
    }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || null,
        },
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) {
      throw error
    }

    if (!data.user) {
      throw new Error("Sign up failed - no user returned")
    }

    // If email confirmation is enabled, user won't have a session immediately
    // But if it's disabled, they'll be signed in right away
    if (data.session) {
      // User is signed in immediately (email confirmation disabled)
      return
    } else {
      // Email confirmation required - user needs to check email
      throw new Error(
        "Account created! Please check your email and click the confirmation link to activate your account."
      )
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

