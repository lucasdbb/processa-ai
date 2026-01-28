import { FileSearch, FileText, MessageSquare } from 'lucide-react'

import type { AiTool } from './types'
import { ChatJuridicoTool } from './components/chat-juridico-tool'
import { CnisAnalysisTool } from './components/cnis-analysis-tool'
import { PromptTool } from './components/prompt-tool'

export const AI_TOOLS: AiTool[] = [
  {
    slug: 'cnis-analysis',
    name: 'Análise de CNIS',
    description: 'Analise vínculos, contribuições e possíveis lacunas no CNIS.',
    icon: FileSearch,
    variant: 'cnis',
    locked: false,
    order: 0,
    templates: [],
    Component: CnisAnalysisTool,
  },
  {
    slug: 'chat',
    name: 'Chat Jurídico',
    description: 'Converse com a IA para tirar dúvidas e estruturar ideias.',
    icon: MessageSquare,
    variant: 'chat',
    locked: true, // TODO: Implementar endpoint no backend
    order: 1,
    templates: [],
    Component: ChatJuridicoTool,
  },
  {
    slug: 'initial-petition',
    name: 'Petição Inicial',
    description: 'Gere uma petição inicial a partir do seu caso.',
    icon: FileText,
    variant: 'prompt',
    locked: true, // TODO: Implementar endpoint no backend
    order: 2,
    templates: [],
    Component: PromptTool,
  },
  {
    slug: 'defense',
    name: 'Contestação / Defesa',
    description: 'Elabore contestações e defesas processuais.',
    icon: MessageSquare,
    variant: 'prompt',
    locked: true, // TODO: Implementar endpoint no backend
    order: 3,
    templates: [],
    Component: PromptTool,
  },
]
