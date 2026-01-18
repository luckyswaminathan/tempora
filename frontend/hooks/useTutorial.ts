import { useState, useEffect } from "react";
import type { TutorialStep } from "@/components/tutorial-overlay";

interface UseTutorialOptions {
  steps: TutorialStep[];
  autoStart?: boolean;
  onComplete?: () => void;
}

export function useTutorial({
  steps,
  autoStart = false,
  onComplete,
}: UseTutorialOptions) {
  const [isActive, setIsActive] = useState(autoStart);
  const [currentStep, setCurrentStep] = useState(0);
  const [elementRect, setElementRect] = useState<DOMRect | null>(null);

  const currentStepData = steps[currentStep];

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

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      close();
      onComplete?.();
    }
  };

  const close = () => {
    setIsActive(false);
    setCurrentStep(0);
    setElementRect(null);
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
    start,
    next,
    close,
    goToStep,
  };
}
