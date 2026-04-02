"""Parser determinístico de CNIS PDF usando pymupdf.

Extrai dados estruturados (segurado, vínculos, remunerações) de PDFs
do Meu INSS sem IA/OCR. Fallback para Gemini em PDFs escaneados.

O CNIS do Meu INSS é born-digital com tabelas bordadas.
pymupdf.find_tables() com estratégia "lines" funciona diretamente.
"""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from src.core.logging import logger

from .tipos import CnisExtraido, CnisSegurado, CnisVinculo, Remuneracao

# Padrões regex para dados do segurado
_CPF_RE = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")
_NIT_RE = re.compile(r"\d{3}\.\d{5}\.\d{2}-\d{1}")
_DATA_RE = re.compile(r"\d{2}/\d{2}/\d{4}")
_COMPETENCIA_RE = re.compile(r"(\d{2})/(\d{4})")
_VALOR_RE = re.compile(r"[\d.,]+")

# Headers que identificam seções
_HEADER_FILIADO = "Identificação do Filiado"
_HEADER_RELACOES = "Relações Previdenciárias"
_HEADER_REMUNERACOES = "Remunerações"

# Campos do segurado
_CAMPOS_SEGURADO = {
    "NIT": "nit",
    "CPF": "cpf",
    "Nome": "nome",
    "Data de Nascimento": "data_nascimento",
    "Nome da Mãe": "nome_mae",
}

MIN_TEXT_FOR_NATIVE = 100


def _parse_date(text: str) -> date | None:
    """Converte DD/MM/AAAA para date."""
    text = text.strip()
    match = _DATA_RE.search(text)
    if not match:
        return None
    try:
        parts = match.group().split("/")
        return date(int(parts[2]), int(parts[1]), int(parts[0]))
    except (ValueError, IndexError):
        return None


def _parse_competencia(text: str) -> date | None:
    """Converte MM/AAAA para date (primeiro dia do mês)."""
    match = _COMPETENCIA_RE.search(text.strip())
    if not match:
        return None
    try:
        mes, ano = int(match.group(1)), int(match.group(2))
        return date(ano, mes, 1)
    except (ValueError, IndexError):
        return None


def _parse_valor(text: str) -> Decimal | None:
    """Converte valor monetário brasileiro (1.234,56) para Decimal."""
    text = text.strip()
    if not text or text == "-" or text == "—":
        return None
    # Remover tudo exceto dígitos, pontos e vírgulas
    clean = re.sub(r"[^\d.,]", "", text)
    if not clean:
        return None
    # Formato brasileiro: ponto = milhar, vírgula = decimal
    clean = clean.replace(".", "").replace(",", ".")
    try:
        return Decimal(clean)
    except InvalidOperation:
        return None


def _has_native_text(pdf_bytes: bytes) -> bool:
    """Verifica se o PDF tem texto nativo suficiente."""
    try:
        import pymupdf
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        total = sum(len(page.get_text().strip()) for page in doc)
        doc.close()
        return total >= MIN_TEXT_FOR_NATIVE
    except Exception:
        return False


def _extrair_segurado_do_texto(text: str) -> CnisSegurado:
    """Extrai dados do segurado a partir do texto bruto do PDF."""
    segurado = CnisSegurado()
    lines = text.split("\n")

    for i, line in enumerate(lines):
        line_strip = line.strip()

        # CPF
        if "CPF" in line_strip and not segurado.cpf:
            match = _CPF_RE.search(line_strip)
            if match:
                segurado.cpf = match.group()

        # NIT
        if "NIT" in line_strip and not segurado.nit:
            match = _NIT_RE.search(line_strip)
            if match:
                segurado.nit = match.group()

        # Nome (geralmente vem logo após "Nome" no header)
        if "Nome" in line_strip and "Mãe" not in line_strip and not segurado.nome:
            # Tentar pegar o valor na mesma linha após "Nome"
            parts = re.split(r"Nome\s*:?\s*", line_strip, maxsplit=1)
            if len(parts) > 1 and parts[1].strip():
                segurado.nome = parts[1].strip()

        # Nome da mãe
        if "Mãe" in line_strip and not segurado.nome_mae:
            parts = re.split(r"(?:Nome\s+da\s+)?Mãe\s*:?\s*", line_strip, maxsplit=1)
            if len(parts) > 1 and parts[1].strip():
                segurado.nome_mae = parts[1].strip()

        # Data de nascimento
        if "Nascimento" in line_strip and not segurado.data_nascimento:
            segurado.data_nascimento = _parse_date(line_strip)

    return segurado


