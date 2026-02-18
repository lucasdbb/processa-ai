import type { ChangeEvent, ComponentType, RefObject } from "react";
import type { LucideIcon } from "lucide-react";

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

export type ToolComponentProps = {
  prompt: string;
  setPrompt: (next: string) => void;
  promptTextareaRef: RefObject<HTMLTextAreaElement | null>;
  resizePromptTextarea: () => void;
  isGenerating: boolean;
  progress: number;
  onGenerate: () => void;

  cnisFile: File | null;
  cnisFileInputKey: number;
  onCnisFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearCnisFile: () => void;

  files: File[];
  onFilesChange: (files: File[]) => void;
  onRemoveFile: (index: number) => void;

  generatedText: string;
  previewHtml: string;
  generatedPdfUrl: string;
  onDownload: () => void;

  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (next: string) => void;
  isChatLoading: boolean;
  onSendChatMessage: () => void;
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
  Component: ComponentType<ToolComponentProps>;
};
