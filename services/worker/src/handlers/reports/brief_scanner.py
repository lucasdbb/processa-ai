"""Brief Scanner Report Generator via docxtpl template: JSON -> DOCX -> PDF.

Uses a Word template (src/assets/templates/ia/brief_scanner_report.docx) with Jinja2 placeholders.
The template controls all formatting — fonts, colors, logo, layout.
Python only injects the data.

Layout strategy — mixed approach (tables + paragraphs) based on content type:

  HEADER:
    {{ data_analise }}
    {{ tipo_peca }}, {{ area_direito }}
    {{ score_risco }} / 100  ({{ score_label }})
    {{ resumo }}

  SEÇÃO 2 — Teses Frágeis (blocos numerados, texto longo):
    {%p for t in teses_frageis %}
      {{ t.numero }}. {{ t.tese }}
      Fragilidade: {{ t.fragilidade }}
      Risco: {{ t.risco_label }}
      Sugestão: {{ t.sugestao }}
    {%p endfor %}

  SEÇÃO 3 — Pedidos Faltantes (lista simples):
    {%p for p in pedidos_faltantes %}
      {{ p.numero }}. {{ p.descricao }}
      Justificativa: {{ p.justificativa }}
      Sugestão: {{ p.sugestao }}
    {%p endfor %}

  SEÇÃO 4 — Inconsistências (lista simples):
    {%p for i in inconsistencias %}
      {{ i.numero }}. {{ i.descricao }}
      Impacto: {{ i.impacto }}
      Sugestão: {{ i.sugestao }}
    {%p endfor %}

  SEÇÃO 5 — Riscos de Improcedência (blocos numerados, texto longo):
    {%p for r in riscos_improcedencia %}
      {{ r.numero }}. {{ r.risco }}
      Probabilidade: {{ r.probabilidade_label }}
      Pedidos afetados: {{ r.impacto }}
      Mitigação: {{ r.mitigacao }}
    {%p endfor %}

  SEÇÃO 6 — Aspectos Formais (tabela curta — aspecto | status | observação):
    {%tr for a in aspectos_formais %}
      {{ a.aspecto }}  |  {{ a.status_label }}  |  {{ a.observacao }}
    {%tr endfor %}

  SEÇÃO 7 — Oportunidades de Melhoria (lista simples):
    {%p for o in oportunidades_melhoria %}
      {{ o.numero }}. [{{ o.tipo_label }}] {{ o.descricao }}
      Sugestão: {{ o.sugestao }}
    {%p endfor %}

  SEÇÃO 8 — Quadro Resumo (tabela fixa):
    {%tr for q in quadro_resumo %}
      {{ q.categoria }}  |  {{ q.quantidade }}  |  {{ q.severidade }}
    {%tr endfor %}

  Condicionais (para ocultar seções vazias no template):
    {{ tem_teses_frageis }}, {{ tem_pedidos_faltantes }},
    {{ tem_inconsistencias }}, {{ tem_riscos }},
    {{ tem_aspectos_formais }}, {{ tem_oportunidades }},
    {{ tem_quadro_resumo }}
"""

import io
from datetime import datetime
from pathlib import Path

from docxtpl import DocxTemplate

from src.core.logging import logger
from src.handlers.reports.cnis import docx_bytes_to_pdf_bytes

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
TEMPLATE_PATH = ASSETS_DIR / "templates" / "ia" / "brief_scanner_report.docx"

RISCO_LABEL = {
    "alto": "🔴 Alto",
    "medio": "🟡 Médio",
    "baixo": "🟢 Baixo",
}

STATUS_LABEL = {
    "adequado": "✅ Adequado",
    "inadequado": "❌ Inadequado",
    "ausente": "⚠️ Ausente",
}

TIPO_LABEL = {
    "argumento_adicional": "Argumento Adicional",
    "jurisprudencia": "Jurisprudência",
    "reorganizacao": "Reorganização",
    "redacao": "Redação",
}

SEVERIDADE_LABEL = {
    "alto": "🔴 Alto",
    "medio": "🟡 Médio",
    "baixo": "🟢 Baixo",
}


def _score_label(score: int) -> str:
    if score >= 70:
        return "Risco Alto"
    if score >= 40:
        return "Risco Médio"
    return "Risco Baixo"


