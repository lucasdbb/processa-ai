"""Rescisão Trabalhista Report Generator via docxtpl template: JSON -> DOCX -> PDF.

Uses a Word template (src/assets/templates/calculadoras/rescisao_trabalhista_report.docx).
The template controls all formatting — fonts, colors, layout.
Python only injects the data.

Pipeline: calculation output -> build context -> DOCX (docxtpl) -> PDF (LibreOffice headless).
"""

from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path

from docxtpl import DocxTemplate

from src.core.logging import logger
from src.handlers.reports.cnis import docx_bytes_to_pdf_bytes

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
TEMPLATE_PATH = ASSETS_DIR / "templates" / "calculadoras" / "rescisao_trabalhista_report.docx"

TIPO_RESCISAO_LABELS = {
    "sem_justa_causa": "Sem Justa Causa",
    "por_pedido": "Pedido de Demissão",
    "com_justa_causa": "Com Justa Causa",
    "acordo": "Acordo (art. 484-A CLT)",
    "termino_contrato": "Término de Contrato",
}


def _saldo_dias_label(data_rescisao: object) -> str:
    """Extract day portion from date for saldo de salário detail."""
    s = str(data_rescisao or "")
    if len(s) >= 2:
        return f"{s[-2:]} dias"
    return "dias"


def _money(value: object) -> str:
    """Format a number as Brazilian currency."""
    try:
        v = float(value)
        return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (ValueError, TypeError):
        return "R$ 0,00"


