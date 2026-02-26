import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

// Fixed category → hex color mapping, consistent across pie charts and badges.
export const CATEGORY_COLORS: Record<string, string> = {
  Economics: "#2563eb",
  Politics: "#e11d48",
  Technology: "#7c3aed",
  Sports: "#ea580c",
  Climate: "#16a34a",
  General: "#64748b",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#94a3b8";
}
