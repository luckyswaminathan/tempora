"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { AuthDialog } from "@/components/auth-dialog";
import { notificationsApi } from "@/lib/api";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const openProfileMenu = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setProfileMenuOpen(true);
  };

  const closeProfileMenu = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setProfileMenuOpen(false);
      closeTimerRef.current = null;
    }, 120);
  };

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const loadUnreadCount = async () => {
      try {
        const result = await notificationsApi.getUnreadCount();
        if (!cancelled) {
          setUnreadCount(result.unreadCount || 0);
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    };

    loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

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
                    href="/notifications"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                    id="nav-notifications-icon"
                    aria-label="Notifications"
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex min-w-5 h-5 px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </a>

                  <div
                    className="relative"
                    onMouseEnter={openProfileMenu}
                    onMouseLeave={closeProfileMenu}
                  >
                    <button
                      type="button"
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className="hidden sm:flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                      id="nav-profile"
                      aria-label="Profile menu"
                    >
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {profile.displayName
                          ? profile.displayName
                          : profile.email}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>

                    {profileMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                        <div className="px-3.5 py-3 border-b bg-gradient-to-br from-muted/55 via-muted/30 to-card">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {profile.displayName
                              ? profile.displayName
                              : "Profile"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {profile.email}
                          </p>
                        </div>

                        <a
                          href="/profile"
                          className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" />
                          Profile settings
                        </a>

                        <button
                          type="button"
                          onClick={() => signOut()}
                          className="w-full flex items-center gap-2.5 text-left px-3.5 py-2.5 text-sm text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group"
                        >
                          <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                          Sign out
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Keep a mobile-direct profile link for touch-first navigation */}
                  <a
                    href="/profile"
                    className="sm:hidden p-2 rounded-md hover:bg-muted transition-colors"
                    id="nav-profile-mobile"
                  >
                    <User className="w-5 h-5" />
                  </a>
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
