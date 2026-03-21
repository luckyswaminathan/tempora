"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  TrendingUp,
  Shield,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { useTutorial, getAllTutorialCompletions } from "@/hooks/useTutorial";
import { PLATFORM_OVERVIEW_STEPS } from "@/lib/tutorial-steps";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";

const TUTORIAL_SECTIONS = [
  {
    id: 1,
    title: "Getting Started",
    icon: BookOpen,
    color: "text-primary",
    lessons: [
      {
        title: "Platform Overview",
        duration: "6 min",
        lessonKey: "platform-overview",
        isInteractive: true,
      },
      {
        title: "User Profile",
        duration: "8 min",
        lessonKey: "user-profile",
        isInteractive: true,
      },
      {
        title: "Understanding P&L",
        duration: "2 min",
        lessonKey: "understanding-pnl",
        isInteractive: true,
      },
      {
        title: "Understanding the Dashboard",
        duration: "2 min",
        lessonKey: "understanding-dashboard",
        isInteractive: true,
      },
    ],
  },
  {
    id: 2,
    title: "Trading Basics",
    icon: TrendingUp,
    color: "text-secondary",
    lessons: [
      {
        title: "Market Orders vs Limit Orders",
        duration: "12 min",
        lessonKey: "market-limit-orders",
        isInteractive: false,
      },
      {
        title: "Reading Price Charts",
        duration: "15 min",
        lessonKey: "reading-charts",
        isInteractive: false,
      },
      {
        title: "Understanding Bid-Ask Spread",
        duration: "8 min",
        lessonKey: "bid-ask-spread",
        isInteractive: false,
      },
      {
        title: "Position Sizing Fundamentals",
        duration: "10 min",
        lessonKey: "position-sizing",
        isInteractive: false,
      },
    ],
  },
  {
    id: 3,
    title: "Risk Management",
    icon: Shield,
    color: "text-success",
    lessons: [
      {
        title: "Setting Stop Losses",
        duration: "10 min",
        lessonKey: "stop-losses",
        isInteractive: false,
      },
      {
        title: "Portfolio Diversification",
        duration: "12 min",
        lessonKey: "diversification",
        isInteractive: false,
      },
      {
        title: "Risk-Reward Ratios",
        duration: "14 min",
        lessonKey: "risk-reward",
        isInteractive: false,
      },
      {
        title: "Managing Leverage",
        duration: "16 min",
        lessonKey: "leverage",
        isInteractive: false,
      },
    ],
  },
  {
    id: 4,
    title: "Community & Social",
    icon: Users,
    color: "text-accent",
    lessons: [
      {
        title: "Following Top Traders",
        duration: "8 min",
        lessonKey: "follow-traders",
        isInteractive: false,
      },
      {
        title: "Sharing Trade Ideas",
        duration: "10 min",
        lessonKey: "share-ideas",
        isInteractive: false,
      },
      {
        title: "Understanding Leaderboards",
        duration: "7 min",
        lessonKey: "leaderboards",
        isInteractive: false,
      },
      {
        title: "Copy Trading Features",
        duration: "12 min",
        lessonKey: "copy-trading",
        isInteractive: false,
      },
    ],
  },
];

export default function TutorialPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [mounted, setMounted] = useState(false);

  const platformTutorial = useTutorial({
    steps: PLATFORM_OVERVIEW_STEPS,
    lessonKey: "platform-overview",
  });

  // Ensure component is mounted on client
  useEffect(() => {
    setMounted(true);
  }, []);

  const totalLessons = TUTORIAL_SECTIONS.reduce(
    (acc, section) => acc + section.lessons.length,
    0,
  );

  // Get completions only after mounting to avoid hydration mismatch
  const completions = mounted ? getAllTutorialCompletions(profile) : {};

  const completedLessons = TUTORIAL_SECTIONS.reduce(
    (acc, section) =>
      acc +
      section.lessons.filter((l) => completions[l.lessonKey] === true).length,
    0,
  );
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  const handleStartTutorial = (
    tutorialType:
      | "platform-overview"
      | "user-profile"
      | "understanding-pnl"
      | "understanding-dashboard",
  ) => {
    if (tutorialType === "understanding-pnl") {
      router.push("/portfolio?tutorial=understanding-pnl");
    } else if (tutorialType === "user-profile") {
      router.push("/profile?tutorial=user-profile");
    } else if (tutorialType === "understanding-dashboard") {
      router.push("/?tutorial=understanding-dashboard");
    } else {
      platformTutorial.start();
    }
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
              Master trading from basics to advanced strategies
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">16 Lessons</Badge>
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
        {TUTORIAL_SECTIONS.map((section) => {
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
                            </div>
                          </div>
                        </div>
                        <button
                          className="px-4 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground cursor-pointer"
                          onClick={() => {
                            if (lesson.isInteractive) {
                              const key = lesson.lessonKey as Parameters<
                                typeof handleStartTutorial
                              >[0];
                              if (lesson.lessonKey === "user-profile") {
                                if (profile) {
                                  handleStartTutorial(key);
                                }
                              } else {
                                handleStartTutorial(key);
                              }
                            }
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
    </div>
  );
}
