# Backlog de Produto - 90 Dias (Visão do Advogado)

Data: 06/04/2026
Escopo: consolidar operação jurídica + IA + portal do cliente com foco em produtividade, qualidade de entrega e percepção de valor.

## 1. Objetivo do Ciclo

Transformar o Processa AI de "ferramenta que gera documentos" para "fluxo profissional completo de trabalho jurídico", cobrindo:

- produção editável,
- revisão guiada,
- versionamento,
- publicação final,
- comunicação estruturada com cliente.

## 2. North Star e KPIs

North Star Metric:
- Percentual de casos com fluxo completo (gerar -> revisar -> finalizar -> compartilhar) >= 45% dos casos ativos em 90 dias.

KPIs primários:
- Taxa de uso de exportação editável (DOCX) >= 35% dos documentos de IA.
- Taxa de finalização documental (rascunho -> final) >= 60%.
- Tempo médio para primeira versão útil da peça: reduzir em 30%.
- Tickets de suporte sobre "como editar" e "onde está versão final": reduzir em 25%.
- Uso mensal do portal pelo cliente final: +30% MAU.

KPIs secundários:
- Conversão Free -> Pago em usuários que usam workflow documental: +15%.
- Churn de planos pagos: reduzir em 10%.
- NPS de "confiança no documento gerado": +12 pontos.

## 3. Critérios de Priorização

Priorização por impacto no advogado:

1. Reduz risco jurídico (qualidade, rastreabilidade, revisão).
2. Reduz retrabalho (editabilidade, templates, versões).
3. Aumenta eficiência operacional (automação de fluxo).
4. Melhora experiência do cliente final (portal).
5. Aumenta receita/retenção (diferenciação clara de plano).

## 4. Roadmap de 90 Dias (6 Sprints)

- Sprint 1-2: Fundação documental e exportação editável.
- Sprint 3-4: Workflow jurídico de revisão e governança.
- Sprint 5-6: Portal ativo, visibilidade de valor e inteligência de negócio.

---

## 5. Épico A - Exportação Dual (PDF + DOCX) e Artefatos de Conferência

Problema:
- PDF é ótimo para compartilhar, mas ruim para ajuste final da peça pelo advogado.

Objetivo:
- Entregar saída em formato de apresentação (PDF) e de trabalho (DOCX), com opção de exportação numérica quando aplicável (XLSX/CSV em calculadoras).

Entregas:
- Botão de download com opções:
  - Baixar PDF.
  - Baixar DOCX (versão editável).
- Para calculadoras:
  - Baixar PDF (laudo).
  - Baixar CSV/XLSX (memória de cálculo).
- Metadados do documento:
  - tipo_arquivo,
  - versao_origem,
  - hash,
  - data de geração.

Histórias:
- Como advogado, quero baixar a versão DOCX da análise para adaptar argumentos antes do protocolo.
- Como advogado, quero exportar memória de cálculo para auditoria e conferência.

Critérios de aceite:
- Em todas as ferramentas IA de peça/relatório, o usuário consegue baixar PDF e DOCX.
- Em calculadoras priorizadas, o usuário consegue baixar PDF e CSV/XLSX.
- Download com nome padrão consistente: tipo + cliente + data.

Esforço: M
Impacto: Alto
Prioridade: P0

---

## 6. Épico B - Workflow Documental (Rascunho -> Revisão -> Final)

Problema:
- Hoje existe gestão de documentos, mas sem ciclo robusto de qualidade e governança documental.

Objetivo:
- Criar trilha profissional de documento jurídico com estados, versões e responsabilidade.

Entregas:
- Estados formais:
  - rascunho,
  - em revisão,
  - final,
  - arquivado.
- Controle de versões:
  - V1, V2, V3...
  - diff básico entre versões (texto).
- Ações de workflow:
  - solicitar revisão,
  - aprovar,
  - marcar como final,
  - voltar para rascunho.
- Campos obrigatórios para finalização:
  - responsável,
  - data,
  - checklist mínimo (fundamentação, pedidos, revisão factual).

Histórias:
- Como advogado, quero versionar a peça para rastrear alterações e reduzir risco.
- Como sócio, quero saber quem aprovou a versão final.

Critérios de aceite:
- Documento não pode ser "final" sem checklist completo.
- Histórico de versões visível em tela de documento.
- Toda mudança de status gera evento em timeline/auditoria.

Esforço: L
Impacto: Muito Alto
Prioridade: P0

---

## 7. Épico C - Revisão Jurídica Guiada por IA (Pre-Protocolo)

Problema:
- Gerar texto não basta; falta etapa estruturada de revisão jurídica antes de protocolar.

Objetivo:
- Reduzir erro e elevar confiança com um "modo revisão" orientado a risco.

Entregas:
- Modo Revisão na tela de resultado:
  - inconsistências factuais,
  - pedidos faltantes,
  - fragilidade argumentativa,
  - alertas de prazo e rito,
  - sugestões de reforço (jurisprudência/legislação).
- Checklist pré-protocolo:
  - identificar partes,
  - validar pedidos,
  - revisar valores,
  - confirmar rito.
- Score de prontidão para protocolo (0-100).

Histórias:
- Como advogado, quero validar qualidade da peça antes de fechar a versão final.
- Como advogado júnior, quero orientação objetiva sobre o que ainda falta revisar.

Critérios de aceite:
- Toda peça de IA tem opção "Revisar antes de finalizar".
- Revisão retorna itens acionáveis e não apenas texto genérico.
- Usuário pode marcar item como resolvido e recalcular score.

