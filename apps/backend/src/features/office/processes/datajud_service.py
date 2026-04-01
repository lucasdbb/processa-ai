import re
import httpx
from typing import Any
from src.core.config import settings
from src.core.logging import logger

DATAJUD_API_URL_BASE = "https://api-publica.datajud.cnj.jus.br"

CNJ_TR_MAPPING = {
    # Justiça Superior
    "1.00": "stf",
    "2.00": "cnj",
    "3.00": "stj",
    "6.00": "tse",
    "7.00": "stm",

    # Justiça Federal (J=4)
    "4.01": "trf1", "4.02": "trf2", "4.03": "trf3", "4.04": "trf4", "4.05": "trf5", "4.06": "trf6",

    # Justiça do Trabalho (J=5)
    "5.00": "tst",
    "5.01": "trt1", "5.02": "trt2", "5.03": "trt3", "5.04": "trt4", "5.05": "trt5",
    "5.06": "trt6", "5.07": "trt7", "5.08": "trt8", "5.09": "trt9", "5.10": "trt10",
    "5.11": "trt11", "5.12": "trt12", "5.13": "trt13", "5.14": "trt14", "5.15": "trt15",
    "5.16": "trt16", "5.17": "trt17", "5.18": "trt18", "5.19": "trt19", "5.20": "trt20",
    "5.21": "trt21", "5.22": "trt22", "5.23": "trt23", "5.24": "trt24",

    # Justiça Eleitoral (J=6) - TREs
    "6.01": "tre-ac", "6.02": "tre-al", "6.03": "tre-ap", "6.04": "tre-am", "6.05": "tre-ba",
    "6.06": "tre-ce", "6.07": "tre-df", "6.08": "tre-es", "6.09": "tre-go", "6.10": "tre-ma",
    "6.11": "tre-mt", "6.12": "tre-ms", "6.13": "tre-mg", "6.14": "tre-pa", "6.15": "tre-pb",
    "6.16": "tre-pr", "6.17": "tre-pe", "6.18": "tre-pi", "6.19": "tre-rj", "6.20": "tre-rn",
    "6.21": "tre-rs", "6.22": "tre-ro", "6.23": "tre-rr", "6.24": "tre-sc", "6.25": "tre-se",
    "6.26": "tre-sp", "6.27": "tre-to",

    # Justiça Estadual (J=8) (TR = UF IBGE)
    "8.01": "tjac", "8.02": "tjal", "8.03": "tjap", "8.04": "tjam", "8.05": "tjba",
    "8.06": "tjce", "8.07": "tjdft", "8.08": "tjes", "8.09": "tjgo", "8.10": "tjma",
    "8.11": "tjmt", "8.12": "tjms", "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb",
    "8.16": "tjpr", "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
    "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc", "8.25": "tjse",
    "8.26": "tjsp", "8.27": "tjto",

    # Justiça Militar Estadual (J=9)
    "9.13": "tjmmg", "9.21": "tjmrs", "9.26": "tjmsp"
}

# Inferência de área jurídica baseada no código J do CNJ
_J_TO_AREA: dict[str, str] = {
    "1": "Superior",
    "2": "Superior",
    "3": "Superior",
    "4": "Cível",  # Federal — refinado por assunto abaixo
    "5": "Trabalhista",
    "6": "Eleitoral",
    "7": "Militar",
    "8": "Cível",  # Estadual
    "9": "Militar",
}

_PREVIDENCIARIO_KEYWORDS = (
    "previdência", "aposentadoria", "benefício", "inss",
    "auxílio-doença", "pensão por morte", "invalidez",
)


