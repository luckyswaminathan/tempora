"use client";

import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";

export function QuarterPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
}: SecurityPickerProps) {
  // Parse quarters and group by year
  const quartersByYear: Record<
    string,
    Array<{ index: number; quarter: string; outcome: SecurityPickerOutcome }>
  > = {};
  const others: Array<{ index: number; outcome: SecurityPickerOutcome }> = [];
  const errors: string[] = [];

  outcomes.forEach((outcome, index) => {
    if (outcome.isCatchAll) {
      others.push({ index, outcome });
    } else {
      const match = outcome.outcome.match(/^(\d{4})\s+Q([1-4])$/);
      if (match) {
        const [, year, quarter] = match;
        if (!quartersByYear[year]) {
          quartersByYear[year] = [];
        }
        quartersByYear[year].push({ index, quarter: `Q${quarter}`, outcome });
      } else {
        errors.push(
          `Invalid quarter outcome: "${outcome.outcome}". Expected format: YYYY Q[1-4].`,
        );
      }
    }
  });

  const years = Object.keys(quartersByYear).sort();

  return (
    <div className="space-y-6">
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
      {years.map((year) => (
        <div key={year}>
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
            {year}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quartersByYear[year].map(({ index, quarter, outcome }) => (
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
                <div className="text-xl font-bold text-center mb-2">
                  {quarter}
                </div>
                <div className="text-center">
                  <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
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
