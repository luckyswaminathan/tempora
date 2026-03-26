"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, SlidersHorizontal } from "lucide-react";
import { YearPicker } from "./security-picker/year-picker";
import { QuarterPicker } from "./security-picker/quarter-picker";
import { MonthPicker } from "./security-picker/month-picker";
import { DayPicker } from "./security-picker/day-picker";
import { BarsPicker } from "./security-picker/bars-picker";
import { IntervalPicker } from "./security-picker/interval-picker";
import { SecurityPickerOutcome } from "./security-picker/types";

// UI Type Configuration
type UITypeConfig = {
  showToggle: boolean; // Whether to show individual/interval toggle
  defaultViewMode: "individual" | "interval"; // Default selection mode
};

const UI_TYPE_CONFIG: Record<string, UITypeConfig> = {
  "bars-ordered": { showToggle: true, defaultViewMode: "individual" },
  "bars-categorical": { showToggle: false, defaultViewMode: "individual" },
  year: { showToggle: true, defaultViewMode: "individual" },
  quarter: { showToggle: true, defaultViewMode: "individual" },
  month: { showToggle: true, defaultViewMode: "individual" },
  day: { showToggle: true, defaultViewMode: "individual" },
  interval: { showToggle: false, defaultViewMode: "interval" },
};

export function getUITypeConfig(uiType: string): UITypeConfig {
  return (
    UI_TYPE_CONFIG[uiType] || {
      showToggle: true,
      defaultViewMode: "individual",
    }
  );
}

interface Outcome {
  id: string;
  outcome: string;
  probability: number;
  value: number;
  isCatchAll: boolean;
}

interface SecurityPickerProps {
  outcomes: Outcome[];
  uiType: string;
  selectedRange: [number, number];
  onRangeChange: (range: [number, number]) => void;
  viewMode: "individual" | "interval";
  onViewModeChange: (mode: "individual" | "interval") => void;
  winningSecurityId?: string;
  readOnly?: boolean;
}

export function SecurityPicker({
  outcomes,
  uiType,
  selectedRange,
  onRangeChange,
  viewMode,
  onViewModeChange,
  winningSecurityId,
  readOnly = false,
}: SecurityPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const config = getUITypeConfig(uiType);

  const pickerOutcomes: SecurityPickerOutcome[] = outcomes.map((o) => ({
    id: o.id,
    outcome: o.outcome,
    probability: o.probability,
    value: o.value,
    isCatchAll: o.isCatchAll,
  }));

  const handleCellClick = (index: number) => {
    if (readOnly) {
      onRangeChange([index, index]);
      return;
    }

    const [start, end] = selectedRange;

    // If nothing selected yet, start a new range
    if (start === -1 || end === -1) {
      onRangeChange([index, index]);
      return;
    }

    // If clicking same cell, keep it selected
    if (start === index && end === index) {
      return;
    }

    // If we have a single selection, expand to range
    if (start === end) {
      const newStart = Math.min(start, index);
      const newEnd = Math.max(start, index);
      onRangeChange([newStart, newEnd]);
    } else {
      // If we have a range, start a new single selection
      onRangeChange([index, index]);
    }
  };

  const isInRange = (index: number): boolean => {
    const [start, end] = selectedRange;
    if (start === -1 || end === -1) return false;

    // Show preview range when hovering
    if (!readOnly && hoveredIndex !== null && start === end) {
      const previewStart = Math.min(start, hoveredIndex);
      const previewEnd = Math.max(start, hoveredIndex);
      return index >= previewStart && index <= previewEnd;
    }

    return index >= start && index <= end;
  };

  const pickerProps = {
    outcomes: pickerOutcomes,
    handleCellClick,
    setHoveredIndex,
    hoveredIndex,
    isInRange,
    onRangeChange,
    winningSecurityId,
    readOnly,
  };

  return (
    <div className="space-y-4">
      {!readOnly && config.showToggle && (
        <div className="flex gap-2">
          <Button
            variant={viewMode === "individual" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onViewModeChange("individual");
              onRangeChange([-1, -1]);
            }}
            className="flex-1"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            Individual
          </Button>
          <Button
            variant={viewMode === "interval" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              onViewModeChange("interval");
              onRangeChange([-1, -1]);
            }}
            className="flex-1"
          >
            <SlidersHorizontal className="w-4 h-4 mr-1" />
            Interval
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground mb-3 font-medium">
        {readOnly
          ? "Select an outcome to view probability history"
          : config.showToggle
            ? viewMode === "individual"
              ? "Click any outcome to trade"
              : selectedRange[0] === -1
                ? "Click to select interval start"
                : "Click another outcome to adjust interval range"
            : "Click any outcome to trade"}
      </div>

      {uiType === "year" && <YearPicker {...pickerProps} />}
      {uiType === "quarter" && <QuarterPicker {...pickerProps} />}
      {uiType === "month" && <MonthPicker {...pickerProps} />}
      {uiType === "day" && <DayPicker {...pickerProps} />}
      {(uiType === "bars-ordered" || uiType === "bars-categorical") && (
        <BarsPicker {...pickerProps} />
      )}
      {uiType === "interval" && <IntervalPicker {...pickerProps} />}
    </div>
  );
}
