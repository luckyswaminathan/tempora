"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";
import { MONTHS } from "@/lib/utils";

export function DayPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
}: SecurityPickerProps) {
  // Parse days from outcomes - try multiple date formats
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
      // Try strict YYYY-MM-DD format first
      const strictMatch = outcome.outcome.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (strictMatch) {
        dayMap.set(outcome.outcome, { index, outcome });
      } else {
        // Try parsing as a date string (handles various formats)
        const parsed = new Date(outcome.outcome);
        if (!isNaN(parsed.getTime())) {
          const normalizedDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
          dayMap.set(normalizedDate, { index, outcome });
        } else {
          errors.push(
            `Invalid day outcome: "${outcome.outcome}". Expected format: YYYY-MM-DD.`,
          );
        }
      }
    }
  });

  // Find earliest and latest dates
  const dates = useMemo(() => Array.from(dayMap.keys()).sort(), [outcomes]);
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize to the first outcome's month when outcomes are available
  useEffect(() => {
    if (!hasInitialized && dates.length > 0) {
      const firstDate = new Date(dates[0]);
      setCurrentMonth(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1));
      setHasInitialized(true);
    }
  }, [dates, hasInitialized]);

  // Default to current date if no outcomes
  const displayMonth = currentMonth ?? new Date();

  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();
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
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
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
      {dayMap.size === 0 && others.length === 0 && errors.length === 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-900">
            No outcomes available for this market.
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Outcomes received: {outcomes.length}
          </p>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-lg font-semibold text-muted-foreground">
            {MONTHS[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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

            return (
              <button
                key={dayInfo.date}
                onClick={() => handleCellClick(dayData.index)}
                onMouseEnter={() => setHoveredIndex(dayData.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`aspect-square p-2 rounded-lg border-2 transition-all flex flex-col items-center justify-center ${
                  isInRange(dayData.index)
                    ? "border-green-500 bg-green-50 ring-2 ring-green-500 ring-offset-2"
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