def _extrair_vinculos_das_tabelas(pdf_bytes: bytes) -> tuple[list[CnisVinculo], list[str]]:
    """Extrai vínculos e remunerações usando pymupdf find_tables()."""
    import pymupdf

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    vinculos: list[CnisVinculo] = []
    alertas: list[str] = []
    vinculo_atual: CnisVinculo | None = None
    seq = 0

    for page_num, page in enumerate(doc):
        tables = page.find_tables(strategy="lines")

        for table in tables:
            data = table.extract()
            if not data or not data[0]:
                continue

            header = [str(c).strip().lower() if c else "" for c in data[0]]
            header_text = " ".join(header)

            # Detectar tabela de vínculo (header contém "seq" ou "nit" + "data")
            is_vinculo_header = (
                any("seq" in h for h in header)
                and any("data" in h or "início" in h or "inicio" in h for h in header)
            )

            # Detectar tabela de remunerações (header contém "competência" ou "remuneração")
            is_remuneracao = any(
                "compet" in h or "remunera" in h for h in header
            )

            if is_vinculo_header:
                # Nova tabela de vínculo
                for row in data[1:]:
                    if not row or not any(row):
                        continue
                    row_str = [str(c).strip() if c else "" for c in row]

                    seq += 1
                    v = CnisVinculo(sequencia=seq)

                    # Buscar campos por posição relativa ao header
                    for i, h in enumerate(header):
                        if i >= len(row_str):
                            break
                        val = row_str[i]
                        if not val:
                            continue

                        if "seq" in h:
                            try:
                                v.sequencia = int(val)
                            except ValueError:
                                pass
                        elif "emp" in h or "empresa" in h or "código" in h or "codigo" in h:
                            v.cnpj = val
                        elif "origem" in h:
                            v.tipo = val
                        elif "início" in h or "inicio" in h or ("data" in h and "fim" not in h):
                            v.data_inicio = _parse_date(val)
                        elif "fim" in h or "desligamento" in h:
                            v.data_fim = _parse_date(val)
                        elif "remun" in h or "últ" in h or "ult" in h:
                            v.ultima_remuneracao = _parse_valor(val)

                    if v.data_inicio:
                        vinculo_atual = v
                        vinculos.append(v)
                    else:
                        seq -= 1

            elif is_remuneracao and vinculo_atual:
                # Remunerações do vínculo atual
                # Layout típico: 3 grupos de (Competência | Remuneração | Indicadores) por linha
                remuneracoes = _extrair_remuneracoes_tabela(data, header)
                vinculo_atual.remuneracoes.extend(remuneracoes)

    doc.close()

    # Detectar vínculos abertos
    for v in vinculos:
        if v.data_fim is None and v.data_inicio:
            emp = v.empresa or v.cnpj or f"Vínculo {v.sequencia}"
            alertas.append(
                f"Vínculo aberto: '{emp}' (início {v.data_inicio.strftime('%d/%m/%Y')})"
            )

    return vinculos, alertas


def _extrair_remuneracoes_tabela(
    data: list[list], header: list[str]
) -> list[Remuneracao]:
    """Extrai remunerações de uma tabela, tratando layout de 3 colunas por grupo."""
    remuneracoes: list[Remuneracao] = []

    # Identificar grupos de colunas (Competência + Remuneração)
    grupos: list[tuple[int, int]] = []  # (idx_competencia, idx_valor)

    for i, h in enumerate(header):
        if "compet" in h:
            # Procurar coluna de valor logo depois
            for j in range(i + 1, min(i + 3, len(header))):
                if "remunera" in header[j] or "valor" in header[j]:
                    grupos.append((i, j))
                    break

    if not grupos:
        # Fallback: assumir padrão alternado (comp, val, ind, comp, val, ind, ...)
        for i in range(0, len(header), 3):
            if i + 1 < len(header):
                grupos.append((i, i + 1))

    for row in data[1:]:
        if not row or not any(row):
            continue
        row_str = [str(c).strip() if c else "" for c in row]

        for idx_comp, idx_val in grupos:
            if idx_comp >= len(row_str) or idx_val >= len(row_str):
                continue

            comp_text = row_str[idx_comp]
            val_text = row_str[idx_val]

            comp = _parse_competencia(comp_text)
            valor = _parse_valor(val_text)

            if comp and valor and valor > 0:
                # Indicadores (coluna seguinte ao valor, se existir)
                indicadores: list[str] = []
                idx_ind = idx_val + 1
                if idx_ind < len(row_str) and row_str[idx_ind]:
                    indicadores = [
                        ind.strip()
                        for ind in row_str[idx_ind].split(",")
                        if ind.strip()
                    ]

                remuneracoes.append(
                    Remuneracao(
                        competencia=comp,
                        valor=valor,
                        indicadores=indicadores,
                    )
                )

    return remuneracoes


def parse_cnis_pdf(pdf_bytes: bytes) -> CnisExtraido:
    """Parse principal do CNIS PDF.

    Usa pymupdf para extração determinística de tabelas.
    Retorna dados estruturados prontos para edição pelo usuário.

    Args:
        pdf_bytes: Conteúdo do PDF em bytes.

    Returns:
        CnisExtraido com segurado, vínculos e alertas.

    Raises:
        ValueError: Se o PDF não contém texto suficiente (provável scan).
    """
    if not _has_native_text(pdf_bytes):
        raise ValueError(
            "O PDF não contém texto selecionável. "
            "Provavelmente é um documento digitalizado/escaneado. "
            "Por favor, utilize o PDF baixado diretamente do Meu INSS."
        )

    import pymupdf

    # Extrair texto bruto para dados do segurado
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    full_text = "\n".join(page.get_text() for page in doc)
    doc.close()

    segurado = _extrair_segurado_do_texto(full_text)
    vinculos, alertas = _extrair_vinculos_das_tabelas(pdf_bytes)

    logger.info(
        "CNIS parseado: %d vínculos, %d remunerações totais, %d alertas",
        len(vinculos),
        sum(len(v.remuneracoes) for v in vinculos),
        len(alertas),
    )

    if not vinculos:
        alertas.append(
            "Nenhum vínculo foi encontrado no documento. "
            "Verifique se o arquivo é um CNIS válido do Meu INSS."
        )

    return CnisExtraido(
        segurado=segurado,
        vinculos=vinculos,
        alertas=alertas,
    )
