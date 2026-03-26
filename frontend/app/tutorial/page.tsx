"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  TrendingUp,
  Wallet,
  Users,
  CheckCircle2,
  Trophy,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import {
  useTutorial,
  getAllTutorialCompletions,
  areAllTutorialsComplete,
} from "@/hooks/useTutorial";
import { PLATFORM_OVERVIEW_STEPS } from "@/lib/tutorial-steps";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useCallback, useRef } from "react";
import { marketsApi } from "@/lib/api";
import { toast } from "sonner";
import confetti from "canvas-confetti";

type LessonKey =
  | "platform-overview"
  | "user-profile"
  | "understanding-pnl"
  | "understanding-dashboard"
  | "first-trade"
  | "market-limit-orders"
  | "prices-probabilities"
  | "managing-orders"
  | "holdings-positions"
  | "collateral"
  | "settled-positions"
  | "comments-reactions"
  | "leaderboard"
  | "notifications"
  | "market-making";

interface Lesson {
  title: string;
  duration: string;
  lessonKey: LessonKey;
  isInteractive: true;
  requiresAuth?: boolean;
  requiresMarketMaker?: boolean;
}

const TUTORIAL_SECTIONS = [
  {
    id: 1,
    title: "Getting Started",
    icon: BookOpen,
    color: "text-primary",
    lessons: [
      {
        title: "Platform Overview",
        duration: "2 min",
        lessonKey: "platform-overview" as LessonKey,
        isInteractive: true as const,
      },
      {
        title: "Understanding the Dashboard",
        duration: "2 min",
        lessonKey: "understanding-dashboard" as LessonKey,
        isInteractive: true as const,
      },
      {
        title: "User Profile",
        duration: "3 min",
        lessonKey: "user-profile" as LessonKey,
        isInteractive: true as const,
        requiresAuth: true,
      },
      {
        title: "Understanding P&L",
        duration: "2 min",
        lessonKey: "understanding-pnl" as LessonKey,
        isInteractive: true as const,
        requiresAuth: true,
      },
    ],
  },
  {
    id: 2,
    title: "Trading",
    icon: TrendingUp,
    color: "text-secondary",
    lessons: [
      {
        title: "Placing Your First Trade",
        duration: "2 min",
        lessonKey: "first-trade" as LessonKey,
        isInteractive: true as const,
      },
      {
        title: "Market vs Limit Orders",
        duration: "2 min",
        lessonKey: "market-limit-orders" as LessonKey,
        isInteractive: true as const,
      },
      {
        title: "Understanding Prices & Probabilities",
        duration: "2 min",
        lessonKey: "prices-probabilities" as LessonKey,
        isInteractive: true as const,
      },
      {
        title: "Managing Your Orders",
        duration: "2 min",
        lessonKey: "managing-orders" as LessonKey,
        isInteractive: true as const,
        requiresAuth: true,
      },
    ],
  },
  {
    id: 3,
    title: "Portfolio & Risk",
    icon: Wallet,
    color: "text-success",
    lessons: [
      {
        title: "Your Holdings & Positions",
        duration: "2 min",
        lessonKey: "holdings-positions" as LessonKey,
        isInteractive: true as const,
        requiresAuth: true,
      },
      {
        title: "Understanding Collateral",
        duration: "2 min",
        lessonKey: "collateral" as LessonKey,
        isInteractive: true as const,
        requiresAuth: true,
      },
      {
        title: "Settled Positions & Payouts",
        duration: "2 min",
        lessonKey: "settled-positions" as LessonKey,
        isInteractive: true as const,
        requiresAuth: true,
      },
    ],
  },
  {
    id: 4,
    title: "Community & Platform",
    icon: Users,
    color: "text-accent",
    lessons: [
      {
        title: "Market Comments",
        duration: "2 min",
        lessonKey: "comments-reactions" as LessonKey,
        isInteractive: true as const,
      },
      {
        title: "Leaderboard",
        duration: "1 min",
        lessonKey: "leaderboard" as LessonKey,
        isInteractive: true as const,
      },
      {
        title: "Notifications",
        duration: "1 min",
        lessonKey: "notifications" as LessonKey,
        isInteractive: true as const,
        requiresAuth: true,
      },
      {
        title: "Market Making Overview",
        duration: "2 min",
        lessonKey: "market-making" as LessonKey,
        isInteractive: true as const,
        requiresMarketMaker: true,
      },
    ],
  },
];

const MARKET_PAGE_TUTORIALS: Set<LessonKey> = new Set([
  "first-trade",
  "market-limit-orders",
  "prices-probabilities",
  "comments-reactions",
]);

