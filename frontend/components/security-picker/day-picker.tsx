"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { SecurityPickerProps, Pill, SecurityPickerOutcome } from "./types";
import { MONTH_NAMES } from "@/lib/utils";

export function DayPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  hoveredIndex,
  isInRange,
}: SecurityPickerProps) {
  // Parse days from outcomes
  const dayMap = new Map<
    string,
    { index: number; outcome: SecurityPickerOutcome }
  >();
  const others: Array<{ index: number; outcome: SecurityPickerOutcome }> = [];

  outcomes.forEach((outcome, index) => {
    if (outcome.isCatchAll) {
      others.push({ index, outcome });
    } else {
      const match = outcome.outcome.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        dayMap.set(outcome.outcome, { index, outcome });
      } else {
        throw new Error(
          `Invalid day outcome: "${outcome.outcome}". Expected format: YYYY-MM-DD.`,
        );
      }
    }
  });

  // Find earliest and latest dates
  const dates = Array.from(dayMap.keys()).sort();
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (dates.length === 0) return new Date();
    const firstDate = new Date(dates[0]);
    return new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
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
            {MONTH_NAMES[month]} {year}
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
