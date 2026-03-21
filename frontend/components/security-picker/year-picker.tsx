"use client";

import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";

export function YearPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
  winningSecurityId,
  readOnly,
}: SecurityPickerProps) {
  const todayYear = new Date().getFullYear();
  const isElapsedYear = (year: string) => parseInt(year, 10) < todayYear;

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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {yearOutcomes.map(({ index, outcome }) => {
          const elapsed = isElapsedYear(outcome.outcome);
          const disabled = elapsed && !readOnly;
          const isWinning = outcome.id === winningSecurityId;
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
                  : isInRange(index)
                    ? "border-primary bg-primary/15 ring-2 ring-primary ring-offset-2"
                    : isWinning
                      ? "border-accent/70 bg-accent/30"
                      : hoveredIndex === index
                        ? "border-secondary/70 bg-muted/75"
                        : "border-border/85 bg-card/70 hover:border-secondary/65 hover:bg-muted/65"
              }`}
            >
              <div className="text-base font-bold text-center mb-2 break-words w-full">
                {outcome.outcome}
              </div>
              <div className="text-center">
                <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
              </div>
            </button>
          );
        })}
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
                    ? "border-primary bg-primary/15 ring-2 ring-primary ring-offset-2"
                    : outcome.id === winningSecurityId
                      ? "border-accent/70 bg-accent/30"
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
