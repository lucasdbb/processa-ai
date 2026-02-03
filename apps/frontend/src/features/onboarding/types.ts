import type { ReactNode } from "react";

export interface TourStep {
  selector: string;
  content: ReactNode;
  action?: () => void;
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
