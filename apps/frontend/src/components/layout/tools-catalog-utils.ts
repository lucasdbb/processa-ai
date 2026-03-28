import { dashboardService } from '@/services/dashboard-service'
import type { AiToolRaw, CalculatorRaw } from '@/services/dashboard-service'
import type { AiTool } from '@/features/ai/types'
import type { CalculatorItem } from '@/features/calculators/api'
import {
  FileSearch,
  FileText,
  MessageSquare,
  Mic,
  Scale,
  ScanSearch,
  Calculator as CalculatorIcon,
  CalendarClock,
  TrendingUp,
  DollarSign,
  Percent,
  type LucideIcon,
} from 'lucide-react'
import { CnisAnalysisTool } from '@/features/ai/components/cnis-analysis-tool'
import { ChatJuridicoTool } from '@/features/ai/components/chat-juridico-tool'
import { PromptTool } from '@/features/ai/components/prompt-tool'
import { LaborClaimTool } from '@/features/ai/components/labor-claim-tool'
import { BriefScannerTool } from '@/features/ai/components/brief-scanner-tool'
import { ProcessSummaryTool } from '@/features/ai/components/process-summary-tool'
import { AudioTranscriptionTool } from '@/features/ai/components/audio-transcription-tool'

const AI_COMPONENT_MAP = {
  cnis: CnisAnalysisTool,
  chat: ChatJuridicoTool,
  prompt: PromptTool,
  labor_claim: LaborClaimTool,
  scanner: BriefScannerTool,
  process_summary: ProcessSummaryTool,
  audio_transcription: AudioTranscriptionTool,
} as const

const AI_ICON_MAP: Record<string, LucideIcon> = {
  FileSearch,
  FileText,
  MessageSquare,
  Mic,
  Scale,
  ScanSearch,
}

const CALC_ICON_MAP: Record<string, LucideIcon> = {
  Calculator: CalculatorIcon,
  CalendarClock,
  TrendingUp,
  DollarSign,
  Percent,
}

export function mapAiToolRaw(tool: AiToolRaw): AiTool {
  return {
    slug: tool.slug,
    name: tool.name,
    description: tool.description,
    icon: AI_ICON_MAP[tool.icon] || FileText,
    variant: tool.variant as AiTool['variant'],
    locked: tool.locked,
    order: tool.order,
    templates: [],
    Component: AI_COMPONENT_MAP[tool.variant as keyof typeof AI_COMPONENT_MAP] || PromptTool,
  }
}

export function mapCalculatorRaw(calc: CalculatorRaw): CalculatorItem {
  return {
    slug: calc.slug,
    name: calc.name,
    description: calc.description,
    icon: CALC_ICON_MAP[calc.icon] || CalculatorIcon,
    path: calc.path,
    locked: calc.locked,
    order: calc.order,
  }
}

let _catalogPromise: Promise<{ aiTools: AiTool[]; calculators: CalculatorItem[] }> | null = null

export function fetchToolsCatalog(): Promise<{ aiTools: AiTool[]; calculators: CalculatorItem[] }> {
  if (!_catalogPromise) {
    _catalogPromise = dashboardService
      .getToolsCatalog()
      .then((catalog) => ({
        aiTools: catalog.ai_tools.map(mapAiToolRaw),
        calculators: catalog.calculators.map(mapCalculatorRaw),
      }))
      .catch((err) => {
        _catalogPromise = null
        throw err
      })
  }
  return _catalogPromise
}
