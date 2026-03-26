"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { notificationsApi, type NotificationItem } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial } from "@/hooks/useTutorial";
import { NOTIFICATIONS_STEPS } from "@/lib/tutorial-steps";

function formatCurrency(cents: unknown): string {
  if (typeof cents !== "number") return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatSignedCurrency(cents: unknown): string {
  if (typeof cents !== "number") return "-";
  const sign = cents > 0 ? "+" : "";
  return `${sign}$${(cents / 100).toFixed(2)}`;
}

function renderSummary(notification: NotificationItem): ReactNode {
  const payload = notification.payload;

  if (notification.eventType === "limit_order_filled") {
    return (
      <>
        <span className="font-medium text-foreground/90">
          {String(payload.grossShares ?? "-")} shares
        </span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span>Total {formatCurrency(payload.totalCostCents)}</span>
      </>
    );
  }

  if (notification.eventType === "position_market_settled") {
    const pnlCents =
      typeof payload.totalPnlCents === "number" ? payload.totalPnlCents : null;
    const pnlClass =
      pnlCents === null
        ? "text-muted-foreground"
        : pnlCents >= 0
          ? "text-success"
          : "text-destructive";

    return (
      <>
        <span className="text-muted-foreground">PnL</span>
        <span className={`ml-1 font-semibold ${pnlClass}`}>
          {formatSignedCurrency(payload.totalPnlCents)}
        </span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span>Payout {formatCurrency(payload.totalPayoutCents)}</span>
      </>
    );
  }

  if (notification.eventType === "market_maker_market_settled") {
    const netPnl =
      typeof payload.netPnlCents === "number"
        ? payload.netPnlCents
        : typeof payload.totalRevenueCents === "number" &&
            typeof payload.totalPayoutCents === "number"
          ? payload.totalRevenueCents - payload.totalPayoutCents
          : null;
    const netClass =
      netPnl === null
        ? "text-muted-foreground"
        : netPnl >= 0
          ? "text-success"
          : "text-destructive";

    return (
      <>
        <span>Revenue {formatCurrency(payload.totalRevenueCents)}</span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span>Payout {formatCurrency(payload.totalPayoutCents)}</span>
        <span className="mx-2 text-muted-foreground">•</span>
        <span className={`font-semibold ${netClass}`}>
          Net {formatSignedCurrency(netPnl)}
        </span>
      </>
    );
  }

  if (notification.eventType === "admin_market_overdue_closed") {
    return String(payload.actionRequired ?? "Settlement required");
  }

  return "";
}

function getMarketId(notification: NotificationItem): string | null {
  const marketId = notification.payload.marketId;
  return typeof marketId === "string" && marketId.length > 0 ? marketId : null;
}

function formatTimestamp(iso: string): string {
  const dt = new Date(iso);
  const now = Date.now();
  const diffMs = now - dt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return dt.toLocaleString();
}

function eventLabel(eventType: NotificationItem["eventType"]): string {
  if (eventType === "limit_order_filled") return "Order";
  if (eventType === "position_market_settled") return "Settlement";
  if (eventType === "market_maker_market_settled") return "Maker";
  if (eventType === "market_maker_market_status_updated") return "Status";
  if (eventType === "admin_market_overdue_closed") return "Admin";
  return "Update";
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"unread" | "read">("unread");
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [animatingReadIds, setAnimatingReadIds] = useState<Set<string>>(
    new Set(),
  );
  const [mounted, setMounted] = useState(false);

  const notificationsTutorial = useTutorial({
    steps: NOTIFICATIONS_STEPS,
    lessonKey: "notifications",
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !loading && user) {
      const tutorialMode = searchParams?.get("tutorial");
      if (tutorialMode === "notifications") notificationsTutorial.start();
    }
  }, [mounted, loading, user, searchParams]);

  const load = async () => {
    setLoading(true);
    try {
      const response = await notificationsApi.listNotifications({ limit: 100 });
      setItems(response.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [user]);

  const markRead = async (notificationId: string) => {
    setAnimatingReadIds((prev) => new Set(prev).add(notificationId));

    try {
      await notificationsApi.markRead(notificationId);
      window.setTimeout(() => {
        setItems((prev) =>
          prev.map((item) =>
            item.id === notificationId ? { ...item, isRead: true } : item,
          ),
        );
        setAnimatingReadIds((prev) => {
          const next = new Set(prev);
          next.delete(notificationId);
          return next;
        });
      }, 280);
    } catch {
      setAnimatingReadIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const markAllRead = async () => {
    const unreadIds = items
      .filter((item) => !item.isRead)
      .map((item) => item.id);
    if (unreadIds.length === 0) return;

    setAnimatingReadIds((prev) => {
      const next = new Set(prev);
      unreadIds.forEach((id) => next.add(id));
      return next;
    });

    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      window.setTimeout(() => {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setAnimatingReadIds((prev) => {
          const next = new Set(prev);
          unreadIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 280);
    } catch {
      setAnimatingReadIds((prev) => {
        const next = new Set(prev);
        unreadIds.forEach((id) => next.delete(id));
        return next;
      });
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadItems = items.filter((item) => !item.isRead);
  const readItems = items.filter((item) => item.isRead);

  const renderNotificationCards = (list: NotificationItem[]) => {
    if (loading) {
      return (
        <Card className="p-6 text-muted-foreground">
          Loading notifications...
        </Card>
      );
    }

    if (list.length === 0) {
      return (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {activeTab === "unread"
              ? "No unread notifications."
              : "No read notifications yet."}
          </p>
        </Card>
      );
    }

    return list.map((item) => {
      const marketId = getMarketId(item);
      const isAnimatingRead = animatingReadIds.has(item.id);

      return (
        <Card
          key={item.id}
          className={`p-4 md:p-5 transition-all duration-300 ease-out ${
            isAnimatingRead
              ? "opacity-0 -translate-y-1 scale-[0.98]"
              : "opacity-100"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {eventLabel(item.eventType)}
                </span>
                {!item.isRead && (
                  <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                )}
              </div>

              <p className="mt-2 font-semibold leading-snug">{item.title}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {item.body}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{renderSummary(item)}</span>
                <span>{formatTimestamp(item.createdAt)}</span>
              </div>

              {marketId && (
                <div className="mt-3">
                  <Link
                    href={`/market/${marketId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View market
                  </Link>
                </div>
              )}
            </div>

            {!item.isRead && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => markRead(item.id)}
              >
                Mark read
              </Button>
            )}
          </div>
        </Card>
      );
    });
  };

  if (!user) {
    return (
      <main className="container mx-auto px-4 py-10">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to view notifications.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <TutorialOverlay steps={NOTIFICATIONS_STEPS} currentStep={notificationsTutorial.currentStep} isActive={notificationsTutorial.isActive} elementRect={notificationsTutorial.elementRect} onNext={notificationsTutorial.next} onClose={notificationsTutorial.close} />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between" id="notifications-title">
        <div>
          <h1 className="text-3xl font-bold text-balance flex items-center gap-2">
            <Bell className="w-7 h-7" /> Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Activity from orders, settlements, and admin actions.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={markAllRead}
          disabled={markingAll || items.length === 0}
          id="notifications-mark-all"
        >
          {markingAll ? "Marking..." : "Mark all read"}
        </Button>
      </div>

      <section className="mt-5 space-y-3" id="notifications-tabs">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "read" | "unread")}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="unread">
              Unread
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                {unreadItems.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="read">
              Read
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                {readItems.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unread" className="space-y-3 mt-3">
            {renderNotificationCards(unreadItems)}
          </TabsContent>

          <TabsContent value="read" className="space-y-3 mt-3">
            {renderNotificationCards(readItems)}
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}
