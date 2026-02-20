import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export const FunctionalityType = {
  AI: "ai",
  CALCULATOR: "calculator",
  OFFICE: "office",
  BLOG: "blog"
} as const;

export type FunctionalityType = typeof FunctionalityType[keyof typeof FunctionalityType];

export type ToolVariant = "chat" | "prompt" | "cnis" | "labor_claim" | "scanner" | "process_summary";

export type ToolTemplate = {
  label: string;
  prompt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type AiTool = {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  variant: ToolVariant;
  locked: boolean;
  order: number;
  templates: ToolTemplate[];
  Component: ComponentType<any>;
};
