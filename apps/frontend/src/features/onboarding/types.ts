import type { ReactNode } from "react";

export interface TourStep {
  selector: string;
  content: ReactNode;
  action?: () => void;
  placement?: "auto" | "center" | "top" | "right" | "bottom" | "left";
  spotlightPadding?: number;
  offset?: number;
}

export type TourId =
  | "welcome"
  | "dashboard"
  | "clients"
  | "processes"
  | "calculators"
  | "ai-tools";

export interface TourConfig {
  id: TourId;
  steps: TourStep[];
}
