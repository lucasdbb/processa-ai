"""CNIS Report Generator via docxtpl template: JSON -> DOCX -> PDF.

Uses a Word template (src/assets/templates/ia/cnis_report.docx) with Jinja2 placeholders.
The template controls all formatting — fonts, colors, logo, layout.
Python only injects the data.

Template placeholders expected:
    {{ data_analise }}              - Data/hora da análise (datetime.now())
    {{ nome }}                      - Nome do segurado
    {{ cpf }}                       - CPF do segurado
    {{ nit }}                       - NIT/PIS/PASEP
    {{ data_nascimento }}           - Data de nascimento
    {{ nome_mae }}                  - Nome da mãe
    {{ resumo_executivo }}          - Texto resumido do CNIS
    {%tr for v in vinculos %}       - Loop de vínculos (linha de tabela)
        {{ v.empresa }}
        {{ v.periodo }}             - Ex: "01/2010 - 12/2015"
        {{ v.indicadores }}         - Ex: "PEXT, IREC-LC123"
        {{ v.analise_critica }}
    {%tr endfor %}
    {{ anos }}, {{ meses }}, {{ dias }}         - Tempo total de contribuição
    {{ quantidade_vinculos }}                   - Qtd de vínculos
    {{ periodos_sem_contribuicao }}             - Períodos sem contribuição
    {{ contribuicoes_abaixo_minimo }}           - Contribuições abaixo do mínimo
    {{ maior_salario_contribuicao }}            - Maior salário de contribuição
    {%p for i in indicadores %}{{ i.codigo }}: {{ i.descricao }} / {{ i.implicacao }}{%p endfor %}
    {%p for a in alertas %}• {{ a }}{%p endfor %}  - Loop de alertas (parágrafo)
"""

import io
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from docxtpl import DocxTemplate

from src.core.logging import logger

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
TEMPLATE_PATH = ASSETS_DIR / "templates" / "ia" / "cnis_report.docx"


def _build_context(dados_analise: dict) -> dict:
    """Build the Jinja2 context dict from the Gemini JSON response."""
    resumo = dados_analise.get("resumo_segurado") or {}

    vinculos_raw = dados_analise.get("vinculos") or []
    vinculos = []
    for v in vinculos_raw:
        periodo = v.get("periodo") or {}
        vinculos.append(
            {
                "empresa": v.get("empresa") or "",
                "periodo": {
                    "inicio": periodo.get("inicio") or "",
                    "fim": periodo.get("fim") or "Aberto",
                },
                "indicadores": v.get("indicadores") or [],
                "analise_critica": v.get("analise_critica") or "",
            }
        )

    # indicadores: lista de objetos {codigo, descricao, implicacao}
    indicadores_raw = dados_analise.get("indicadores") or []
    if isinstance(indicadores_raw, list):
        indicadores = [
            {
                "codigo": i.get("codigo", ""),
                "descricao": i.get("descricao", ""),
                "implicacao": i.get("implicacao", ""),
            }
            for i in indicadores_raw
            if isinstance(i, dict)
        ]
    else:
        indicadores = []

    dados_prev = dados_analise.get("dados_previdenciarios") or {}
    tempo = dados_prev.get("tempo_total_estimado") or {}

    alertas = [str(a) for a in (dados_analise.get("alertas_gerais") or [])]

    return {
        "data_analise": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "nome": resumo.get("nome") or "[Não identificado]",
        "cpf": resumo.get("cpf") or "[Não identificado]",
        "nit": resumo.get("nit") or "[Não identificado]",
        "data_nascimento": resumo.get("data_nascimento") or "[Não identificado]",
        "nome_mae": resumo.get("nome_mae") or "[Não identificado]",
        "resumo_executivo": dados_analise.get("resumo_executivo") or "",
        "vinculos": vinculos,
        "indicadores": indicadores,
        "anos": tempo.get("anos", 0),
        "meses": tempo.get("meses", 0),
        "dias": tempo.get("dias", 0),
        "quantidade_vinculos": dados_prev.get("quantidade_vinculos", 0),
        "periodos_sem_contribuicao": dados_prev.get("periodos_sem_contribuicao", 0),
        "contribuicoes_abaixo_minimo": dados_prev.get("contribuicoes_abaixo_minimo", 0),
        "maior_salario_contribuicao": dados_prev.get("maior_salario_contribuicao", 0),
        "alertas": alertas,
        "tem_alertas": bool(alertas),
    }


def generate_cnis_docx_from_template(dados_analise: dict) -> bytes:
    """Render the Word template with CNIS data and return DOCX bytes.

    Args:
        dados_analise: Parsed JSON from Gemini.

    Returns:
        DOCX file as bytes.

    Raises:
        FileNotFoundError: If cnis_template.docx is not found in assets/.
        RuntimeError: If template rendering fails.
    """
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(
            f"Template não encontrado: {TEMPLATE_PATH}\n"
            "Coloque o arquivo cnis_report.docx em services/worker/src/assets/templates/ia/"
        )

    tpl = DocxTemplate(str(TEMPLATE_PATH))
    context = _build_context(dados_analise)

    tpl.render(context)

    # try:
    #     tpl.render(context)
    # except Exception as e:
    #     raise RuntimeError(f"Erro ao renderizar template CNIS: {e}") from e

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


def generate_cnis_pdf_from_template(dados_analise: dict) -> bytes:
    """Generate a PDF report from the Gemini CNIS analysis JSON using the Word template.

    Pipeline: JSON -> DOCX (docxtpl template) -> PDF (LibreOffice headless).

    Args:
        dados_analise: Parsed JSON from Gemini.

    Returns:
        PDF file as bytes.
    """
    docx_bytes = generate_cnis_docx_from_template(dados_analise)
    logger.info("DOCX generated from template: %d bytes", len(docx_bytes))

    pdf_bytes = docx_bytes_to_pdf_bytes(docx_bytes)
    logger.info("PDF generated: %d bytes", len(pdf_bytes))

    return pdf_bytes
