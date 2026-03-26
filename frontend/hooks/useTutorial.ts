import { useState, useEffect } from "react";
import type { TutorialStep } from "@/components/tutorial-overlay";
import { usersApi, type UserProfile } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const LOCAL_TUTORIAL_KEY = "tempora_tutorial_completions";

// Get tutorial completions from localStorage
function getLocalCompletions(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(LOCAL_TUTORIAL_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

// Save tutorial completion to localStorage
function setLocalCompletion(lessonKey: string, completed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const completions = getLocalCompletions();
    completions[lessonKey] = completed;
    localStorage.setItem(LOCAL_TUTORIAL_KEY, JSON.stringify(completions));
  } catch (error) {
    console.error("Failed to save tutorial completion:", error);
  }
}

interface UseTutorialOptions {
  steps: TutorialStep[];
  lessonKey: string; // Unique key to track this lesson's completion
  autoStart?: boolean;
  onComplete?: () => void;
}

export function useTutorial({
  steps,
  lessonKey,
  autoStart = false,
  onComplete,
}: UseTutorialOptions) {
  const { profile, refreshProfile } = useAuth();
  const [isActive, setIsActive] = useState(autoStart);
  const [currentStep, setCurrentStep] = useState(0);
  const [elementRect, setElementRect] = useState<DOMRect | null>(null);

  const currentStepData = steps[currentStep];

  // Check if this lesson is already completed
  // Use profile completions if available, otherwise fall back to localStorage
  const isCompleted = lessonKey
    ? profile
      ? profile.tutorialCompletions?.[lessonKey] === true
      : getLocalCompletions()[lessonKey] === true
    : false;

  // Update element rect whenever tutorial step changes
  useEffect(() => {
    if (isActive && currentStepData) {
      const element = document.getElementById(currentStepData.elementId);
      if (element) {
        setElementRect(element.getBoundingClientRect());

        // Handle window resize and scroll
        const updateRect = () => {
          const el = document.getElementById(currentStepData.elementId);
          if (el) {
            setElementRect(el.getBoundingClientRect());
          }
        };

        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect);

        return () => {
          window.removeEventListener("resize", updateRect);
          window.removeEventListener("scroll", updateRect);
        };
      }
    } else {
      setElementRect(null);
    }
  }, [isActive, currentStep, currentStepData]);

  const start = () => {
    setIsActive(true);
    setCurrentStep(0);
  };

  const next = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await close(true);
      onComplete?.();
    }
  };

  const close = async (completed: boolean = false) => {
    setIsActive(false);
    setCurrentStep(0);
    setElementRect(null);

    // Mark as completed if tutorial was completed and not already marked
    if (completed && lessonKey && !isCompleted) {
      if (profile) {
        // User is authenticated - save to backend
        try {
          await usersApi.updateTutorialCompletion(lessonKey, true);
          await refreshProfile();
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save tutorial progress",
          );
        }
      } else {
        // User is not authenticated - save to localStorage
        setLocalCompletion(lessonKey, true);
      }
    }
  };

  const goToStep = (step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  };

  return {
    isActive,
    currentStep,
    elementRect,
    isCompleted,
    start,
    next,
    close: () => close(false),
    goToStep,
  };
}

// All lesson keys that regular users see (excludes market-maker-only lessons)
export const REGULAR_LESSON_KEYS = [
  "platform-overview",
  "understanding-dashboard",
  "user-profile",
  "understanding-pnl",
  "first-trade",
  "market-limit-orders",
  "prices-probabilities",
  "managing-orders",
  "holdings-positions",
  "collateral",
  "settled-positions",
  "comments-reactions",
  "leaderboard",
  "notifications",
] as const;

export const MARKET_MAKER_LESSON_KEYS = ["market-making"] as const;

export function areAllTutorialsComplete(
  profile: UserProfile | null,
  isMarketMaker: boolean = false,
): boolean {
  const completions = getAllTutorialCompletions(profile);
  const keys: readonly string[] = isMarketMaker
    ? [...REGULAR_LESSON_KEYS, ...MARKET_MAKER_LESSON_KEYS]
    : REGULAR_LESSON_KEYS;
  return keys.every((key) => completions[key] === true);
}

// Export helper to get all completions (for migration or display)
export function getAllTutorialCompletions(
  profile: UserProfile | null,
): Record<string, boolean> {
  if (profile?.tutorialCompletions) {
    return profile.tutorialCompletions;
  }
  return getLocalCompletions();
}

// Export helper to migrate local completions to profile
export async function migrateLocalCompletions(
  refreshProfile: () => Promise<UserProfile | null>,
): Promise<void> {
  const localCompletions = getLocalCompletions();
  const completionKeys = Object.keys(localCompletions).filter(
    (key) => localCompletions[key],
  );

  if (completionKeys.length === 0) return;

  try {
    // Upload all local completions to the backend
    for (const key of completionKeys) {
      await usersApi.updateTutorialCompletion(key, true);
    }

    // Refresh profile to get updated data
    await refreshProfile();

    // Clear localStorage after successful migration
    localStorage.removeItem(LOCAL_TUTORIAL_KEY);
  } catch (error) {
    console.error("Failed to migrate tutorial completions:", error);
  }
}