def _build_context(*, input_payload: dict, output_payload: dict) -> dict:
    """Build the Jinja2 context dict from the calculation input/output."""
    detalhes = output_payload.get("detalhes") or {}
    meta = output_payload.get("meta") or {}
    comps = meta.get("remuneracao_composta") or {}

    tipo = meta.get("tipo_rescisao", "")
    dias_trabalhados = meta.get("dias_trabalhados", 0)
    anos = int(dias_trabalhados // 365)
    meses = int((dias_trabalhados % 365) // 30)
    dias = int(dias_trabalhados % 30)

    tempo_parts = []
    if anos > 0:
        tempo_parts.append(f"{anos} ano{'s' if anos != 1 else ''}")
    if meses > 0:
        tempo_parts.append(f"{meses} mes{'es' if meses != 1 else ''}")
    if dias > 0 or not tempo_parts:
        tempo_parts.append(f"{dias} dia{'s' if dias != 1 else ''}")
    tempo_servico = ", ".join(tempo_parts)

    DASH = "—"

    # Composição da remuneração — sempre todas as chaves, DASH quando zero
    val_base = comps.get("base", 0)
    val_peric = comps.get("periculosidade", 0)
    val_insal = comps.get("insalubridade", 0)
    val_not = comps.get("noturno", 0)
    val_horas_extras = comps.get("horas_extras", 0)
    val_outras = comps.get("outras", 0)

    composicao = {
        "salario_base": _money(val_base) if val_base > 0 else DASH,
        "periculosidade": _money(val_peric) if val_peric > 0 else DASH,
        "insalubridade": _money(val_insal) if val_insal > 0 else DASH,
        "noturno": _money(val_not) if val_not > 0 else DASH,
        "horas_extras": _money(val_horas_extras) if val_horas_extras > 0 else DASH,
        "outras_verbas": _money(val_outras) if val_outras > 0 else DASH,
    }

    # Verbas rescisórias — dicionário com todas as chaves, DASH quando zero
    meses_ferias = meta.get("meses_ferias_proporcionais", 0)
    meses_13 = meta.get("meses_13", 0)
    dias_aviso = meta.get("dias_aviso_previo", 0)
    multa_percent = meta.get("multa_fgts_percent", 0)

    saldo_val = detalhes.get("saldo_salario", 0)
    aviso_val = detalhes.get("aviso_previo", 0)
    ferias_venc_val = detalhes.get("ferias_vencidas", 0)
    ferias_prop_val = detalhes.get("ferias_proporcionais", 0)
    decimo_val = detalhes.get("decimo_terceiro", 0)
    fgts_resc_val = detalhes.get("fgts_rescisorio", 0)
    multa_val = detalhes.get("multa_fgts", 0)

    fator = "100%" if tipo != "acordo" else "50%"

    verbas = {
        "saldo_salario": {
            "detalhe": _saldo_dias_label(input_payload.get("data_rescisao"))
            if saldo_val > 0
            else DASH,
            "valor": _money(saldo_val) if saldo_val > 0 else DASH,
        },
        "aviso_previo": {
            "detalhe": f"{dias_aviso} dias ({fator})"
            if aviso_val > 0
            else (f"Desconto de {dias_aviso} dias" if aviso_val < 0 else DASH),
            "valor": _money(aviso_val)
            if aviso_val > 0
            else (f"- {_money(abs(aviso_val))}" if aviso_val < 0 else DASH),
        },
        "ferias_vencidas": {
            "detalhe": f"{input_payload.get('ferias_vencidas', 0)} dias"
            if ferias_venc_val > 0
            else DASH,
            "valor": _money(ferias_venc_val) if ferias_venc_val > 0 else DASH,
        },
        "ferias_proporcionais": {
            "detalhe": f"{meses_ferias}/12 avos" if ferias_prop_val > 0 else DASH,
            "valor": _money(ferias_prop_val) if ferias_prop_val > 0 else DASH,
        },
        "decimo_terceiro": {
            "detalhe": f"{meses_13}/12 avos" if decimo_val > 0 else DASH,
            "valor": _money(decimo_val) if decimo_val > 0 else DASH,
        },
        "fgts_rescisorio": {
            "detalhe": "Sobre saldo + aviso + 13º" if fgts_resc_val > 0 else DASH,
            "valor": _money(fgts_resc_val) if fgts_resc_val > 0 else DASH,
        },
        "multa_fgts": {
            "detalhe": f"Sobre FGTS total ({multa_percent * 100:.0f}%)" if multa_val > 0 else DASH,
            "valor": _money(multa_val) if multa_val > 0 else DASH,
        },
    }

    # FGTS — sempre exibe acumulado, indica se pode sacar
    saque_fgts = meta.get("saque_fgts", True)
    fgts_acumulado_val = float(detalhes.get("fgts_acumulado", 0))
    total_fgts = fgts_acumulado_val + float(fgts_resc_val) + float(multa_val)

    # Descontos (INSS + IRRF) — sempre todas as chaves
    inss_val = float(detalhes.get("inss", 0))
    irrf_val = float(detalhes.get("irrf", 0))
    total_descontos_val = float(detalhes.get("total_descontos", 0))

    descontos = {
        "inss": {
            "detalhe": "Sobre saldo + aviso + 13º",
            "valor": _money(inss_val) if inss_val > 0 else DASH,
        },
        "irrf": {
            "detalhe": "Sobre base tributável",
            "valor": _money(irrf_val) if irrf_val > 0 else DASH,
        },
    }

    # Aviso prévio label
    TIPO_AVISO_LABELS = {
        "indenizado": "Indenizado",
        "trabalhado": "Trabalhado",
        "dispensado": "Dispensado",
        "nao_cumprido": "Não cumprido",
    }
    tipo_aviso = meta.get("tipo_aviso_previo", "dispensado")
    aviso_label = TIPO_AVISO_LABELS.get(tipo_aviso, tipo_aviso)
    if tipo_aviso in ("indenizado", "trabalhado"):
        aviso_previo_label = f"{aviso_label} ({dias_aviso} dias)"
    elif tipo_aviso == "nao_cumprido":
        aviso_previo_label = f"{aviso_label} (desconto de {dias_aviso} dias)"
    else:
        aviso_previo_label = aviso_label

    return {
        "data_calculo": datetime.now().strftime("%d/%m/%Y %H:%M"),
        # Contract data
        "tipo_rescisao_label": TIPO_RESCISAO_LABELS.get(tipo, tipo),
        "data_admissao": datetime.strptime(
            input_payload.get("data_admissao", ""), "%Y-%m-%d"
        ).strftime("%d/%m/%Y"),
        "data_rescisao": datetime.strptime(
            input_payload.get("data_rescisao", ""), "%Y-%m-%d"
        ).strftime("%d/%m/%Y"),
        "tempo_servico": tempo_servico,
        "aviso_previo_label": aviso_previo_label,
        # Salary composition
        "composicao_remuneracao": composicao,
        "remuneracao_bruta": _money(detalhes.get("remuneracao_bruta", 0)),
        # Verbas
        "verbas": verbas,
        "total_bruto": _money(detalhes.get("total_bruto", 0)),
        # Descontos
        "descontos": descontos,
        "total_descontos": _money(total_descontos_val) if total_descontos_val > 0 else DASH,
        # Total líquido
        "total": _money(detalhes.get("total", 0)),
        # FGTS — sempre exibe acumulado
        "saque_fgts": saque_fgts,
        "fgts_acumulado": _money(fgts_acumulado_val),
        "fgts_pode_sacar": "Sim" if saque_fgts else "Não",
        "fgts_rescisorio": _money(fgts_resc_val) if fgts_resc_val > 0 else DASH,
        "multa_fgts_percent": f"{multa_percent * 100:.0f}%",
        "multa_fgts": _money(multa_val) if multa_val > 0 else DASH,
        "total_fgts": _money(total_fgts),
    }


def generate_rescisao_docx_from_template(*, input_payload: dict, output_payload: dict) -> bytes:
    """Render the Word template with rescisao data and return DOCX bytes."""
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(
            f"Template não encontrado: {TEMPLATE_PATH}\n"
            "Coloque o arquivo rescisao_trabalhista_report.docx em "
            "services/worker/src/assets/templates/calculadoras/"
        )

    tpl = DocxTemplate(str(TEMPLATE_PATH))
    context = _build_context(input_payload=input_payload, output_payload=output_payload)

    tpl.render(context)

    buf = io.BytesIO()
    tpl.save(buf)
    return buf.getvalue()


def generate_rescisao_pdf_from_template(*, input_payload: dict, output_payload: dict) -> bytes:
    """Generate a PDF report from the rescisao calculation data using the Word template.

    Pipeline: calculation data -> DOCX (docxtpl template) -> PDF (LibreOffice headless).

    Returns:
        PDF file as bytes.
    """
    docx_bytes = generate_rescisao_docx_from_template(
        input_payload=input_payload, output_payload=output_payload
    )
    logger.info("Rescisão DOCX generated from template: %d bytes", len(docx_bytes))

    pdf_bytes = docx_bytes_to_pdf_bytes(docx_bytes)
    logger.info("Rescisão PDF generated: %d bytes", len(pdf_bytes))

    return pdf_bytes
