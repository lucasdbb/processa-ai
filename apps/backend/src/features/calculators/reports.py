"""Rescisão Trabalhista Report Generator via docxtpl template: JSON -> DOCX -> PDF.

Uses a Word template (templates/rescisao_trabalhista_report.docx) with Jinja2 placeholders.
The template controls all formatting — fonts, colors, layout.
Python only injects the data.

Pipeline: calculation output -> build context -> DOCX (docxtpl) -> PDF (LibreOffice headless).
"""

from __future__ import annotations

import io
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from docxtpl import DocxTemplate

from src.core.logging import logger

TEMPLATE_PATH = Path(__file__).resolve().parent / "templates" / "rescisao_trabalhista_report.docx"

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

    # Composição da remuneração
    composicao = []
    composicao.append({"componente": "Salário Base", "valor": _money(comps.get("base", 0))})
    if comps.get("periculosidade", 0) > 0:
        composicao.append({
            "componente": "Adicional de Periculosidade (30%)",
            "valor": _money(comps["periculosidade"]),
        })
    if comps.get("insalubridade", 0) > 0:
        composicao.append({
            "componente": "Adicional de Insalubridade",
            "valor": _money(comps["insalubridade"]),
        })
    if comps.get("noturno", 0) > 0:
        composicao.append({
            "componente": "Adicional Noturno",
            "valor": _money(comps["noturno"]),
        })
    if comps.get("outras", 0) > 0:
        composicao.append({
            "componente": "Outras Verbas",
            "valor": _money(comps["outras"]),
        })

    # Verbas rescisórias
    verbas = []
    meses_ferias = meta.get("meses_ferias_proporcionais", 0)
    meses_13 = meta.get("meses_13", 0)
    dias_aviso = meta.get("dias_aviso_previo", 0)

    if detalhes.get("saldo_salario", 0) > 0:
        verbas.append({
            "nome": "Saldo de Salário",
            "detalhe": _saldo_dias_label(input_payload.get("data_rescisao")),
            "valor": _money(detalhes["saldo_salario"]),
        })

    if detalhes.get("aviso_previo", 0) > 0:
        fator = "100%" if tipo != "acordo" else "50%"
        verbas.append({
            "nome": "Aviso Prévio Indenizado",
            "detalhe": f"{dias_aviso} dias ({fator})",
            "valor": _money(detalhes["aviso_previo"]),
        })

    if detalhes.get("ferias_vencidas", 0) > 0:
        verbas.append({
            "nome": "Férias Vencidas + 1/3",
            "detalhe": f"{input_payload.get('ferias_vencidas', 0)} dias",
            "valor": _money(detalhes["ferias_vencidas"]),
        })

    if detalhes.get("ferias_proporcionais", 0) > 0:
        verbas.append({
            "nome": "Férias Proporcionais + 1/3",
            "detalhe": f"{meses_ferias}/12 avos",
            "valor": _money(detalhes["ferias_proporcionais"]),
        })

    if detalhes.get("decimo_terceiro", 0) > 0:
        verbas.append({
            "nome": "13º Salário Proporcional",
            "detalhe": f"{meses_13}/12 avos",
            "valor": _money(detalhes["decimo_terceiro"]),
        })

    if detalhes.get("fgts_rescisorio", 0) > 0:
        verbas.append({
            "nome": "FGTS Rescisório (8%)",
            "detalhe": "Sobre saldo + aviso + 13º",
            "valor": _money(detalhes["fgts_rescisorio"]),
        })

    multa_percent = meta.get("multa_fgts_percent", 0)
    if detalhes.get("multa_fgts", 0) > 0:
        verbas.append({
            "nome": f"Multa FGTS ({multa_percent * 100:.0f}%)",
            "detalhe": "Sobre FGTS total",
            "valor": _money(detalhes["multa_fgts"]),
        })

    # FGTS details
    total_fgts = (
        float(detalhes.get("fgts", 0))
        + float(detalhes.get("fgts_rescisorio", 0))
        + float(detalhes.get("multa_fgts", 0))
    )

    aviso_previo_label = "Não"
    if dias_aviso > 0:
        aviso_previo_label = f"Sim ({dias_aviso} dias)"

    return {
        "data_calculo": datetime.now().strftime("%d/%m/%Y %H:%M"),
        # Contract data
        "tipo_rescisao_label": TIPO_RESCISAO_LABELS.get(tipo, tipo),
        "data_admissao": str(input_payload.get("data_admissao", "")),
        "data_rescisao": str(input_payload.get("data_rescisao", "")),
        "tempo_servico": tempo_servico,
        "aviso_previo_label": aviso_previo_label,
        # Salary composition
        "composicao_remuneracao": composicao,
        "remuneracao_bruta": _money(detalhes.get("remuneracao_bruta", 0)),
        # Verbas
        "verbas": verbas,
        "total": _money(detalhes.get("total", 0)),
        # FGTS
        "fgts_acumulado": _money(detalhes.get("fgts", 0)),
        "fgts_rescisorio": _money(detalhes.get("fgts_rescisorio", 0)),
        "multa_fgts_percent": f"{multa_percent * 100:.0f}%",
        "multa_fgts": _money(detalhes.get("multa_fgts", 0)),
        "total_fgts": _money(total_fgts),
    }


def _docx_bytes_to_pdf_bytes(docx_bytes: bytes) -> bytes:
    """Convert DOCX bytes to PDF bytes using LibreOffice headless."""
    with tempfile.TemporaryDirectory() as tmpdir:
        docx_path = Path(tmpdir) / "report.docx"
        docx_path.write_bytes(docx_bytes)

        try:
            result = subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    tmpdir,
                    str(docx_path),
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except FileNotFoundError:
            raise RuntimeError(
                "LibreOffice nao encontrado. Instale com: apt-get install libreoffice-writer"
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("Tempo limite ao converter DOCX para PDF")

        if result.returncode != 0:
            logger.error("LibreOffice stderr: %s", result.stderr)
            raise RuntimeError(f"Falha ao converter DOCX para PDF: {result.stderr}")

        pdf_path = Path(tmpdir) / "report.pdf"
        if not pdf_path.exists():
            raise RuntimeError("PDF nao foi gerado pelo LibreOffice")

        return pdf_path.read_bytes()


def generate_rescisao_docx(*, input_payload: dict, output_payload: dict) -> bytes:
    """Render the Word template with rescisao data and return DOCX bytes."""
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(
            f"Template nao encontrado: {TEMPLATE_PATH}\n"
            "Coloque o arquivo rescisao_trabalhista_report.docx em "
            "apps/backend/src/features/calculators/templates/"
        )

    tpl = DocxTemplate(str(TEMPLATE_PATH))
    context = _build_context(input_payload=input_payload, output_payload=output_payload)

    tpl.render(context)

    buf = io.BytesIO()
    tpl.save(buf)
    return buf.getvalue()


def generate_rescisao_pdf(*, input_payload: dict, output_payload: dict) -> bytes:
    """Generate a PDF report from the rescisao calculation data using the Word template.

    Pipeline: calculation data -> DOCX (docxtpl template) -> PDF (LibreOffice headless).

    Returns:
        PDF file as bytes.
    """
    docx_bytes = generate_rescisao_docx(
        input_payload=input_payload, output_payload=output_payload
    )
    logger.info("Rescisao DOCX generated from template: %d bytes", len(docx_bytes))

    pdf_bytes = _docx_bytes_to_pdf_bytes(docx_bytes)
    logger.info("Rescisao PDF generated: %d bytes", len(pdf_bytes))

    return pdf_bytes
