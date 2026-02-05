"use client";

import { useMemo } from "react";
import { SecurityPickerProps } from "./types";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from "recharts";

export function IntervalPicker({
  outcomes,
  hoveredIndex,
  setHoveredIndex,
  handleCellClick,
  isInRange,
  onRangeChange,
}: SecurityPickerProps) {
  // Separate catch-all and regular outcomes
  const { regularOutcomes, catchAllOutcome } = useMemo(() => {
    const regular = outcomes.filter((o) => !o.isCatchAll);
    const catchAll = outcomes.find((o) => o.isCatchAll);

    // Sort regular outcomes by value
    regular.sort((a, b) => a.value - b.value);

    return { regularOutcomes: regular, catchAllOutcome: catchAll };
  }, [outcomes]);

  // Calculate selected range based on isInRange
  const selectedIndices = useMemo(() => {
    const indices: number[] = [];
    outcomes.forEach((_, index) => {
      if (isInRange(index)) {
        indices.push(index);
      }
    });
    return indices;
  }, [outcomes, isInRange]);

  const startIndex =
    selectedIndices.length > 0 ? Math.min(...selectedIndices) : 0;
  const endIndex =
    selectedIndices.length > 0 ? Math.max(...selectedIndices) : 0;

  // Find the corresponding regular outcomes for display
  const startOutcome = outcomes[startIndex];
  const endOutcome = outcomes[endIndex];

  // Calculate slider range (0 to regularOutcomes.length - 1)
  const minSliderValue = 0;
  const maxSliderValue = regularOutcomes.length - 1;

  // Map selected indices to slider positions
  const startSliderValue = regularOutcomes.findIndex(
    (o) => o.id === startOutcome?.id,
  );
  const endSliderValue = regularOutcomes.findIndex(
    (o) => o.id === endOutcome?.id,
  );

  const handleSliderChange = (values: number[]) => {
    if (values.length === 2 && onRangeChange) {
      const [start, end] = values;
      const startOutcomeId = regularOutcomes[start]?.id;
      const endOutcomeId = regularOutcomes[end]?.id;

      const startIdx = outcomes.findIndex((o) => o.id === startOutcomeId);
      const endIdx = outcomes.findIndex((o) => o.id === endOutcomeId);

      // Directly set the range for smooth slider dragging
      if (startIdx >= 0 && endIdx >= 0) {
        onRangeChange([startIdx, endIdx]);
      }
    }
  };

  const handleCatchAllClick = () => {
    if (catchAllOutcome) {
      const idx = outcomes.findIndex((o) => o.id === catchAllOutcome.id);
      if (idx >= 0) {
        handleCellClick(idx);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Probability Distribution Chart */}
      <div className="space-y-3">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={regularOutcomes.map((outcome, idx) => ({
                name: outcome.outcome,
                probability: outcome.probability * 100, // Convert to percentage
                index: idx,
                id: outcome.id,
              }))}
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={80}
                interval={Math.max(0, Math.floor(regularOutcomes.length / 10))}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                label={{
                  value: "Probability (%)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle" },
                }}
                domain={[0, "auto"]}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-2 border rounded shadow-lg">
                        <p className="font-semibold text-sm">{data.name}</p>
                        <p className="text-xs text-gray-600">
                          {data.probability.toFixed(2)}%
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                {regularOutcomes.map((outcome, index) => {
                  const regularIndex = outcomes.findIndex(
                    (o) => o.id === outcome.id,
                  );
                  const isSelected = isInRange(regularIndex);
                  return (
                    <Cell
                      key={outcome.id}
                      fill={isSelected ? "#22c55e" : "#93c5fd"}
                      style={{ cursor: "pointer" }}
                      onClick={() => handleCellClick(regularIndex)}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Range Slider */}
        <div className="px-2 space-y-3">
          <label className="text-sm font-medium">Select Range</label>
          <Slider
            min={minSliderValue}
            max={maxSliderValue}
            step={1}
            value={[
              Math.max(
                minSliderValue,
                startSliderValue >= 0 ? startSliderValue : 0,
              ),
              Math.min(
                maxSliderValue,
                endSliderValue >= 0 ? endSliderValue : maxSliderValue,
              ),
            ]}
            onValueChange={handleSliderChange}
            minStepsBetweenThumbs={0}
            className="my-3"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>{regularOutcomes[0]?.value}</span>
            <span>{regularOutcomes[regularOutcomes.length - 1]?.value}</span>
          </div>
        </div>
      </div>

      {/* Catch-all button */}
      {catchAllOutcome && (
        <div className="flex justify-center">
          <Button
            variant={
              isInRange(outcomes.findIndex((o) => o.id === catchAllOutcome.id))
                ? "default"
                : "outline"
            }
            onClick={handleCatchAllClick}
            className="min-w-[200px]"
          >
            {catchAllOutcome.outcome}
            <span className="ml-2 text-xs">
              ({(catchAllOutcome.probability * 100).toFixed(1)}%)
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
