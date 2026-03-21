"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";
import { MONTHS } from "@/lib/utils";

export function DayPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
  winningSecurityId,
  readOnly,
}: SecurityPickerProps) {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Parse days from outcomes
  const dayMap = new Map<
    string,
    { index: number; outcome: SecurityPickerOutcome }
  >();
  const others: Array<{ index: number; outcome: SecurityPickerOutcome }> = [];
  const errors: string[] = [];

  outcomes.forEach((outcome, index) => {
    if (outcome.isCatchAll) {
      others.push({ index, outcome });
    } else {
      const match = outcome.outcome.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        dayMap.set(outcome.outcome, { index, outcome });
      } else {
        errors.push(
          `Invalid day outcome: "${outcome.outcome}". Expected format: YYYY-MM-DD.`,
        );
      }
    }
  });

  const isElapsedDate = (dateStr: string) => dateStr < todayStr;

  // Open on the earliest non-elapsed date, falling back to the first date
  const dates = Array.from(dayMap.keys()).sort();
  const winningDate = winningSecurityId
    ? dates.find((date) => dayMap.get(date)?.outcome.id === winningSecurityId)
    : undefined;

  // YYYY-MM strings bounding the navigable range
  const firstMonthKey = dates.length > 0 ? dates[0].slice(0, 7) : null;
  const lastMonthKey =
    dates.length > 0 ? dates[dates.length - 1].slice(0, 7) : null;

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (dates.length === 0) return new Date();
    if (readOnly && winningDate) {
      const winning = new Date(winningDate);
      return new Date(winning.getFullYear(), winning.getMonth(), 1);
    }
    const firstTradeable = dates.find((d) => !isElapsedDate(d)) ?? dates[0];
    const d = new Date(firstTradeable);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!readOnly || !winningDate) return;

    const winning = new Date(winningDate);
    const targetMonth = new Date(winning.getFullYear(), winning.getMonth(), 1);
    setCurrentMonth((prev) => {
      if (
        prev.getFullYear() === targetMonth.getFullYear() &&
        prev.getMonth() === targetMonth.getMonth()
      ) {
        return prev;
      }
      return targetMonth;
    });
  }, [readOnly, winningDate]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const currentMonthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const canGoPrev = firstMonthKey !== null && currentMonthKey > firstMonthKey;
  const canGoNext = lastMonthKey !== null && currentMonthKey < lastMonthKey;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const days: Array<{ day: number; date: string } | null> = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ day, date: dateStr });
  }

  const previousMonth = () => {
    if (canGoPrev) setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    if (canGoNext) setCurrentMonth(new Date(year, month + 1, 1));
  };

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
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousMonth}
            disabled={!canGoPrev}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold text-muted-foreground">
            {MONTHS[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-muted-foreground p-2"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((dayInfo, i) => {
            if (!dayInfo) {
              return <div key={`empty-${i}`} />;
            }

            const dayData = dayMap.get(dayInfo.date);
            if (!dayData) {
              return (
                <div
                  key={dayInfo.date}
                  className="aspect-square p-2 rounded-lg border border-gray-100 flex items-center justify-center text-sm text-muted-foreground"
                >
                  {dayInfo.day}
                </div>
              );
            }

            const elapsed = isElapsedDate(dayInfo.date);
            const disabled = elapsed && !readOnly;
            const isWinning = dayData.outcome.id === winningSecurityId;
            return (
              <button
                key={dayInfo.date}
                disabled={disabled}
                onClick={() => !disabled && handleCellClick(dayData.index)}
                onMouseEnter={() => !disabled && setHoveredIndex(dayData.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`aspect-square p-2 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                  disabled
                    ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                    : isInRange(dayData.index)
                      ? "border-primary bg-primary/15 ring-2 ring-primary ring-offset-2"
                      : isWinning
                        ? "border-primary bg-primary/15"
                        : hoveredIndex === dayData.index
                          ? "border-blue-400 bg-blue-50"
                          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-bold mb-1">{dayInfo.day}</div>
                <div className="text-xs">
                  <Pill>{(dayData.outcome.probability * 100).toFixed(0)}%</Pill>
                </div>
              </button>
            );
          })}
        </div>
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
                      ? "border-primary bg-primary/15"
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
