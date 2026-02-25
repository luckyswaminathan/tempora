"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthDialog } from "@/components/auth-dialog";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  return (
    <>
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-foreground">
                <svg
                  viewBox="1 0.5 30 27"
                  className="w-6 h-6"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="1.5"
                    y="23.4"
                    width="3"
                    height="3.6"
                    rx="0.8"
                    fill="white"
                    opacity="0.5"
                  />
                  <rect
                    x="4.75"
                    y="19.8"
                    width="3"
                    height="7.2"
                    rx="0.8"
                    fill="white"
                    opacity="0.62"
                  />
                  <rect
                    x="8.0"
                    y="15"
                    width="3"
                    height="12"
                    rx="0.8"
                    fill="white"
                    opacity="0.75"
                  />
                  <rect
                    x="11.25"
                    y="7.8"
                    width="3"
                    height="19.2"
                    rx="0.8"
                    fill="white"
                    opacity="0.88"
                  />
                  <rect
                    x="14.5"
                    y="1"
                    width="3"
                    height="26"
                    rx="0.8"
                    fill="white"
                    opacity="1"
                  />
                  <rect
                    x="17.75"
                    y="7.8"
                    width="3"
                    height="19.2"
                    rx="0.8"
                    fill="white"
                    opacity="0.88"
                  />
                  <rect
                    x="21.0"
                    y="15"
                    width="3"
                    height="12"
                    rx="0.8"
                    fill="white"
                    opacity="0.75"
                  />
                  <rect
                    x="24.25"
                    y="19.8"
                    width="3"
                    height="7.2"
                    rx="0.8"
                    fill="white"
                    opacity="0.62"
                  />
                  <rect
                    x="27.5"
                    y="23.4"
                    width="3"
                    height="3.6"
                    rx="0.8"
                    fill="white"
                    opacity="0.5"
                  />
                </svg>
              </div>
              <a
                id="logo-tempora"
                href="/"
                className="text-xl font-bold hover:opacity-90"
              >
                tempora
              </a>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a
                id="nav-markets"
                href="/"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Markets
              </a>
              <a
                id="nav-portfolio"
                href="/portfolio"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Portfolio
              </a>
              <a
                id="nav-leaderboard"
                href="/leaderboard"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Leaderboard
              </a>
              <a
                id="nav-tutorial"
                href="/tutorial"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Tutorial
              </a>
              {user?.role === "market_maker" && (
                <a
                  id="nav-market-making"
                  href="/market-making"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Market Making
                </a>
              )}
              {user?.role === "admin" && (
                <a
                  id="nav-admin"
                  href="/admin"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Admin
                </a>
              )}
            </nav>
            <div className="flex items-center gap-3">
              {profile ? (
                <>
                  <a
                    href="/profile"
                    className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                    id="nav-profile"
                  >
                    <User className="w-4 h-4" />
                    <span>
                      {profile.displayName
                        ? profile.displayName
                        : profile.email}
                    </span>
                  </a>
                  <a
                    href="/profile"
                    className="sm:hidden p-2 rounded-md hover:bg-muted transition-colors"
                    id="nav-profile"
                  >
                    <User className="w-5 h-5" />
                  </a>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthDialogOpen(true);
                    }}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAuthMode("register");
                      setAuthDialogOpen(true);
                    }}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        defaultMode={authMode}
      />
    </>
  );
}