class DataJudService:
    def strip_cnj_mask(self, cnj: str) -> str:
        """Remove máscara do CNJ, deixando apenas 20 dígitos."""
        clean = re.sub(r"\D", "", cnj)
        return clean.zfill(20)

    def get_tribunal_code_from_cnj(self, cnj: str) -> str | None:
        """Extrai o sufixo do tribunal para a URL baseando-se no formato J.TR."""
        clean = self.strip_cnj_mask(cnj)
        if len(clean) != 20:
            return None

        # NNNNNNN-DD.AAAA.J.TR.OOOO
        # Índice python: J = indice 13, TR = indice 14 e 15
        j = clean[13]
        tr = clean[14:16]

        mapping_key = f"{j}.{tr}"
        return CNJ_TR_MAPPING.get(mapping_key)

    def infer_area(self, cnj: str, assunto: str) -> str | None:
        """Infere a área jurídica baseando-se no código J do CNJ e no assunto."""
        clean = self.strip_cnj_mask(cnj)
        if len(clean) != 20:
            return None

        j = clean[13]
        area = _J_TO_AREA.get(j)

        # Refinamento para Justiça Federal (J=4): checar se é previdenciário
        if j == "4" and assunto:
            assunto_lower = assunto.lower()
            if any(kw in assunto_lower for kw in _PREVIDENCIARIO_KEYWORDS):
                return "Previdenciário"

        return area

    async def fetch_process_metadata(self, cnj: str) -> dict[str, Any] | None:
        """Busca os dados do processo na API Elasticsearch do DataJUD."""
        clean_cnj = self.strip_cnj_mask(cnj)
        if len(clean_cnj) != 20:
            logger.error(f"DataJUD: CNJ inválido fornecido: {cnj}")
            return None

        tribunal = self.get_tribunal_code_from_cnj(clean_cnj)
        if not tribunal:
            logger.error(f"DataJUD: Tribunal não mapeado para o CNJ: {clean_cnj}")
            return None

        url = f"{DATAJUD_API_URL_BASE}/api_publica_{tribunal}/_search"
        payload = {
            "query": {
                "match": {
                    "numeroProcesso": clean_cnj
                }
            }
        }

        headers = {
            "Authorization": f"APIKey {settings.DATAJUD_API_KEY}",
            "Content-Type": "application/json"
        }

        if not settings.DATAJUD_API_KEY:
            logger.error("DataJUD: DATAJUD_API_KEY não configurada no ambiente")
            return None

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=5.0)) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()

                hits = data.get("hits", {}).get("hits", [])
                if not hits:
                    logger.info(f"DataJUD: nenhum resultado para CNJ={clean_cnj}")
                    return None

                return hits[0].get("_source", {})
        except httpx.HTTPStatusError as e:
            logger.error(f"DataJUD: HTTP {e.response.status_code} | body={e.response.text[:300]}")
            return None
        except Exception as e:
            logger.error(f"DataJUD: erro de conexão | {type(e).__name__}: {e}")
            return None

    def parse_to_internal_preview(self, cnj: str, datajud_source: dict[str, Any]) -> dict[str, Any]:
        """Converte JSON do DataJUD para um dicionário padronizado nosso."""

        def get_nested(obj: dict, *keys: str, default: Any = None) -> Any:
            for k in keys:
                if isinstance(obj, dict) and k in obj:
                    obj = obj[k]
                else:
                    return default
            return obj

        classe = get_nested(datajud_source, "classe", "nome")

        assuntos_raw = get_nested(datajud_source, "assuntos")
        assunto_nomes: list[str] = []
        if assuntos_raw and isinstance(assuntos_raw, list):
            for a in assuntos_raw:
                nome = get_nested(a, "nome") if isinstance(a, dict) else None
                if nome:
                    assunto_nomes.append(nome)
        assunto_principal = " | ".join(assunto_nomes) if assunto_nomes else "Não informado"

        # Órgão julgador (Vara)
        orgao = get_nested(datajud_source, "orgaoJulgador", "nome", default="")

        # Grau de jurisdição (JE = Juizado Especial, G1 = 1º Grau, G2 = 2º Grau, etc.)
        grau = datajud_source.get("grau", "")

        # Data de ajuizamento — formato bruto YYYYMMDDHHMMSS
        raw_date = datajud_source.get("dataAjuizamento")
        start_date: str | None = None
        if raw_date and isinstance(raw_date, str) and len(raw_date) >= 8:
            start_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"

        # Última movimentação
        movimentos = datajud_source.get("movimentos", [])
        last_mov_date = None
        if movimentos and isinstance(movimentos, list):
            try:
                movs_sorted = sorted(
                    [m for m in movimentos if m.get("dataHora")],
                    key=lambda x: x["dataHora"],
                    reverse=True,
                )
                if movs_sorted:
                    last_mov_date = movs_sorted[0]["dataHora"]
            except Exception:
                pass

        inferred_area = self.infer_area(cnj, assunto_principal)

        # Tribunal — usar campo direto da API, mais confiável que derivar do CNJ
        tribunal_raw = datajud_source.get("tribunal") or self.get_tribunal_code_from_cnj(cnj) or ""
        tribunal = tribunal_raw.upper()

        return {
            "process_number": self.strip_cnj_mask(cnj),
            "is_valid": True,
            "court": orgao,
            "tribunal": tribunal,
            "defendants": [],
            "plaintiffs": [],
            "subject": assunto_principal,
            "process_class": classe or "Padrão",
            "inferred_area": inferred_area,
            "grau": grau,
            "start_date": start_date,
            "valor_causa": None,  # Não disponível na API pública do DataJUD
            "last_update_date": datajud_source.get("dataHoraUltimaAtualizacao") or last_mov_date,
            "raw_movimentos_count": len(movimentos),
        }


datajud_service = DataJudService()
