import { API_URL, fetchWithCredentials } from '@/lib/fetch'
import type { AiTool } from './types'
import { FileSearch, FileText, MessageSquare, Mic, Scale, ScanSearch } from 'lucide-react'
import { CnisAnalysisTool } from './components/cnis-analysis-tool'
import { ChatJuridicoTool } from './components/chat-juridico-tool'
import { PromptTool } from './components/prompt-tool'
import { LaborClaimTool } from './components/labor-claim-tool'
import { BriefScannerTool } from './components/brief-scanner-tool'
import { ProcessSummaryTool } from './components/process-summary-tool'
import { AudioTranscriptionTool } from './components/audio-transcription-tool'

// Map variant to component
const COMPONENT_MAP = {
  cnis: CnisAnalysisTool,
  chat: ChatJuridicoTool,
  prompt: PromptTool,
  labor_claim: LaborClaimTool,
  scanner: BriefScannerTool,
  process_summary: ProcessSummaryTool,
  audio_transcription: AudioTranscriptionTool,
} as const

// Map icon name to lucide-react component
const ICON_MAP = {
  FileSearch,
  FileText,
  MessageSquare,
  Mic,
  Scale,
  ScanSearch,
} as const

interface AiToolResponse {
  slug: string
  name: string
  description: string
  icon: string
  variant: string
  locked: boolean
  order: number
}

interface AiToolsListResponse {
  tools: AiToolResponse[]
}

export async function fetchAiTools(): Promise<AiTool[]> {
  try {
    const response = await fetchWithCredentials(`${API_URL}/ai/tools`)

    if (!response.ok) {
      console.error('Failed to fetch AI tools from backend')
      return []
    }

    const data = (await response.json()) as AiToolsListResponse

    return data.tools.map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      description: tool.description,
      icon: ICON_MAP[tool.icon as keyof typeof ICON_MAP] || FileText,
      variant: tool.variant as 'cnis' | 'chat' | 'prompt',
      locked: tool.locked,
      order: tool.order,
      templates: [],
      Component: COMPONENT_MAP[tool.variant as keyof typeof COMPONENT_MAP] || PromptTool,
    }))
  } catch (error) {
    console.error('Error fetching AI tools:', error)
    return []
  }
}
