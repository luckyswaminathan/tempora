"use client";

import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";

export function QuarterPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
  winningSecurityId,
  readOnly,
}: SecurityPickerProps) {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-indexed

  // A quarter is elapsed once its last month is fully in the past.
  // Q1 ends month 3, Q2→6, Q3→9, Q4→12.
  const isElapsedQuarter = (year: string, quarterNum: number) => {
    const y = parseInt(year, 10);
    const endMonth = quarterNum * 3;
    return y < todayYear || (y === todayYear && endMonth < todayMonth);
  };

  // Parse quarters and group by year
  const quartersByYear: Record<
    string,
    Array<{
      index: number;
      quarter: string;
      quarterNum: number;
      outcome: SecurityPickerOutcome;
    }>
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
        quartersByYear[year].push({
          index,
          quarter: `Q${quarter}`,
          quarterNum: parseInt(quarter, 10),
          outcome,
        });
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
        <div className="bg-destructive/10 border-2 border-destructive/30 rounded-lg p-4">
          <p className="text-sm font-medium text-destructive mb-2">
            Validation Errors:
          </p>
          <ul className="text-sm text-destructive/90 list-disc list-inside space-y-1">
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
            {quartersByYear[year].map(
              ({ index, quarter, quarterNum, outcome }) => {
                const elapsed = isElapsedQuarter(year, quarterNum);
                const disabled = elapsed && !readOnly;
                const isWinning = outcome.id === winningSecurityId;
                const shouldShowSelected = isInRange(index) && !readOnly;
                return (
                  <button
                    key={outcome.id}
                    disabled={disabled}
                    onClick={() => !disabled && handleCellClick(index)}
                    onMouseEnter={() => !disabled && setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`relative p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center min-h-[100px] ${
                      disabled
                        ? "border-border/70 bg-muted/45 opacity-55 cursor-not-allowed"
                        : shouldShowSelected
                          ? "border-primary bg-primary/15 ring-2 ring-primary ring-offset-2"
                          : isWinning
                            ? "border-primary/70 bg-primary/20"
                            : hoveredIndex === index
                              ? "border-secondary/70 bg-muted/75"
                              : "border-border/85 bg-card/70 hover:border-secondary/65 hover:bg-muted/65"
                    }`}
                  >
                    <div className="text-xl font-bold text-center mb-2">
                      {quarter}
                    </div>
                    <div className="text-center">
                      <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>
      ))}
      {others.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
            Other
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {others.map(({ index, outcome }) =>
              (() => {
                const shouldShowSelected = isInRange(index) && !readOnly;
                const isWinning = outcome.id === winningSecurityId;
                return (
                  <button
                    key={outcome.id}
                    onClick={() => handleCellClick(index)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center min-h-[70px] ${
                      shouldShowSelected
                        ? "border-primary bg-primary/15 ring-2 ring-primary ring-offset-2"
                        : isWinning
                          ? "border-primary/70 bg-primary/20"
                          : hoveredIndex === index
                            ? "border-secondary/70 bg-muted/75"
                            : "border-border/85 bg-card/70 hover:border-secondary/65 hover:bg-muted/65"
                    }`}
                  >
                    <div className="text-sm font-bold text-center mb-1 break-words w-full">
                      {outcome.outcome}
                    </div>
                    <div className="text-center">
                      <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
                    </div>
                  </button>
                );
              })(),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
