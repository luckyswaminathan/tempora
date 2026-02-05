"use client";

import { SecurityPickerProps, Pill } from "./types";

export function BarsPicker({
  outcomes,
  handleCellClick,
  setHoveredIndex,
  isInRange,
}: SecurityPickerProps) {
  // Calculate max probability for scaling
  const maxProbability = Math.max(...outcomes.map((o) => o.probability), 0);

  return (
    <div className="space-y-2">
      {outcomes.map((outcome, index) => {
        const widthPercent =
          maxProbability > 0 ? (outcome.probability / maxProbability) * 100 : 0;
        const isSelected = isInRange(index);

        return (
          <button
            key={outcome.id}
            onClick={() => handleCellClick(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={`w-full h-12 rounded-lg relative overflow-visible transition ring-offset-2 ${
              isSelected
                ? "ring-2 ring-green-500"
                : "hover:ring-2 hover:ring-primary"
            }`}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-lg transition-all duration-300 bg-blue-200"
              style={{ width: `${widthPercent}%` }}
            />

            <div className="absolute left-3 top-0 h-full flex items-center z-10">
              <Pill>{outcome.outcome}</Pill>
            </div>

            <div
              className="absolute top-0 h-full flex items-center gap-2 z-10"
              style={{ right: "12px" }}
            >
              <Pill>{(outcome.probability * 100).toFixed(1)}%</Pill>
            </div>
          </button>
        );
      })}
    </div>
  );
}