Esforço: M
Impacto: Alto
Prioridade: P1

---

## 8. Épico D - Portal Ativo (Comunicação Cliente-Escritório)

Problema:
- Portal read-only é bom para transparência, mas falta canal estruturado de interação.

Objetivo:
- Diminuir ruído operacional (WhatsApp disperso) e aumentar valor percebido pelo cliente.

Entregas:
- Mensageria simples por processo:
  - advogado -> cliente,
  - cliente -> advogado,
  - status (lido/não lido).
- Solicitar documentos ao cliente (checklist com prazo).
- Confirmação de leitura de atualizações relevantes.
- Notificações no portal para eventos críticos.

Histórias:
- Como advogado, quero solicitar documentos pendentes sem sair do sistema.
- Como cliente, quero entender o que preciso enviar e até quando.

Critérios de aceite:
- Cliente consegue responder solicitação e anexar documento.
- Advogado acompanha pendências por cliente/processo.
- Reduzir em 20% contato operacional fora do portal (meta inicial).

Esforço: L
Impacto: Alto
Prioridade: P1

---

## 9. Épico E - Visibilidade de Custo e ROI por Caso

Problema:
- Créditos existem, mas sem visão clara de custo/benefício por cliente ou processo.

Objetivo:
- Tornar o valor econômico da IA explícito para melhorar decisão, precificação e retenção.

Entregas:
- Painel por caso/processo:
  - créditos consumidos,
  - ferramentas usadas,
  - estimativa de tempo economizado.
- Painel por cliente:
  - custo de produção vs honorários previstos/recebidos.
- Alertas de consumo anormal.

Histórias:
- Como advogado, quero saber se o uso de IA naquele caso está dando retorno.
- Como gestor, quero controlar margem por tipo de serviço.

Critérios de aceite:
- Indicadores por processo disponíveis na tela de detalhe.
- Relatório mensal de consumo por cliente exportável.

Esforço: M
Impacto: Alto
Prioridade: P1

---

## 10. Épico F - Colaboração Interna e Permissões (Base)

Problema:
- Escalabilidade de escritório exige papéis internos e governança de acesso.

Objetivo:
- Preparar base para operação com equipe (sócio, associado, estagiário, administrativo).

Entregas:
- Perfis de acesso com escopo por módulo.
- Permissão por ação crítica (excluir, finalizar, aprovar).
- Trilha de auditoria de ações sensíveis.

Histórias:
- Como sócio, quero restringir quem pode finalizar/excluir documentos.

Critérios de aceite:
- Matriz mínima de permissões aplicada em documentos/processos.
- Auditoria visível em eventos de alteração crítica.

Esforço: L
Impacto: Médio-Alto
Prioridade: P2

---

## 11. Planejamento por Sprint

Sprint 1 (Semanas 1-2):
- Épico A (parcial): download DOCX em 2 ferramentas IA prioritárias.
- Definição de contrato de metadados/documentos.
- Telemetria de uso de exportação por formato.

Sprint 2 (Semanas 3-4):
- Épico A (completo): PDF+DOCX em todas as ferramentas de relatório.
- CSV/XLSX para calculadora de rescisão.
- Padrão de nome e versionamento inicial de arquivo.

Sprint 3 (Semanas 5-6):
- Épico B (fase 1): estados documentais + transições.
- Histórico de eventos de status.
- Checklist mínimo para marcar final.

Sprint 4 (Semanas 7-8):
- Épico B (fase 2): versões e diff textual básico.
- Épico C (fase 1): modo revisão com alertas principais.

Sprint 5 (Semanas 9-10):
- Épico C (fase 2): score de prontidão + checklist resolúvel.
- Épico D (fase 1): mensageria simples e solicitação de documentos.

Sprint 6 (Semanas 11-12):
- Épico D (fase 2): notificações e confirmação de leitura.
- Épico E (fase 1): dashboard custo/ROI por processo.
- Ajustes finais por métricas de adoção.

## 12. Dependências Técnicas

- Ajustes de schema para versão documental e trilha de auditoria.
- Exposição de artefato DOCX no pipeline do worker (além de PDF).
- Ajustes no módulo de documentos para multi-formato por item.
- Instrumentação de analytics de funil documental.
- Validação de retenção e política de armazenamento por formato.

## 13. Riscos e Mitigações

Risco: aumentar complexidade da UX com muitos estados.
Mitigação: UX progressiva, defaults simples, labels jurídicas claras.

Risco: custo operacional de armazenamento (PDF + DOCX + anexos).
Mitigação: política de retenção por plano, compressão e limpeza automática.

Risco: baixa adoção da revisão guiada.
Mitigação: tornar revisão parte natural do fluxo antes de "finalizar".

Risco: escopo excessivo em 90 dias.
Mitigação: foco em P0/P1; P2 apenas fundação.

## 14. Out of Scope (Neste Ciclo)

- Assinatura eletrônica completa com ICP-Brasil.
- Integrações profundas com todos os tribunais além do que já existe.
- CRM comercial completo (pipeline de leads).
- Motor avançado de preditividade processual com base massiva externa.

## 15. Definição de Sucesso em 90 Dias

O ciclo será considerado bem-sucedido se:

- exportação editável estiver consolidada,
- workflow documental tiver governança mínima implantada,
- revisão jurídica guiada estiver em produção,
- portal tiver interação ativa,
- e os principais KPIs mostrarem ganho de eficiência e retenção.