export default function TutorialPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [firstOpenMarketId, setFirstOpenMarketId] = useState<string | null>(
    null,
  );

  const platformTutorial = useTutorial({
    steps: PLATFORM_OVERVIEW_STEPS,
    lessonKey: "platform-overview",
  });

  const [showCongrats, setShowCongrats] = useState(false);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    marketsApi
      .listMarkets({ status: "open" })
      .then((res) => {
        if (res.items.length > 0) setFirstOpenMarketId(res.items[0].id);
      })
      .catch(() => {});
  }, []);

  const isMarketMaker = profile?.role === "market_maker";
  const visibleSections = TUTORIAL_SECTIONS.map((section) => ({
    ...section,
    lessons: section.lessons.filter(
      (l) => !l.requiresMarketMaker || isMarketMaker,
    ),
  })).filter((section) => section.lessons.length > 0);

  const totalLessons = visibleSections.reduce(
    (acc, section) => acc + section.lessons.length,
    0,
  );

  const completions = mounted ? getAllTutorialCompletions(profile) : {};

  const completedLessons = visibleSections.reduce(
    (acc, section) =>
      acc +
      section.lessons.filter((l) => completions[l.lessonKey] === true).length,
    0,
  );
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);
  const allComplete =
    mounted && completedLessons === totalLessons && totalLessons > 0;

  const CONGRATS_SHOWN_KEY = "tempora_tutorial_congrats_shown";

  useEffect(() => {
    if (!allComplete) return;
    try {
      const alreadyShown = localStorage.getItem(CONGRATS_SHOWN_KEY);
      if (alreadyShown) return;
      setShowCongrats(true);
      localStorage.setItem(CONGRATS_SHOWN_KEY, "true");
    } catch {}
  }, [allComplete]);

  const fireConfetti = useCallback(() => {
    if (confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    const duration = 2500;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#10b981", "#059669", "#34d399", "#6ee7b7", "#a7f3d0"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#10b981", "#059669", "#34d399", "#6ee7b7", "#a7f3d0"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: [
        "#10b981",
        "#059669",
        "#34d399",
        "#6ee7b7",
        "#a7f3d0",
        "#fbbf24",
        "#f59e0b",
      ],
    });

    requestAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (showCongrats) {
      const timer = setTimeout(fireConfetti, 300);
      return () => clearTimeout(timer);
    }
  }, [showCongrats, fireConfetti]);

  const handleStartTutorial = (lessonKey: LessonKey) => {
    if (lessonKey === "platform-overview") {
      platformTutorial.start();
      return;
    }

    if (MARKET_PAGE_TUTORIALS.has(lessonKey)) {
      if (!firstOpenMarketId) {
        toast.error("No open markets available. Try again later.");
        return;
      }
      router.push(`/market/${firstOpenMarketId}?tutorial=${lessonKey}`);
      return;
    }

    const routeMap: Partial<Record<LessonKey, string>> = {
      "understanding-dashboard": "/?tutorial=understanding-dashboard",
      "user-profile": "/profile?tutorial=user-profile",
      "understanding-pnl": "/portfolio?tutorial=understanding-pnl",
      "managing-orders": "/portfolio?tutorial=managing-orders",
      "holdings-positions": "/portfolio?tutorial=holdings-positions",
      collateral: "/portfolio?tutorial=collateral",
      "settled-positions": "/portfolio?tutorial=settled-positions",
      leaderboard: "/leaderboard?tutorial=leaderboard",
      notifications: "/notifications?tutorial=notifications",
      "market-making": "/market-making?tutorial=market-making",
    };

    const route = routeMap[lessonKey];
    if (route) router.push(route);
  };

  const canStartLesson = (
    lesson: (typeof TUTORIAL_SECTIONS)[0]["lessons"][0],
  ) => {
    if (lesson.requiresAuth && !profile) return false;
    return true;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <TutorialOverlay
        steps={PLATFORM_OVERVIEW_STEPS}
        currentStep={platformTutorial.currentStep}
        isActive={platformTutorial.isActive}
        elementRect={platformTutorial.elementRect}
        onNext={platformTutorial.next}
        onClose={platformTutorial.close}
      />

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-primary" /> Trading Tutorials
            </h1>
            <p className="text-muted-foreground mt-1">
              Interactive guides for every feature on the platform
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{totalLessons} Lessons</Badge>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-r from-primary/14 via-primary/8 to-secondary/14 border-border/70">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Your Progress</div>
            <div className="text-sm text-muted-foreground">
              {completedLessons} of {totalLessons} lessons
            </div>
          </div>
          <div className="w-full bg-muted/80 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-primary to-secondary h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-right mt-1 text-sm font-semibold text-primary">
            {progressPercent}% Complete
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          const sectionCompleted = section.lessons.filter(
            (l) => completions[l.lessonKey] === true,
          ).length;
          const sectionTotal = section.lessons.length;

          return (
            <Card key={section.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-lg bg-muted/70 ${section.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{section.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {sectionCompleted} / {sectionTotal} lessons completed
                    </p>
                  </div>
                </div>
                {sectionCompleted === sectionTotal && (
                  <Badge className="bg-primary text-primary-foreground">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {section.lessons.map((lesson, idx) => {
                  const isCompleted = completions[lesson.lessonKey] === true;
                  const canStart = canStartLesson(lesson);
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg transition-colors duration-200 ${
                        isCompleted
                          ? "bg-primary/10 hover:bg-primary/14"
                          : "bg-muted/50 hover:bg-muted/70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/35 flex-shrink-0" />
                          )}
                          <div>
                            <div
                              className={`font-medium ${isCompleted ? "text-primary" : ""}`}
                            >
                              {lesson.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {lesson.duration}
                              {lesson.requiresAuth &&
                                !profile &&
                                " · Sign in required"}
                            </div>
                          </div>
                        </div>
                        <button
                          className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer ${
                            canStart
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          }`}
                          disabled={!canStart}
                          onClick={() => {
                            if (canStart) handleStartTutorial(lesson.lessonKey);
                          }}
                        >
                          {isCompleted ? "Review" : "Start"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {showCongrats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setShowCongrats(false)}
              className="absolute top-4 right-4 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-primary" />
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-2">Congratulations!</h2>
            <p className="text-muted-foreground mb-6">
              You&apos;ve completed all the tutorials. You&apos;re ready to
              trade like a pro. You can always revisit tutorials from your
              profile dropdown menu.
            </p>

            <button
              onClick={() => setShowCongrats(false)}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Let&apos;s Go!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
