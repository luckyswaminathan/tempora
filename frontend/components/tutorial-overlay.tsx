"use client";

import { Button } from "@/components/ui/button";

export interface TutorialStep {
  id: number;
  elementId: string;
  title: string;
  description: string;
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  currentStep: number;
  isActive: boolean;
  elementRect: DOMRect | null;
  onNext: () => void;
  onClose: () => void;
}

export function TutorialOverlay({
  steps,
  currentStep,
  isActive,
  elementRect,
  onNext,
  onClose,
}: TutorialOverlayProps) {
  if (!isActive) return null;

  const currentStepData = steps[currentStep];

  return (
    <>
      {/* Fade overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Highlight and tooltip */}
      {elementRect && (
        <>
          {/* Highlighted element border */}
          <div
            className="fixed z-50 pointer-events-none border-2 border-yellow-400 rounded-lg shadow-lg"
            style={{
              top: `${elementRect.top - 4}px`,
              left: `${elementRect.left - 4}px`,
              width: `${elementRect.width + 8}px`,
              height: `${elementRect.height + 8}px`,
              boxShadow: "0 0 20px rgba(250, 204, 21, 0.6)",
            }}
          />

          {/* Tooltip */}
          <div
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 w-96 border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{
              top: `${Math.min(
                elementRect.bottom + 20,
                window.innerHeight - 300,
              )}px`,
              left: `${Math.max(
                Math.min(
                  elementRect.left + elementRect.width / 2 - 192,
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
                Step {currentStep + 1} of {steps.length}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button size="sm" onClick={onNext}>
                  {currentStep === steps.length - 1 ? "Done" : "OK"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
