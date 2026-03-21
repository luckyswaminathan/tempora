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
  Economics: "#4f6b86",
  Politics: "#7a6a82",
  Technology: "#4f7f89",
  Sports: "#8a7462",
  Climate: "#2f8f78",
  General: "#667585",
};

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? "#8b949f";
}
