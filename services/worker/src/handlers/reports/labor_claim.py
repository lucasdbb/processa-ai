"""Labor Claim Report Generator via docxtpl template: JSON -> DOCX -> PDF.

Uses a Word template (src/assets/templates/ia/labor_claim_report.docx) with Jinja2 placeholders.
The template controls all formatting — fonts, colors, logo, layout.
Python only injects the data.

Layout strategy — mixed approach (paragraphs + tables) based on content type:

  HEADER:
    {{ data_analise }}
    Reclamação Trabalhista - {{ reclamante_nome }}
    Valor da Causa: R$ {{ valor_total_causa_formatted }}

  SEÇÃO 1 — Qualificação das Partes (tabela simples):
    Reclamante: {{ reclamante.nome_completo }}, CPF: {{ reclamante.cpf }}
    Reclamado: {{ reclamado.razao_social }}, CNPJ: {{ reclamado.cnpj }}

  SEÇÃO 2 — Resumo Executivo (parágrafo):
    {{ resumo_executivo }}

  SEÇÃO 3 — Histórico Laboral (lista cronológica):
    {%p for h in historico_laboral %}
      {{ h.data }}: {{ h.fato }}
      Comprovação: {{ h.comprovacao }}
    {%p endfor %}

  SEÇÃO 4 — Análise dos Documentos (blocos):
    {%p for d in analise_documentos %}
      [{{ d.tipo }}]
      {{ d.conteudo_relevante }}
      Achados: {{ d.achados_criticos }}
    {%p endfor %}

  SEÇÃO 5 — Verbas a Reclamar (tabela — verba | período | valor):
    {%tr for v in verbas_reclamar %}
      {{ v.nome_verba }} | {{ v.periodo }} | R$ {{ v.valor_total_formatted }}
    {%tr endfor %}

  SEÇÃO 6 — Teses Jurídicas (lista numerada):
    {%p for t in teses_juridicas %}
      {{ t.numero }}. {{ t.tese }}
      Legislação: {{ t.legislacao }}
      Suporte: {{ t.suporte_documental }}
      Solidez: {{ t.solidez_label }}
    {%p endfor %}

  SEÇÃO 7 — Riscos e Contrapontos (lista numerada):
    {%p for r in riscos_contrapontos %}
      {{ r.numero }}. Risco: {{ r.risco }}
      Impacto: {{ r.impacto }}
      Mitigação: {{ r.mitigacao }}
    {%p endfor %}

  SEÇÃO 8 — Pedidos (lista numerada):
    {%p for p in pedidos %}
      {{ p.numero }}. {{ p.pedido }}
      Valor: R$ {{ p.valor_estimado_formatted }}
      Fundamento: {{ p.fundamento }}
    {%p endfor %}

  SEÇÃO 9 — Resumo de Verbas (tabela simples):
    Total de Verbas: R$ {{ valor_verbas_total_formatted }}
    Valor da Causa: R$ {{ valor_total_causa_formatted }}

  Condicionais (para ocultar seções vazias):
    {{ tem_historico }}, {{ tem_documentos }},
    {{ tem_verbas }}, {{ tem_teses }},
    {{ tem_riscos }}, {{ tem_pedidos }}
"""

import io
from datetime import datetime
from pathlib import Path

from docxtpl import DocxTemplate

from src.core.logging import logger
from src.handlers.reports.cnis import docx_bytes_to_pdf_bytes

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
TEMPLATE_PATH = ASSETS_DIR / "templates" / "ia" / "labor_claim_report.docx"

SOLIDEZ_LABEL = {
    "forte": "Forte",
    "media": "Média",
    "fraca": "Fraca",
}


