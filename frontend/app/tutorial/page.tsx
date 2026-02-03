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
    color: "text-blue-500",
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
    color: "text-green-500",
    lessons: [
      {
        title: "Market Orders vs Limit Orders",
        duration: "12 min",
        lessonKey: "market-limit-orders",
      },
      {
        title: "Reading Price Charts",
        duration: "15 min",
        lessonKey: "reading-charts",
      },
      {
        title: "Understanding Bid-Ask Spread",
        duration: "8 min",
        lessonKey: "bid-ask-spread",
      },
      {
        title: "Position Sizing Fundamentals",
        duration: "10 min",
        lessonKey: "position-sizing",
      },
    ],
  },
  {
    id: 3,
    title: "Risk Management",
    icon: Shield,
    color: "text-yellow-500",
    lessons: [
      {
        title: "Setting Stop Losses",
        duration: "10 min",
        lessonKey: "stop-losses",
      },
      {
        title: "Portfolio Diversification",
        duration: "12 min",
        lessonKey: "diversification",
      },
      {
        title: "Risk-Reward Ratios",
        duration: "14 min",
        lessonKey: "risk-reward",
      },
      {
        title: "Managing Leverage",
        duration: "16 min",
        lessonKey: "leverage",
      },
    ],
  },
  {
    id: 4,
    title: "Community & Social",
    icon: Users,
    color: "text-cyan-500",
    lessons: [
      {
        title: "Following Top Traders",
        duration: "8 min",
        lessonKey: "follow-traders",
      },
      {
        title: "Sharing Trade Ideas",
        duration: "10 min",
        lessonKey: "share-ideas",
      },
      {
        title: "Understanding Leaderboards",
        duration: "7 min",
        lessonKey: "leaderboards",
      },
      {
        title: "Copy Trading Features",
        duration: "12 min",
        lessonKey: "copy-trading",
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
              <BookOpen className="w-7 h-7 text-blue-500" /> Trading Tutorials
            </h1>
            <p className="text-muted-foreground mt-1">
              Master trading from basics to advanced strategies
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">16 Lessons</Badge>
          </div>
        </div>

        <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Your Progress</div>
            <div className="text-sm text-muted-foreground">
              {completedLessons} of {totalLessons} lessons
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-right mt-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
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
            <Card
              key={section.id}
              className="p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-800 ${section.color}`}
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
                  <Badge className="bg-green-500">
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
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        isCompleted
                          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                          : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                          )}
                          <div>
                            <div
                              className={`font-medium ${isCompleted ? "text-green-700 dark:text-green-400" : ""}`}
                            >
                              {lesson.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {lesson.duration}
                            </div>
                          </div>
                        </div>
                        <button
                          className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                          onClick={() => {
                            if (lesson.isInteractive) {
                              if (lesson.lessonKey == "user-profile") {
                                if (profile) {
                                  handleStartTutorial(lesson.lessonKey);
                                }
                              } else {
                                handleStartTutorial(lesson.lessonKey);
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
