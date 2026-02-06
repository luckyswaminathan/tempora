"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { proposalsApi } from "@/lib/api";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { MONTHS, QUARTERS } from "@/lib/utils";

const CATEGORIES = [
  "Economics",
  "Politics",
  "Technology",
  "Sports",
  "Climate",
  "General",
];

const UI_TYPES = [
  { label: "Default (List)", value: "bars-ordered" },
  { label: "Daily Calendar", value: "day" },
  { label: "Monthly Calendar", value: "month" },
  { label: "Quarterly Calendar", value: "quarter" },
  { label: "Yearly Calendar", value: "year" },
  { label: "Interval Range", value: "interval" },
];

interface FormConfig {
  // For daily
  startDate: string;
  endDate: string;
  // For monthly
  selectedMonths: string[];
  // For quarterly
  selectedQuarters: string[];
  // For yearly
  selectedYears: number[];
  // For interval
  intervalMin: string;
  intervalMax: string;
  intervalStep: string;
  intervalUnit: string;
  includeLowerBound: boolean;
  lowerBoundLabel: string;
  includeUpperBound: boolean;
  upperBoundLabel: string;
  // Common
  includeCatchAll: boolean;
  catchAllLabel: string;
}

interface MarketCreateFormProps {
  disabled?: boolean;
  onSuccess?: () => void;
}

