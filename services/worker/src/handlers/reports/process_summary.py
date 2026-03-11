"""Process Summary Report Generator via docxtpl template: JSON -> DOCX -> PDF.

Uses a Word template (src/assets/templates/ia/process_summary_report.docx) with Jinja2 placeholders.
The template controls all formatting — fonts, colors, logo, layout.
Python only injects the data.

Template placeholders expected:
    {{ data_analise }}              - Data/hora da análise (datetime.now())
    {{ tipo_acao }}                 - Tipo de ação/processo
    {{ numero_processo }}           - Número do processo
    {{ vara_tribunal }}             - Vara ou tribunal
    {{ autor }}                     - Nome do autor/requerente
    {{ reu }}                       - Nome do réu/requerido
    {{ advogado_autor }}            - Advogado do autor
    {{ advogado_reu }}              - Advogado do réu
    {{ juiz_relator }}              - Juiz ou relator
    {{ valor_causa }}               - Valor da causa
    {{ resumo_executivo }}          - Resumo executivo (texto longo)
    {%p for f in fatos_relevantes %}• {{ f }}{%p endfor %}  - Lista de fatos
    {%p for p in pedidos %}• {{ p }}{%p endfor %}           - Lista de pedidos
    {%tr for d in decisoes %}       - Loop de decisões (linha de tabela)
        {{ d.data }}
        {{ d.tipo }}
        {{ d.conteudo }}
    {%tr endfor %}
    {%tr for p in prazos_datas %}   - Loop de prazos (linha de tabela)
        {{ p.data }}
        {{ p.descricao }}
    {%tr endfor %}
    {%p for p in pontos_atencao %}• {{ p }}{%p endfor %}   - Pontos de atenção
    {%p for p in proximos_passos %}• {{ p }}{%p endfor %}  - Próximos passos
    {{ tem_decisoes }}              - bool (para condicionais no template)
    {{ tem_prazos }}                - bool
    {{ tem_pontos_atencao }}        - bool
    {{ tem_proximos_passos }}       - bool
"""

import io
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from docxtpl import DocxTemplate

from src.core.logging import logger

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
TEMPLATE_PATH = ASSETS_DIR / "templates" / "ia" / "process_summary_report.docx"


def _build_context(dados_analise: dict) -> dict:
    """Build the Jinja2 context dict from the Gemini JSON response."""
    ident = dados_analise.get("identificacao") or {}

    decisoes_raw = dados_analise.get("decisoes") or []
    decisoes = [
        {
            "data": d.get("data") or "",
            "tipo": d.get("tipo") or "",
            "conteudo": d.get("conteudo") or "",
        }
        for d in decisoes_raw
        if isinstance(d, dict)
    ]

    prazos_raw = dados_analise.get("prazos_datas") or []
    prazos_datas = [
        {
            "data": p.get("data") or "",
            "descricao": p.get("descricao") or "",
        }
        for p in prazos_raw
        if isinstance(p, dict)
    ]

    fatos_relevantes = [str(f) for f in (dados_analise.get("fatos_relevantes") or []) if f]
    pedidos = [str(p) for p in (dados_analise.get("pedidos") or []) if p]
    pontos_atencao = [str(p) for p in (dados_analise.get("pontos_atencao") or []) if p]
    proximos_passos = [str(p) for p in (dados_analise.get("proximos_passos") or []) if p]

    return {
        "data_analise": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "tipo_acao": ident.get("tipo_acao") or "[Não identificado]",
        "numero_processo": ident.get("numero_processo") or "[Não identificado]",
        "vara_tribunal": ident.get("vara_tribunal") or "[Não identificado]",
        "autor": ident.get("autor") or "[Não identificado]",
        "reu": ident.get("reu") or "[Não identificado]",
        "advogado_autor": ident.get("advogado_autor") or "",
        "advogado_reu": ident.get("advogado_reu") or "",
        "juiz_relator": ident.get("juiz_relator") or "",
        "valor_causa": dados_analise.get("valor_causa") or "",
        "resumo_executivo": dados_analise.get("resumo_executivo") or "",
        "fatos_relevantes": fatos_relevantes,
        "pedidos": pedidos,
        "decisoes": decisoes,
        "prazos_datas": prazos_datas,
        "pontos_atencao": pontos_atencao,
        "proximos_passos": proximos_passos,
        "tem_decisoes": bool(decisoes),
        "tem_prazos": bool(prazos_datas),
        "tem_pontos_atencao": bool(pontos_atencao),
        "tem_proximos_passos": bool(proximos_passos),
    }


def generate_process_summary_docx_from_template(dados_analise: dict) -> bytes:
    """Render the Word template with process summary data and return DOCX bytes.

    Args:
        dados_analise: Parsed JSON from Gemini.

    Returns:
        DOCX file as bytes.

    Raises:
        FileNotFoundError: If process_summary_report.docx is not found in assets/templates/ia/.
        RuntimeError: If template rendering fails.
    """
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(
            f"Template não encontrado: {TEMPLATE_PATH}\n"
            "Coloque o arquivo process_summary_report.docx em "
            "services/worker/src/assets/templates/ia/"
        )

    tpl = DocxTemplate(str(TEMPLATE_PATH))
    context = _build_context(dados_analise)

    tpl.render(context)

    buf = io.BytesIO()
    tpl.save(buf)
    return buf.getvalue()


def docx_bytes_to_pdf_bytes(docx_bytes: bytes) -> bytes:
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
                "LibreOffice não encontrado. Instale com: apt-get install libreoffice-writer"
            )
        except subprocess.TimeoutExpired:
            raise RuntimeError("Tempo limite ao converter DOCX para PDF")

        if result.returncode != 0:
            logger.error("LibreOffice stderr: %s", result.stderr)
            raise RuntimeError(f"Falha ao converter DOCX para PDF: {result.stderr}")

        pdf_path = Path(tmpdir) / "report.pdf"
        if not pdf_path.exists():
            raise RuntimeError("PDF não foi gerado pelo LibreOffice")

        return pdf_path.read_bytes()


def generate_process_summary_pdf_from_template(dados_analise: dict) -> bytes:
    """Generate a PDF report from the Gemini process summary JSON using the Word template.

    Pipeline: JSON -> DOCX (docxtpl template) -> PDF (LibreOffice headless).

    Args:
        dados_analise: Parsed JSON from Gemini.

    Returns:
        PDF file as bytes.
    """
    docx_bytes = generate_process_summary_docx_from_template(dados_analise)
    logger.info("Process summary DOCX generated from template: %d bytes", len(docx_bytes))

    pdf_bytes = docx_bytes_to_pdf_bytes(docx_bytes)
    logger.info("Process summary PDF generated: %d bytes", len(pdf_bytes))

    return pdf_bytes
