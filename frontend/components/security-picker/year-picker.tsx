"use client";

import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";

export function YearPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
}: SecurityPickerProps) {
  // Separate year outcomes from "other" outcomes like "Later or never"
  const yearOutcomes: Array<{
    index: number;
    outcome: SecurityPickerOutcome;
  }> = [];
  const others: Array<{ index: number; outcome: SecurityPickerOutcome }> = [];
  const errors: string[] = [];

  outcomes.forEach((outcome, index) => {
    // Check if it's a catch-all or a year (4 digits)
    if (outcome.isCatchAll) {
      others.push({ index, outcome });
    } else if (outcome.outcome.match(/^\d{4}$/)) {
      yearOutcomes.push({ index, outcome });
    } else {
      errors.push(
        `Invalid year outcome: "${outcome.outcome}". Expected format: YYYY.`,
      );
    }
  });

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-900 mb-2">
            Validation Errors:
          </p>
          <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
            {errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {yearOutcomes.map(({ index, outcome }) => (
          <button
            key={outcome.id}
            onClick={() => handleCellClick(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={`relative p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center min-h-[100px] ${
              isInRange(index)
                ? "border-green-500 bg-green-50 ring-2 ring-green-500 ring-offset-2"
                : hoveredIndex === index
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
            }`}
          >
            <div className="text-base font-bold text-center mb-2 break-words w-full">
              {outcome.outcome}
            </div>
            <div className="text-center">
              <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
            </div>
          </button>
        ))}
      </div>
      {others.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
            Other
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {others.map(({ index, outcome }) => (
              <button
                key={outcome.id}
                onClick={() => handleCellClick(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center min-h-[70px] ${
                  isInRange(index)
                    ? "border-green-500 bg-green-50 ring-2 ring-green-500 ring-offset-2"
                    : hoveredIndex === index
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-bold text-center mb-1 break-words w-full">
                  {outcome.outcome}
                </div>
                <div className="text-center">
                  <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
