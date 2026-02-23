"use client";

import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";
import { MONTHS } from "@/lib/utils";

export function MonthPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
}: SecurityPickerProps) {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-indexed

  const monthsByYear: Record<
    string,
    Array<{
      index: number;
      month: string;
      monthNum: number;
      outcome: SecurityPickerOutcome;
    }>
  > = {};
  const others: Array<{ index: number; outcome: SecurityPickerOutcome }> = [];
  const errors: string[] = [];

  outcomes.forEach((outcome, index) => {
    if (outcome.isCatchAll) {
      others.push({ index, outcome });
    } else {
      const match = outcome.outcome.match(/^(\d{4})[-\s](\d{2}|\w+)$/);
      if (match) {
        const [, year, month] = match;
        if (!monthsByYear[year]) {
          monthsByYear[year] = [];
        }
        let monthDisplay: string;
        let monthNum: number;
        if (month.match(/^\d+$/)) {
          monthNum = parseInt(month, 10);
          monthDisplay = MONTHS[monthNum - 1] || month;
        } else {
          monthNum = MONTHS.indexOf(month) + 1;
          monthDisplay = month;
        }
        monthsByYear[year].push({
          index,
          month: monthDisplay,
          monthNum,
          outcome,
        });
      } else {
        errors.push(
          `Invalid month outcome: "${outcome.outcome}". Expected format: YYYY-MM or YYYY MonthName.`,
        );
      }
    }
  });

  const isElapsedMonth = (year: string, monthNum: number) => {
    const y = parseInt(year, 10);
    return y < todayYear || (y === todayYear && monthNum < todayMonth);
  };

  const years = Object.keys(monthsByYear).sort();

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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {monthsByYear[year].map(({ index, month, monthNum, outcome }) => {
              const elapsed = isElapsedMonth(year, monthNum);
              return (
                <button
                  key={outcome.id}
                  disabled={elapsed}
                  onClick={() => !elapsed && handleCellClick(index)}
                  onMouseEnter={() => !elapsed && setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center min-h-[80px] ${
                    elapsed
                      ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                      : isInRange(index)
                        ? "border-green-500 bg-green-50 ring-2 ring-green-500 ring-offset-2"
                        : hoveredIndex === index
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-sm font-bold text-center mb-1">
                    {month}
                  </div>
                  <div className="text-center">
                    <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
                  </div>
                </button>
              );
            })}
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