def _safe_float(value, default: float = 0.0) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def _safe_int(value, default: int = 0) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _format_currency(value: float) -> str:
    """Format value as Brazilian currency."""
    return f"{value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def _build_context(dados_analise: dict) -> dict:
    """Build the Jinja2 context dict from the Gemini JSON response."""
    qualificacao = dados_analise.get("qualificacao_partes") or {}
    reclamante = qualificacao.get("reclamante") or {}
    reclamado = qualificacao.get("reclamado") or {}

    # --- Histórico Laboral ---
    historico_raw = dados_analise.get("historico_laboral") or []
    historico_laboral = []
    for idx, h in enumerate(historico_raw, 1):
        if isinstance(h, dict):
            historico_laboral.append(
                {
                    "numero": idx,
                    "data": h.get("data") or "",
                    "fato": h.get("fato") or "",
                    "comprovacao": h.get("comprovacao") or "",
                }
            )

    # --- Análise de Documentos ---
    documentos_raw = dados_analise.get("analise_documentos") or []
    analise_documentos = []
    for idx, d in enumerate(documentos_raw, 1):
        if isinstance(d, dict):
            analise_documentos.append(
                {
                    "numero": idx,
                    "tipo": d.get("tipo") or "",
                    "conteudo_relevante": d.get("conteudo_relevante") or "",
                    "achados_criticos": d.get("achados_criticos") or "",
                }
            )

    # --- Verbas a Reclamar (com cálculos formatados) ---
    verbas_raw = dados_analise.get("verbas_reclamar") or []
    verbas_reclamar = []
    valor_verbas_total = 0.0
    for idx, v in enumerate(verbas_raw, 1):
        if isinstance(v, dict):
            valor_total = _safe_float(v.get("valor_total"))
            valor_verbas_total += valor_total
            verbas_reclamar.append(
                {
                    "numero": idx,
                    "nome_verba": v.get("nome_verba") or "",
                    "periodo": v.get("periodo") or "",
                    "calculo": v.get("calculo") or "",
                    "valor_mensal": _safe_float(v.get("valor_mensal")),
                    "valor_mensal_formatted": _format_currency(_safe_float(v.get("valor_mensal"))),
                    "quantidade_meses": _safe_int(v.get("quantidade_meses")),
                    "valor_total": valor_total,
                    "valor_total_formatted": _format_currency(valor_total),
                    "fundamento_legal": v.get("fundamento_legal") or "",
                    "status": v.get("status") or "",
                }
            )

    # --- Teses Jurídicas ---
    teses_raw = dados_analise.get("teses_juridicas") or []
    teses_juridicas = []
    for idx, t in enumerate(teses_raw, 1):
        if isinstance(t, dict):
            solidez = (t.get("solidez") or "media").lower()
            teses_juridicas.append(
                {
                    "numero": idx,
                    "tese": t.get("tese") or "",
                    "legislacao": t.get("legislacao") or "",
                    "suporte_documental": t.get("suporte_documental") or "",
                    "solidez": solidez,
                    "solidez_label": SOLIDEZ_LABEL.get(solidez, SOLIDEZ_LABEL["media"]),
                }
            )

    # --- Riscos e Contrapontos ---
    riscos_raw = dados_analise.get("riscos_contrapontos") or []
    riscos_contrapontos = []
    for idx, r in enumerate(riscos_raw, 1):
        if isinstance(r, dict):
            riscos_contrapontos.append(
                {
                    "numero": idx,
                    "risco": r.get("risco") or "",
                    "impacto": r.get("impacto") or "",
                    "mitigacao": r.get("mitigacao") or "",
                }
            )

    # --- Pedidos ---
    pedidos_raw = dados_analise.get("pedidos") or []
    pedidos = []
    valor_pedidos_total = 0.0
    for p in pedidos_raw:
        if isinstance(p, dict):
            valor = _safe_float(p.get("valor_estimado"))
            valor_pedidos_total += valor
            pedidos.append(
                {
                    "numero": p.get("numero") or len(pedidos) + 1,
                    "pedido": p.get("pedido") or "",
                    "valor_estimado": valor,
                    "valor_estimado_formatted": _format_currency(valor),
                    "fundamento": p.get("fundamento") or "",
                }
            )

    # Usar valor_total_causa se disponível, senão somar pedidos
    valor_causa = _safe_float(dados_analise.get("valor_total_causa"))
    if valor_causa <= 0:
        valor_causa = valor_pedidos_total

    return {
        # Header
        "data_analise": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "reclamante_nome": reclamante.get("nome_completo") or "[Não identificado]",
        "reclamante_cpf": reclamante.get("cpf") or "",
        "reclamante_cargo": reclamante.get("cargo") or "",
        "reclamante_periodo": f"{reclamante.get('periodo_trabalho', {}).get('admissao', '')} a {reclamante.get('periodo_trabalho', {}).get('fim', '')}",
        "reclamado_razao_social": reclamado.get("razao_social") or "[Não identificado]",
        "reclamado_cnpj": reclamado.get("cnpj") or "",
        # Qualificação completa
        "reclamante": reclamante,
        "reclamado": reclamado,
        # Conteúdo
        "resumo_executivo": dados_analise.get("resumo_executivo") or "",
        "historico_laboral": historico_laboral,
        "analise_documentos": analise_documentos,
        "verbas_reclamar": verbas_reclamar,
        "teses_juridicas": teses_juridicas,
        "riscos_contrapontos": riscos_contrapontos,
        "pedidos": pedidos,
        # Totais e formatação
        "valor_verbas_total": valor_verbas_total,
        "valor_verbas_total_formatted": _format_currency(valor_verbas_total),
        "valor_total_causa": valor_causa,
        "valor_total_causa_formatted": _format_currency(valor_causa),
        # Condicionais
        "tem_historico": bool(historico_laboral),
        "tem_documentos": bool(analise_documentos),
        "tem_verbas": bool(verbas_reclamar),
        "tem_teses": bool(teses_juridicas),
        "tem_riscos": bool(riscos_contrapontos),
        "tem_pedidos": bool(pedidos),
    }


def generate_labor_claim_docx_from_template(dados_analise: dict) -> bytes:
    """Render the Word template with labor claim data and return DOCX bytes."""
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(
            f"Labor Claim template not found at {TEMPLATE_PATH}. "
            "Create the template at services/worker/src/assets/templates/ia/labor_claim_report.docx"
        )

    context = _build_context(dados_analise)

    try:
        template = DocxTemplate(str(TEMPLATE_PATH))
        template.render(context)
        docx_buffer = io.BytesIO()
        template.save(docx_buffer)
        docx_buffer.seek(0)
        return docx_buffer.read()
    except Exception as e:
        logger.error(f"Error rendering Labor Claim template: {e}", exc_info=True)
        raise


def generate_labor_claim_pdf_from_template(dados_analise: dict) -> bytes:
    """Generate PDF from Labor Claim template.

    Pipeline:
        1. Render DOCX from template
        2. Convert DOCX to PDF via LibreOffice
        3. Return PDF bytes
    """
    docx_bytes = generate_labor_claim_docx_from_template(dados_analise)
    pdf_bytes = docx_bytes_to_pdf_bytes(docx_bytes)
    return pdf_bytes
