"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TrendingUp, User } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { AuthDialog } from "@/components/auth-dialog"

export function Header() {
  const { user, signOut, loading } = useAuth()
  const [authDialogOpen, setAuthDialogOpen] = useState(false)

  return (
    <>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
                <TrendingUp className="w-6 h-6" />
              </div>
              <a href="/" className="text-xl font-bold hover:opacity-90">
                tempora
              </a>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="/" className="text-sm font-medium hover:text-primary transition-colors">
                Markets
              </a>
              <a href="/portfolio" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Portfolio
              </a>
              <a href="/leaderboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Leaderboard
              </a>
            </nav>
            <div className="flex items-center gap-3">
              {loading ? (
                <div className="w-20 h-8" />
              ) : user ? (
                <>
                  <span className="text-sm text-muted-foreground hidden sm:inline-flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {user.email}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setAuthDialogOpen(true)}>
                    Sign In
                  </Button>
                  <Button size="sm" onClick={() => setAuthDialogOpen(true)}>
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </>
  )
}
