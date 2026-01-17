"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  TrendingUp,
  Shield,
  LineChart,
  Zap,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
        completed: true,
        isInteractive: true,
      },
      {
        title: "Account Setup & Verification",
        duration: "8 min",
        completed: true,
      },
      {
        title: "Understanding P&L",
        duration: "2 min",
        completed: true,
        isInteractive: true,
      },
      {
        title: "Understanding the Dashboard",
        duration: "2 min",
        completed: false,
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
        completed: false,
      },
      { title: "Reading Price Charts", duration: "15 min", completed: false },
      {
        title: "Understanding Bid-Ask Spread",
        duration: "8 min",
        completed: false,
      },
      {
        title: "Position Sizing Fundamentals",
        duration: "10 min",
        completed: false,
      },
    ],
  },
  {
    id: 3,
    title: "Risk Management",
    icon: Shield,
    color: "text-yellow-500",
    lessons: [
      { title: "Setting Stop Losses", duration: "10 min", completed: false },
      {
        title: "Portfolio Diversification",
        duration: "12 min",
        completed: false,
      },
      { title: "Risk-Reward Ratios", duration: "14 min", completed: false },
      { title: "Managing Leverage", duration: "16 min", completed: false },
    ],
  },
  {
    id: 4,
    title: "Community & Social",
    icon: Users,
    color: "text-cyan-500",
    lessons: [
      { title: "Following Top Traders", duration: "8 min", completed: false },
      { title: "Sharing Trade Ideas", duration: "10 min", completed: false },
      {
        title: "Understanding Leaderboards",
        duration: "7 min",
        completed: false,
      },
      { title: "Copy Trading Features", duration: "12 min", completed: false },
    ],
  },
];

const PLATFORM_OVERVIEW_STEPS = [
  {
    id: 1,
    elementId: "logo-tempora",
    title: "Welcome to Tempora",
    description:
      "This is your trading platform. You can click the logo to return to the main markets page at any time.",
  },
  {
    id: 2,
    elementId: "nav-markets",
    title: "Markets",
    description:
      "Browse and trade on various prediction markets. Track price movements and place your bets here.",
  },
  {
    id: 3,
    elementId: "nav-portfolio",
    title: "Your Portfolio",
    description:
      "View all your active trades, historical performance, and manage your positions.",
  },
  {
    id: 4,
    elementId: "nav-leaderboard",
    title: "Leaderboard",
    description:
      "See how you rank against other traders. Check top performers and compete on the rankings.",
  },
  {
    id: 5,
    elementId: "nav-tutorial",
    title: "Learning Resources",
    description:
      "Access tutorials and guides to improve your trading skills and knowledge.",
  },
];

const UNDERSTANDING_PNL_STEPS = [
  {
    id: 1,
    elementId: "pnl-cost-basis",
    title: "Cost Basis",
    description:
      "This is the total amount you paid to acquire your positions. It's the sum of all your initial investments in the current holdings.",
  },
  {
    id: 2,
    elementId: "pnl-market-value",
    title: "Market Value",
    description:
      "The current value of all your positions at today's market prices. This changes throughout the day as market prices move.",
  },
  {
    id: 3,
    elementId: "pnl-unrealized",
    title: "Profit & Loss (P&L)",
    description:
      "The difference between your market value and cost basis. Green means you're making money, red means you're losing money. This is unrealized - it's the profit/loss if you close all positions now.",
  },
  {
    id: 4,
    elementId: "pnl-roi",
    title: "Return on Investment (ROI)",
    description:
      "Your P&L expressed as a percentage of your initial investment. This shows your return efficiency. For example, 10% ROI means you've made 10% profit on your initial investment.",
  },
];

export default function TutorialPage() {
  const router = useRouter();
  const [tutorialActive, setTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTutorial, setActiveTutorial] = useState<
    "platform-overview" | "understanding-pnl" | null
  >(null);

  const totalLessons = TUTORIAL_SECTIONS.reduce(
    (acc, section) => acc + section.lessons.length,
    0,
  );
  const completedLessons = TUTORIAL_SECTIONS.reduce(
    (acc, section) => acc + section.lessons.filter((l) => l.completed).length,
    0,
  );
  const progressPercent = Math.round((completedLessons / totalLessons) * 100);

  const handleStartTutorial = (
    tutorialType: "platform-overview" | "understanding-pnl",
  ) => {
    setCurrentStep(0);
    setActiveTutorial(tutorialType);

    if (tutorialType === "understanding-pnl") {
      router.push("/portfolio?tutorial=understanding-pnl");
    } else {
      setTutorialActive(true);
    }
  };

  const handleNextStep = () => {
    if (currentStep < UNDERSTANDING_PNL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setTutorialActive(false);
      setActiveTutorial(null);
    }
  };

  const handleCloseTutorial = () => {
    setTutorialActive(false);
    setActiveTutorial(null);
  };

  const tutorialSteps =
    activeTutorial === "platform-overview"
      ? PLATFORM_OVERVIEW_STEPS
      : UNDERSTANDING_PNL_STEPS;
  const currentStepData = tutorialSteps[currentStep];
  const targetElement = tutorialActive
    ? document.getElementById(currentStepData?.elementId || "")
    : null;
  const rect = targetElement?.getBoundingClientRect();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Tutorial Overlay */}
      {tutorialActive && (
        <>
          {/* Fade overlay */}
          <div
            className="fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
            onClick={handleCloseTutorial}
          />

          {/* Highlight and tooltip */}
          {rect && (
            <>
              {/* Highlighted element border */}
              <div
                className="fixed z-50 pointer-events-none border-2 border-yellow-400 rounded-lg shadow-lg"
                style={{
                  top: `${rect.top - 4}px`,
                  left: `${rect.left - 4}px`,
                  width: `${rect.width + 8}px`,
                  height: `${rect.height + 8}px`,
                  boxShadow: "0 0 20px rgba(250, 204, 21, 0.6)",
                }}
              />

              {/* Tooltip */}
              <div
                className="fixed z-50 bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 w-96 border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-300"
                style={{
                  top: `${Math.min(
                    rect.bottom + 20,
                    window.innerHeight - 300,
                  )}px`,
                  left: `${Math.max(
                    Math.min(
                      rect.left + rect.width / 2 - 192,
                      window.innerWidth - 400,
                    ),
                    16,
                  )}px`,
                }}
              >
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {currentStepData?.title}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                    {currentStepData?.description}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-6">
                  <div className="text-xs text-gray-500">
                    Step {currentStep + 1} of {tutorialSteps.length}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseTutorial}
                    >
                      Skip
                    </Button>
                    <Button size="sm" onClick={handleNextStep}>
                      {currentStep === tutorialSteps.length - 1 ? "Done" : "OK"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Main content */}
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
            (l) => l.completed,
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
                {section.lessons.map((lesson, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      lesson.completed
                        ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {lesson.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
                        )}
                        <div>
                          <div
                            className={`font-medium ${lesson.completed ? "text-green-700 dark:text-green-400" : ""}`}
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
                            if (lesson.title === "Platform Overview") {
                              handleStartTutorial("platform-overview");
                            } else if (lesson.title === "Understanding P&L") {
                              handleStartTutorial("understanding-pnl");
                            }
                          }
                        }}
                      >
                        {lesson.completed ? "Review" : "Start"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
