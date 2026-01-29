"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface IntervalPickerProps {
  outcomes: Array<{ id: string; outcome: string; probability: number }>;
  granularity: "year" | "quarter" | "month" | "day";
  selectedRange: [number, number];
  onRangeChange: (range: [number, number]) => void;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="px-2 py-1 rounded-full bg-white/60 backdrop-blur text-black text-xs font-semibold shadow-md">
    {children}
  </span>
);

export function IntervalPicker({
  outcomes,
  granularity,
  selectedRange,
  onRangeChange,
}: IntervalPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lastSelected, setLastSelected] = useState<number>(-1);

  const handleCellClick = (index: number) => {
    if (lastSelected === -1) {
      // First click - set both start and end to same index
      onRangeChange([index, index]);
      setLastSelected(index);
    } else {
      // Already have a selection - update the range
      onRangeChange([
        Math.min(lastSelected, index),
        Math.max(lastSelected, index),
      ]);
      setLastSelected(index);
    }
  };

  const isInRange = (index: number) => {
    const [start, end] = selectedRange;
    return start >= 0 && end >= 0 && index >= start && index <= end;
  };

  if (granularity === "year") {
    // Separate year outcomes from "other" outcomes like "Later or never"
    const yearOutcomes: Array<{ index: number; outcome: typeof outcomes[0] }> = [];
    const others: Array<{ index: number; outcome: typeof outcomes[0] }> = [];

    outcomes.forEach((outcome, index) => {
      // Check if it's a year (4 digits)
      if (outcome.outcome.match(/^\d{4}$/)) {
        yearOutcomes.push({ index, outcome });
      } else {
        others.push({ index, outcome });
      }
    });

    return (
      <div className="space-y-4">
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

  if (granularity === "quarter") {
    // Parse quarters and group by year
    const quartersByYear: Record<
      string,
      Array<{ index: number; quarter: string; outcome: typeof outcomes[0] }>
    > = {};
    const others: Array<{ index: number; outcome: typeof outcomes[0] }> = [];

    outcomes.forEach((outcome, index) => {
      // Parse format like "2026 Q1"
      const match = outcome.outcome.match(/^(\d{4})\s+Q([1-4])$/);
      if (match) {
        const [, year, quarter] = match;
        if (!quartersByYear[year]) {
          quartersByYear[year] = [];
        }
        quartersByYear[year].push({ index, quarter: `Q${quarter}`, outcome });
      } else {
        // Handle "Later or never" and other non-quarter outcomes
        others.push({ index, outcome });
      }
    });

    const years = Object.keys(quartersByYear).sort();

    return (
      <div className="space-y-6">
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

  if (granularity === "month") {
    // Parse months and group by year
    const monthsByYear: Record<
      string,
      Array<{ index: number; month: string; outcome: typeof outcomes[0] }>
    > = {};
    const others: Array<{ index: number; outcome: typeof outcomes[0] }> = [];

    outcomes.forEach((outcome, index) => {
      // Parse format like "2026-01", "Jan 2026", "January 2026"
      const match = outcome.outcome.match(/^(\d{4})[-\s](\d{2}|\w+)$/);
      if (match) {
        const [, year, month] = match;
        if (!monthsByYear[year]) {
          monthsByYear[year] = [];
        }
        // Convert numeric month to 3-letter abbreviation
        let monthDisplay: string;
        if (month.match(/^\d+$/)) {
          const monthNum = parseInt(month, 10) - 1;
          monthDisplay = MONTH_NAMES[monthNum] || month;
        } else {
          monthDisplay = month;
        }
        monthsByYear[year].push({ index, month: monthDisplay, outcome });
      } else {
        others.push({ index, outcome });
      }
    });

    const years = Object.keys(monthsByYear).sort();

    return (
      <div className="space-y-6">
        {years.map((year) => (
          <div key={year}>
            <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
              {year}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {monthsByYear[year].map(({ index, month, outcome }) => (
                <button
                  key={outcome.id}
                  onClick={() => handleCellClick(index)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`relative p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center min-h-[80px] ${
                    isInRange(index)
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

  if (granularity === "day") {
    // Parse days and create calendar view
    const daysMap = new Map<string, { index: number; outcome: typeof outcomes[0] }>();
    const others: Array<{ index: number; outcome: typeof outcomes[0] }> = [];
    let calendarYear = 2026;
    let calendarMonth = 1;

    outcomes.forEach((outcome, index) => {
      const match = outcome.outcome.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, year, month, day] = match;
        daysMap.set(`${year}-${month}-${day}`, { index, outcome });
        calendarYear = parseInt(year, 10);
        calendarMonth = parseInt(month, 10);
      } else {
        others.push({ index, outcome });
      }
    });

    const [currentMonth, setCurrentMonth] = useState(calendarMonth);
    const [currentYear, setCurrentYear] = useState(calendarYear);

    const getDaysInMonth = (year: number, month: number) => {
      return new Date(year, month, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
      return new Date(year, month - 1, 1).getDay();
    };

    const goToPreviousMonth = () => {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    };

    const goToNextMonth = () => {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    };

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfWeek = getFirstDayOfMonth(currentYear, currentMonth);
    const monthName = MONTH_NAMES[currentMonth - 1];

    // Create calendar grid
    const calendarDays: Array<number | null> = [];
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarDays.push(null);
    }
    // Add all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push(day);
    }

    return (
      <div className="space-y-4">
        {/* Calendar header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-semibold">
            {monthName} {currentYear}
          </h3>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="border rounded-lg p-4 bg-gray-50">
          {/* Day labels */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
              <div key={i} className="text-center text-sm font-semibold text-gray-600 p-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="p-2" />;
              }

              const dateKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayData = daysMap.get(dateKey);
              
              if (!dayData) {
                // Day not in outcomes - show as disabled
                return (
                  <div
                    key={dateKey}
                    className="p-2 text-center text-gray-400 rounded-lg"
                  >
                    <div className="text-sm">{day}</div>
                  </div>
                );
              }

              const { index, outcome } = dayData;
              const inRange = isInRange(index);
              const isHovered = hoveredIndex === index;

              return (
                <button
                  key={dateKey}
                  onClick={() => handleCellClick(index)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`p-2 rounded-lg transition-all flex flex-col items-center justify-center min-h-[60px] ${
                    inRange
                      ? "bg-green-50 border-2 border-green-500 ring-2 ring-green-500 ring-offset-2"
                      : isHovered
                      ? "bg-blue-50 border-2 border-blue-400"
                      : "bg-white border-2 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="text-base font-semibold mb-1 text-gray-900">
                    {day}
                  </div>
                  <div className="text-[10px] font-semibold">
                    {(outcome.probability * 100).toFixed(1)}%
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Other outcomes */}
        {others.length > 0 && (
          <div className="mt-4">
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

  return (
    <div className="p-4 border rounded-lg text-center text-muted-foreground">
      {granularity} view coming soon...
    </div>
  );
}