export function MarketCreateForm({
  disabled = false,
  onSuccess,
}: MarketCreateFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    question: "",
    category: "General",
    uiType: "bars-ordered",
    description: "",
    resolutionDate: "",
    outcomes: [
      { text: "", isCatchAll: false },
      { text: "", isCatchAll: false },
    ],
    tags: "",
    liquidityParameter: "1000",
  });

  const [formConfig, setFormConfig] = useState<FormConfig>({
    startDate: "",
    endDate: "",
    selectedMonths: [],
    selectedQuarters: [],
    selectedYears: [],
    intervalMin: "",
    intervalMax: "",
    intervalStep: "",
    intervalUnit: "",
    includeLowerBound: false,
    lowerBoundLabel: "Below",
    includeUpperBound: false,
    upperBoundLabel: "Above",
    includeCatchAll: true,
    catchAllLabel: "Later or never",
  });

  // Calendar navigation state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [currentYear, setCurrentYear] = useState(() =>
    new Date().getFullYear(),
  );

  // Generate outcomes from calendar config
  const generateOutcomes = (): { text: string; isCatchAll: boolean }[] => {
    const outcomes: { text: string; isCatchAll: boolean }[] = [];

    // Handle interval type
    if (formData.uiType === "interval") {
      const min = parseFloat(formConfig.intervalMin);
      const max = parseFloat(formConfig.intervalMax);
      const step = parseFloat(formConfig.intervalStep);
      const unit = formConfig.intervalUnit;

      if (!isNaN(min) && !isNaN(max) && !isNaN(step) && step > 0 && max > min) {
        // Add lower bound if enabled
        if (formConfig.includeLowerBound) {
          outcomes.push({
            text: `${formConfig.lowerBoundLabel} ${min}${unit}`,
            isCatchAll: false,
          });
        }

        // Generate interval outcomes
        for (let i = min; i < max; i += step) {
          const rangeEnd = Math.min(i + step, max);
          outcomes.push({
            text: `${i}-${rangeEnd}${unit}`,
            isCatchAll: false,
          });
        }

        // Add upper bound if enabled
        if (formConfig.includeUpperBound) {
          outcomes.push({
            text: `${formConfig.upperBoundLabel} ${max}${unit}`,
            isCatchAll: false,
          });
        }
      }
      return outcomes;
    }

    if (
      formData.uiType === "day" &&
      formConfig.startDate &&
      formConfig.endDate
    ) {
      const start = new Date(formConfig.startDate);
      const end = new Date(formConfig.endDate);
      const current = new Date(start);

      while (current <= end) {
        outcomes.push({
          text: current.toISOString().split("T")[0],
          isCatchAll: false,
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (formData.uiType === "month") {
      formConfig.selectedMonths.sort().forEach((month) => {
        outcomes.push({ text: month, isCatchAll: false });
      });
    } else if (formData.uiType === "quarter") {
      formConfig.selectedQuarters.sort().forEach((quarter) => {
        outcomes.push({ text: quarter, isCatchAll: false });
      });
    } else if (formData.uiType === "year") {
      formConfig.selectedYears
        .sort((a, b) => a - b)
        .forEach((year) => {
          outcomes.push({ text: year.toString(), isCatchAll: false });
        });
    }

    if (formConfig.includeCatchAll && outcomes.length > 0) {
      outcomes.push({ text: formConfig.catchAllLabel, isCatchAll: true });
    }

    return outcomes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let outcomes: { text: string; isCatchAll: boolean }[];

      if (formData.uiType === "bars-ordered") {
        outcomes = formData.outcomes.filter((o) => o.text.trim());
      } else {
        outcomes = generateOutcomes();
      }

      if (outcomes.length < 2) {
        toast.error("Please provide at least 2 outcomes");
        setSubmitting(false);
        return;
      }

      const catchAllCount = outcomes.filter((o) => o.isCatchAll).length;
      if (catchAllCount > 1) {
        toast.error("At most one outcome can be marked as catch-all");
        setSubmitting(false);
        return;
      }

      if (!formData.question.trim()) {
        toast.error("Please enter a question");
        setSubmitting(false);
        return;
      }

      if (!formData.resolutionDate) {
        toast.error("Please select a resolution date");
        setSubmitting(false);
        return;
      }

      const tags = formData.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      await proposalsApi.createProposal({
        question: formData.question,
        category: formData.category,
        description: formData.description,
        resolutionDate: formData.resolutionDate,
        outcomes: outcomes.map((o) => o.text),
        tags,
        liquidityParameter: formData.liquidityParameter
          ? parseInt(formData.liquidityParameter)
          : undefined,
        uiType: formData.uiType,
      });

      toast.success("Market created successfully!");
      // Reset form
      setFormData({
        question: "",
        category: "General",
        uiType: "bars-ordered",
        description: "",
        resolutionDate: "",
        outcomes: [
          { text: "", isCatchAll: false },
          { text: "", isCatchAll: false },
        ],
        tags: "",
        liquidityParameter: "1000",
      });
      // Call onSuccess callback to refresh parent component
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit proposal",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateOutcome = (index: number, value: string) => {
    const newOutcomes = [...formData.outcomes];
    newOutcomes[index].text = value;
    setFormData({ ...formData, outcomes: newOutcomes });
  };

  const toggleCatchAll = (index: number) => {
    const newOutcomes = formData.outcomes.map((o, i) => ({
      ...o,
      isCatchAll: i === index ? !o.isCatchAll : false,
    }));
    setFormData({ ...formData, outcomes: newOutcomes });
  };

  const addOutcome = () => {
    setFormData({
      ...formData,
      outcomes: [...formData.outcomes, { text: "", isCatchAll: false }],
    });
  };

  const removeOutcome = (index: number) => {
    if (formData.outcomes.length > 2) {
      setFormData({
        ...formData,
        outcomes: formData.outcomes.filter((_, i) => i !== index),
      });
    }
  };

  // Daily calendar picker
  const DayPicker = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const formatDate = (day: number) => {
      const m = String(month + 1).padStart(2, "0");
      const d = String(day).padStart(2, "0");
      return `${year}-${m}-${d}`;
    };

    const isInRange = (day: number) => {
      if (!formConfig.startDate || !formConfig.endDate) return false;
      const date = formatDate(day);
      return date >= formConfig.startDate && date <= formConfig.endDate;
    };

    const isStart = (day: number) => formatDate(day) === formConfig.startDate;
    const isEnd = (day: number) => formatDate(day) === formConfig.endDate;

    const handleDayClick = (day: number) => {
      const date = formatDate(day);
      if (
        !formConfig.startDate ||
        (formConfig.startDate && formConfig.endDate)
      ) {
        setFormConfig({ ...formConfig, startDate: date, endDate: "" });
      } else {
        if (date < formConfig.startDate) {
          setFormConfig({
            ...formConfig,
            startDate: date,
            endDate: formConfig.startDate,
          });
        } else {
          setFormConfig({ ...formConfig, endDate: date });
        }
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium">
            {MONTHS[month]} {year}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="p-2 font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day, idx) => (
            <button
              key={idx}
              type="button"
              disabled={day === null}
              onClick={() => day && handleDayClick(day)}
              className={`p-2 rounded-md text-sm transition-colors ${
                day === null
                  ? ""
                  : isStart(day) || isEnd(day)
                    ? "bg-blue-600 text-white"
                    : isInRange(day)
                      ? "bg-blue-200"
                      : "hover:bg-muted"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
        {formConfig.startDate && (
          <div className="text-sm text-muted-foreground">
            Selected: {formConfig.startDate}
            {formConfig.endDate && ` to ${formConfig.endDate}`}
            {formConfig.endDate && (
              <span className="ml-2">
                (
                {Math.floor(
                  (new Date(formConfig.endDate).getTime() -
                    new Date(formConfig.startDate).getTime()) /
                    (1000 * 60 * 60 * 24),
                ) + 1}{" "}
                days)
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Monthly picker
  const MonthPicker = () => {
    const toggleMonth = (monthKey: string) => {
      const selected = formConfig.selectedMonths.includes(monthKey)
        ? formConfig.selectedMonths.filter((m) => m !== monthKey)
        : [...formConfig.selectedMonths, monthKey];
      setFormConfig({ ...formConfig, selectedMonths: selected });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentYear(currentYear - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium">{currentYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentYear(currentYear + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((month, idx) => {
            const monthKey = `${currentYear}-${String(idx + 1).padStart(2, "0")}`;
            const isSelected = formConfig.selectedMonths.includes(monthKey);
            return (
              <button
                key={month}
                type="button"
                onClick={() => toggleMonth(monthKey)}
                className={`p-3 rounded-md text-sm transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {month.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {formConfig.selectedMonths.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {formConfig.selectedMonths.length} month(s) selected
          </div>
        )}
      </div>
    );
  };

  // Quarterly picker
  const QuarterPicker = () => {
    const toggleQuarter = (quarterKey: string) => {
      const selected = formConfig.selectedQuarters.includes(quarterKey)
        ? formConfig.selectedQuarters.filter((q) => q !== quarterKey)
        : [...formConfig.selectedQuarters, quarterKey];
      setFormConfig({ ...formConfig, selectedQuarters: selected });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentYear(currentYear - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium">{currentYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentYear(currentYear + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUARTERS.map((quarter) => {
            const quarterKey = `${currentYear} ${quarter}`;
            const isSelected = formConfig.selectedQuarters.includes(quarterKey);
            return (
              <button
                key={quarter}
                type="button"
                onClick={() => toggleQuarter(quarterKey)}
                className={`p-4 rounded-md text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {quarter} {currentYear}
              </button>
            );
          })}
        </div>
        {formConfig.selectedQuarters.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {formConfig.selectedQuarters.length} quarter(s) selected
          </div>
        )}
      </div>
    );
  };

  // Yearly picker
  const YearPicker = () => {
    const startYear = currentYear - 2;
    const years = Array.from({ length: 6 }, (_, i) => startYear + i);

    const toggleYear = (year: number) => {
      const selected = formConfig.selectedYears.includes(year)
        ? formConfig.selectedYears.filter((y) => y !== year)
        : [...formConfig.selectedYears, year];
      setFormConfig({ ...formConfig, selectedYears: selected });
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentYear(currentYear - 6)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-medium">
            {startYear} - {startYear + 5}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCurrentYear(currentYear + 6)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {years.map((year) => {
            const isSelected = formConfig.selectedYears.includes(year);
            return (
              <button
                key={year}
                type="button"
                onClick={() => toggleYear(year)}
                className={`p-4 rounded-md text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {year}
              </button>
            );
          })}
        </div>
        {formConfig.selectedYears.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {formConfig.selectedYears.length} year(s) selected
          </div>
        )}
      </div>
    );
  };

  // Preview generated outcomes
  const previewOutcomes =
    formData.uiType !== "bars-ordered" ? generateOutcomes() : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 sm:max-w-2xl">
      {/* Question */}
      <div className="space-y-2">
        <Label htmlFor="question">Question</Label>
        <Input
          id="question"
          placeholder="What is your prediction question?"
          value={formData.question}
          onChange={(e) =>
            setFormData({ ...formData, question: e.target.value })
          }
          required
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
          value={formData.category}
          onChange={(e) =>
            setFormData({ ...formData, category: e.target.value })
          }
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* UI Type */}
      <div className="space-y-2">
        <Label htmlFor="uiType">Market Style</Label>
        <select
          id="uiType"
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
          value={formData.uiType}
          onChange={(e) => setFormData({ ...formData, uiType: e.target.value })}
        >
          {UI_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (Optional)</Label>
        <textarea
          id="description"
          placeholder="Provide additional context about this market..."
          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground min-h-24"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
      </div>

      {/* Resolution Date */}
      <div className="space-y-2">
        <Label htmlFor="resolutionDate">Resolution Date</Label>
        <Input
          id="resolutionDate"
          type="datetime-local"
          value={formData.resolutionDate}
          onChange={(e) =>
            setFormData({ ...formData, resolutionDate: e.target.value })
          }
          required
        />
      </div>

      {/* Calendar-based outcomes pickers */}
      {formData.uiType === "day" && (
        <div className="space-y-2">
          <Label>Select Date Range</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Click to select start date, then click again to select end date
          </p>
          <div className="border rounded-lg p-4">
            <DayPicker />
          </div>
        </div>
      )}

      {formData.uiType === "month" && (
        <div className="space-y-2">
          <Label>Select Months</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Click months to toggle selection. Use arrows to change year.
          </p>
          <div className="border rounded-lg p-4">
            <MonthPicker />
          </div>
        </div>
      )}

      {formData.uiType === "quarter" && (
        <div className="space-y-2">
          <Label>Select Quarters</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Click quarters to toggle selection. Use arrows to change year.
          </p>
          <div className="border rounded-lg p-4">
            <QuarterPicker />
          </div>
        </div>
      )}

      {formData.uiType === "year" && (
        <div className="space-y-2">
          <Label>Select Years</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Click years to toggle selection.
          </p>
          <div className="border rounded-lg p-4">
            <YearPicker />
          </div>
        </div>
      )}

      {formData.uiType === "interval" && (
        <div className="space-y-4">
          <Label>Define Numeric Range</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Create intervals for numeric predictions (e.g., temperature, prices,
            scores)
          </p>
          <div className="border rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="intervalMin">Minimum</Label>
                <Input
                  id="intervalMin"
                  type="number"
                  placeholder="0"
                  value={formConfig.intervalMin}
                  onChange={(e) =>
                    setFormConfig({
                      ...formConfig,
                      intervalMin: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intervalMax">Maximum</Label>
                <Input
                  id="intervalMax"
                  type="number"
                  placeholder="100"
                  value={formConfig.intervalMax}
                  onChange={(e) =>
                    setFormConfig({
                      ...formConfig,
                      intervalMax: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intervalStep">Step Size</Label>
                <Input
                  id="intervalStep"
                  type="number"
                  placeholder="5"
                  value={formConfig.intervalStep}
                  onChange={(e) =>
                    setFormConfig({
                      ...formConfig,
                      intervalStep: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intervalUnit">Unit (optional)</Label>
              <Input
                id="intervalUnit"
                placeholder="°F, %, $, pts, etc."
                value={formConfig.intervalUnit}
                onChange={(e) =>
                  setFormConfig({
                    ...formConfig,
                    intervalUnit: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeLowerBound"
                    checked={formConfig.includeLowerBound}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        includeLowerBound: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <Label htmlFor="includeLowerBound" className="cursor-pointer">
                    Include lower bound
                  </Label>
                </div>
                {formConfig.includeLowerBound && (
                  <Input
                    placeholder="Below"
                    value={formConfig.lowerBoundLabel}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        lowerBoundLabel: e.target.value,
                      })
                    }
                  />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeUpperBound"
                    checked={formConfig.includeUpperBound}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        includeUpperBound: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <Label htmlFor="includeUpperBound" className="cursor-pointer">
                    Include upper bound
                  </Label>
                </div>
                {formConfig.includeUpperBound && (
                  <Input
                    placeholder="Above"
                    value={formConfig.upperBoundLabel}
                    onChange={(e) =>
                      setFormConfig({
                        ...formConfig,
                        upperBoundLabel: e.target.value,
                      })
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Catch-all option for calendar styles */}
      {formData.uiType !== "bars-ordered" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeCatchAll"
              checked={formConfig.includeCatchAll}
              onChange={(e) =>
                setFormConfig({
                  ...formConfig,
                  includeCatchAll: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <Label htmlFor="includeCatchAll" className="cursor-pointer">
              Include &quot;catch-all&quot; option
            </Label>
          </div>
          {formConfig.includeCatchAll && (
            <Input
              placeholder="Catch-all label (e.g., 'Later or never')"
              value={formConfig.catchAllLabel}
              onChange={(e) =>
                setFormConfig({
                  ...formConfig,
                  catchAllLabel: e.target.value,
                })
              }
            />
          )}
        </div>
      )}

      {/* Preview for calendar styles */}
      {formData.uiType !== "bars-ordered" && previewOutcomes.length > 0 && (
        <div className="space-y-2">
          <Label>Preview ({previewOutcomes.length} outcomes)</Label>
          <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {previewOutcomes.map((o, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded text-sm ${
                    o.isCatchAll
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {o.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Outcomes for default style */}
      {formData.uiType === "bars-ordered" && (
        <div className="space-y-2">
          <Label>Outcomes</Label>
          <div className="space-y-2">
            {formData.outcomes.map((outcome, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <Input
                  placeholder={`Outcome ${idx + 1}`}
                  value={outcome.text}
                  onChange={(e) => updateOutcome(idx, e.target.value)}
                  className="flex-1"
                />
                <label className="flex items-center gap-2 whitespace-nowrap text-sm">
                  <input
                    type="checkbox"
                    checked={outcome.isCatchAll}
                    onChange={() => toggleCatchAll(idx)}
                    className="w-4 h-4"
                  />
                  Catch-all
                </label>
                {formData.outcomes.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOutcome(idx)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={addOutcome}
          >
            Add Outcome
          </Button>
        </div>
      )}

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags (Optional, comma-separated)</Label>
        <Input
          id="tags"
          placeholder="election, 2026, politics"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
        />
      </div>

      {/* Liquidity parameter */}
      <div className="space-y-2">
        <Label htmlFor="liquidityParameter">Liquidity parameter</Label>
        <Input
          id="liquidityParameter"
          type="number"
          placeholder="1000"
          value={formData.liquidityParameter}
          onChange={(e) =>
            setFormData({ ...formData, liquidityParameter: e.target.value })
          }
        />
      </div>

      <Button
        type="submit"
        disabled={submitting || disabled}
        className="w-full"
      >
        {submitting ? "Submitting..." : "Submit for Review"}
      </Button>
    </form>
  );
}
