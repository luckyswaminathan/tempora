import { ReactNode } from "react";

export interface SecurityPickerOutcome {
  id: string;
  outcome: string;
  probability: number;
  quantityTraded?: number;
  value: number;
  isCatchAll: boolean;
}

export interface SecurityPickerProps {
  outcomes: SecurityPickerOutcome[];
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
  handleCellClick: (index: number) => void;
  isInRange: (index: number) => boolean;
  onRangeChange?: (range: [number, number]) => void;
  winningSecurityId?: string;
  readOnly?: boolean;
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="px-2 py-1 rounded-full bg-white/60 backdrop-blur text-black text-xs font-semibold shadow-md">
      {children}
    </span>
  );
}