def _safe_int(value, default: int = 0) -> int:
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def _build_context(dados_analise: dict) -> dict:
    """Build the Jinja2 context dict from the Gemini JSON response."""
    resumo_exec = dados_analise.get("resumo_executivo") or {}

    # --- Teses Frágeis (blocos numerados) ---
    teses_raw = dados_analise.get("teses_frageis") or []
    teses_frageis = []
    for idx, t in enumerate(teses_raw, 1):
        if not isinstance(t, dict):
            continue
        risco = (t.get("risco") or "medio").lower()
        teses_frageis.append({
            "numero": idx,
            "tese": t.get("tese") or "",
            "fragilidade": t.get("fragilidade") or "",
            "risco_label": RISCO_LABEL.get(risco, RISCO_LABEL["medio"]),
            "sugestao": t.get("sugestao") or "",
        })

    # --- Pedidos Faltantes (lista numerada) ---
    pedidos_raw = dados_analise.get("pedidos_faltantes") or []
    pedidos_faltantes = []
    for idx, p in enumerate(pedidos_raw, 1):
        if not isinstance(p, dict):
            continue
        pedidos_faltantes.append({
            "numero": idx,
            "descricao": p.get("descricao") or "",
            "justificativa": p.get("justificativa") or "",
            "sugestao": p.get("sugestao") or "",
        })

    # --- Inconsistências (lista numerada) ---
    inconsistencias_raw = dados_analise.get("inconsistencias") or []
    inconsistencias = []
    for idx, i in enumerate(inconsistencias_raw, 1):
        if not isinstance(i, dict):
            continue
        inconsistencias.append({
            "numero": idx,
            "descricao": i.get("descricao") or "",
            "impacto": i.get("impacto") or "",
            "sugestao": i.get("sugestao") or "",
        })

    # --- Riscos de Improcedência (blocos numerados) ---
    riscos_raw = dados_analise.get("riscos_improcedencia") or []
    riscos_improcedencia = []
    for idx, r in enumerate(riscos_raw, 1):
        if not isinstance(r, dict):
            continue
        prob = (r.get("probabilidade") or "medio").lower()
        riscos_improcedencia.append({
            "numero": idx,
            "risco": r.get("risco") or "",
            "probabilidade_label": RISCO_LABEL.get(prob, RISCO_LABEL["medio"]),
            "impacto": r.get("impacto") or "",
            "mitigacao": r.get("mitigacao") or "",
        })

    # --- Aspectos Formais (tabela — textos curtos) ---
    aspectos_raw = dados_analise.get("aspectos_formais") or []
    aspectos_formais = []
    for a in aspectos_raw:
        if not isinstance(a, dict):
            continue
        st = (a.get("status") or "adequado").lower()
        aspectos_formais.append({
            "aspecto": a.get("aspecto") or "",
            "status_label": STATUS_LABEL.get(st, STATUS_LABEL["adequado"]),
            "observacao": a.get("observacao") or "",
        })

    # --- Oportunidades de Melhoria (lista numerada) ---
    oportunidades_raw = dados_analise.get("oportunidades_melhoria") or []
    oportunidades_melhoria = []
    for idx, o in enumerate(oportunidades_raw, 1):
        if not isinstance(o, dict):
            continue
        tipo = o.get("tipo") or ""
        oportunidades_melhoria.append({
            "numero": idx,
            "descricao": o.get("descricao") or "",
            "tipo_label": TIPO_LABEL.get(tipo, tipo.replace("_", " ").title() if tipo else ""),
            "sugestao": o.get("sugestao") or "",
        })

    # --- Quadro Resumo (tabela fixa) ---
    quadro_raw = dados_analise.get("quadro_resumo") or {}
    quadro_resumo = []
    categorias = [
        ("teses_frageis", "Teses Frágeis"),
        ("pedidos_faltantes", "Pedidos Faltantes"),
        ("inconsistencias", "Inconsistências"),
        ("riscos_improcedencia", "Riscos de Improcedência"),
        ("aspectos_formais", "Aspectos Formais"),
        ("oportunidades", "Oportunidades"),
    ]
    for key, label in categorias:
        item = quadro_raw.get(key) or {}
        if not isinstance(item, dict):
            continue
        qtd = _safe_int(item.get("quantidade"))
        sev_key = (item.get("severidade_maxima") or "").lower()
        sev = SEVERIDADE_LABEL.get(sev_key, "—") if sev_key else "—"
        quadro_resumo.append({
            "categoria": label,
            "quantidade": qtd,
            "severidade": sev,
        })

    score = _safe_int(resumo_exec.get("score_risco"))

    return {
        # Header
        "data_analise": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "tipo_peca": resumo_exec.get("tipo_peca") or "[Não identificado]",
        "area_direito": resumo_exec.get("area_direito") or "[Não identificado]",
        "score_risco": score,
        "score_label": _score_label(score),
        "resumo": resumo_exec.get("resumo") or "",
        # Seções
        "teses_frageis": teses_frageis,
        "pedidos_faltantes": pedidos_faltantes,
        "inconsistencias": inconsistencias,
        "riscos_improcedencia": riscos_improcedencia,
        "aspectos_formais": aspectos_formais,
        "oportunidades_melhoria": oportunidades_melhoria,
        "quadro_resumo": quadro_resumo,
        # Condicionais
        "tem_teses_frageis": bool(teses_frageis),
        "tem_pedidos_faltantes": bool(pedidos_faltantes),
        "tem_inconsistencias": bool(inconsistencias),
        "tem_riscos": bool(riscos_improcedencia),
        "tem_aspectos_formais": bool(aspectos_formais),
        "tem_oportunidades": bool(oportunidades_melhoria),
        "tem_quadro_resumo": bool(quadro_resumo),
    }


def generate_brief_scanner_docx_from_template(dados_analise: dict) -> bytes:
    """Render the Word template with brief scanner data and return DOCX bytes."""
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(
            f"Template não encontrado: {TEMPLATE_PATH}\n"
            "Coloque o arquivo brief_scanner_report.docx em "
            "services/worker/src/assets/templates/ia/"
        )

    tpl = DocxTemplate(str(TEMPLATE_PATH))
    context = _build_context(dados_analise)

    tpl.render(context)

    buf = io.BytesIO()
    tpl.save(buf)
    return buf.getvalue()


def generate_brief_scanner_pdf_from_template(dados_analise: dict) -> bytes:
    """Generate a PDF report from the Gemini brief scanner JSON using the Word template.

    Pipeline: JSON -> DOCX (docxtpl template) -> PDF (LibreOffice headless).

    Args:
        dados_analise: Parsed JSON from Gemini.

    Returns:
        PDF file as bytes.
    """
    docx_bytes = generate_brief_scanner_docx_from_template(dados_analise)
    logger.info("Brief scanner DOCX generated from template: %d bytes", len(docx_bytes))

    pdf_bytes = docx_bytes_to_pdf_bytes(docx_bytes)
    logger.info("Brief scanner PDF generated: %d bytes", len(pdf_bytes))

    return pdf_bytes
