"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { marketsApi } from "@/lib/api";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

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
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

interface CalendarConfig {
  // For daily
  startDate: string;
  endDate: string;
  // For monthly
  selectedMonths: string[]; // "2026-01", "2026-02", etc.
  // For quarterly
  selectedQuarters: string[]; // "2026-Q1", "2026-Q2", etc.
  // For yearly
  selectedYears: number[];
  // Common
  includeCatchAll: boolean;
  catchAllLabel: string;
}

export function MarketCreateForm() {
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

  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig>({
    startDate: "",
    endDate: "",
    selectedMonths: [],
    selectedQuarters: [],
    selectedYears: [],
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

    if (
      formData.uiType === "day" &&
      calendarConfig.startDate &&
      calendarConfig.endDate
    ) {
      const start = new Date(calendarConfig.startDate);
      const end = new Date(calendarConfig.endDate);
      const current = new Date(start);

      while (current <= end) {
        outcomes.push({
          text: current.toISOString().split("T")[0],
          isCatchAll: false,
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (formData.uiType === "month") {
      calendarConfig.selectedMonths.sort().forEach((month) => {
        outcomes.push({ text: month, isCatchAll: false });
      });
    } else if (formData.uiType === "quarter") {
      calendarConfig.selectedQuarters.sort().forEach((quarter) => {
        outcomes.push({ text: quarter, isCatchAll: false });
      });
    } else if (formData.uiType === "year") {
      calendarConfig.selectedYears
        .sort((a, b) => a - b)
        .forEach((year) => {
          outcomes.push({ text: year.toString(), isCatchAll: false });
        });
    }

    if (calendarConfig.includeCatchAll && outcomes.length > 0) {
      outcomes.push({ text: calendarConfig.catchAllLabel, isCatchAll: true });
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

      await marketsApi.createMarket({
        question: formData.question,
        category: formData.category,
        description: formData.description,
        resolutionDate: formData.resolutionDate,
        outcomes: outcomes.map((o) => ({
          outcome: o.text,
          isCatchAll: o.isCatchAll,
        })),
        tags,
        liquidityParameter: formData.liquidityParameter
          ? parseInt(formData.liquidityParameter)
          : undefined,
        uiType: formData.uiType as any,
      });

      toast.success("Market created successfully!");
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
      setCalendarConfig({
        startDate: "",
        endDate: "",
        selectedMonths: [],
        selectedQuarters: [],
        selectedYears: [],
        includeCatchAll: true,
        catchAllLabel: "Later or never",
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create market",
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
      if (!calendarConfig.startDate || !calendarConfig.endDate) return false;
      const date = formatDate(day);
      return date >= calendarConfig.startDate && date <= calendarConfig.endDate;
    };

    const isStart = (day: number) =>
      formatDate(day) === calendarConfig.startDate;
    const isEnd = (day: number) => formatDate(day) === calendarConfig.endDate;

    const handleDayClick = (day: number) => {
      const date = formatDate(day);
      if (
        !calendarConfig.startDate ||
        (calendarConfig.startDate && calendarConfig.endDate)
      ) {
        setCalendarConfig({ ...calendarConfig, startDate: date, endDate: "" });
      } else {
        if (date < calendarConfig.startDate) {
          setCalendarConfig({
            ...calendarConfig,
            startDate: date,
            endDate: calendarConfig.startDate,
          });
        } else {
          setCalendarConfig({ ...calendarConfig, endDate: date });
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
        {calendarConfig.startDate && (
          <div className="text-sm text-muted-foreground">
            Selected: {calendarConfig.startDate}
            {calendarConfig.endDate && ` to ${calendarConfig.endDate}`}
            {calendarConfig.endDate && (
              <span className="ml-2">
                (
                {Math.floor(
                  (new Date(calendarConfig.endDate).getTime() -
                    new Date(calendarConfig.startDate).getTime()) /
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
      const selected = calendarConfig.selectedMonths.includes(monthKey)
        ? calendarConfig.selectedMonths.filter((m) => m !== monthKey)
        : [...calendarConfig.selectedMonths, monthKey];
      setCalendarConfig({ ...calendarConfig, selectedMonths: selected });
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
            const isSelected = calendarConfig.selectedMonths.includes(monthKey);
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
        {calendarConfig.selectedMonths.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {calendarConfig.selectedMonths.length} month(s) selected
          </div>
        )}
      </div>
    );
  };

  // Quarterly picker
  const QuarterPicker = () => {
    const toggleQuarter = (quarterKey: string) => {
      const selected = calendarConfig.selectedQuarters.includes(quarterKey)
        ? calendarConfig.selectedQuarters.filter((q) => q !== quarterKey)
        : [...calendarConfig.selectedQuarters, quarterKey];
      setCalendarConfig({ ...calendarConfig, selectedQuarters: selected });
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
            const quarterKey = `${currentYear}-${quarter}`;
            const isSelected =
              calendarConfig.selectedQuarters.includes(quarterKey);
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
        {calendarConfig.selectedQuarters.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {calendarConfig.selectedQuarters.length} quarter(s) selected
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
      const selected = calendarConfig.selectedYears.includes(year)
        ? calendarConfig.selectedYears.filter((y) => y !== year)
        : [...calendarConfig.selectedYears, year];
      setCalendarConfig({ ...calendarConfig, selectedYears: selected });
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
            const isSelected = calendarConfig.selectedYears.includes(year);
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
        {calendarConfig.selectedYears.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {calendarConfig.selectedYears.length} year(s) selected
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

      {/* Catch-all option for calendar styles */}
      {formData.uiType !== "bars-ordered" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeCatchAll"
              checked={calendarConfig.includeCatchAll}
              onChange={(e) =>
                setCalendarConfig({
                  ...calendarConfig,
                  includeCatchAll: e.target.checked,
                })
              }
              className="w-4 h-4"
            />
            <Label htmlFor="includeCatchAll" className="cursor-pointer">
              Include &quot;catch-all&quot; option
            </Label>
          </div>
          {calendarConfig.includeCatchAll && (
            <Input
              placeholder="Catch-all label (e.g., 'Later or never')"
              value={calendarConfig.catchAllLabel}
              onChange={(e) =>
                setCalendarConfig({
                  ...calendarConfig,
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

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Creating..." : "Create Market"}
      </Button>
    </form>
  );
}
