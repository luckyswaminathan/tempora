"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { categoryColor } from "@/lib/utils";

interface MarketFiltersProps {
  category?: string | null;
  onCategoryChange: (category: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  status?: string | null;
  onStatusChange: (status: string | null) => void;
}

const CATEGORIES = [
  "All",
  "Economics",
  "Politics",
  "Technology",
  "Sports",
  "Climate",
  "General",
];
const STATUSES = [
  { value: null, label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "Any Status" },
];

export function MarketFilters({
  category,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  status,
  onStatusChange,
}: MarketFiltersProps) {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1" id="dashboard-search">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search markets..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div
          className="flex gap-2 overflow-x-auto"
          id="dashboard-status-filters"
        >
          {STATUSES.map((st) => (
            <Button
              key={st.label}
              variant={
                status === st.value || (!status && st.value === null)
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => onStatusChange(st.value)}
            >
              {st.label}
            </Button>
          ))}
        </div>
      </div>
      <div
        className="flex gap-2 overflow-x-auto"
        id="dashboard-category-filters"
      >
        <span className="text-sm text-muted-foreground flex items-center mr-2">
          Category:
        </span>
        {CATEGORIES.map((cat) => {
          const isActive = category === cat || (cat === "All" && !category);
          const color = cat === "All" ? undefined : categoryColor(cat);
          return (
            <Button
              key={cat}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange(cat === "All" ? null : cat)}
              className={
                color
                  ? isActive
                    ? "hover:opacity-75 transition-opacity"
                    : "hover:!bg-transparent hover:opacity-75 transition-opacity"
                  : ""
              }
              style={
                isActive && color
                  ? {
                      backgroundColor: color,
                      borderColor: color,
                      color: "#fff",
                    }
                  : !isActive && color
                    ? { borderColor: color, color: color }
                    : undefined
              }
            >
              {cat}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
