"""Calculadora de Média Salarial (Salário de Benefício).

Calcula a média das contribuições com correção monetária pelo INPC.
- Pós-reforma: 100% das contribuições desde jul/1994
- Pré-reforma (direito adquirido): 80% maiores contribuições
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from .constantes import DATA_INICIO_PLANO_REAL
from .tipos import MediaSalarial, Remuneracao


def _agrupar_por_competencia(
    remuneracoes: list[Remuneracao],
    teto: Decimal,
) -> dict[date, Decimal]:
    """Agrupa remunerações por competência, somando concomitantes (cap no teto)."""
    por_mes: dict[date, Decimal] = defaultdict(Decimal)
    for r in remuneracoes:
        por_mes[r.competencia] += r.valor
    # Aplicar teto
    return {comp: min(val, teto) for comp, val in por_mes.items()}


def calcular_media_salarial(
    remuneracoes: list[Remuneracao],
    indices_inpc: dict[date, Decimal] | None = None,
    teto_atual: Decimal = Decimal("8475.55"),
    piso_atual: Decimal = Decimal("1621.00"),
) -> MediaSalarial:
    """Calcula a média salarial para fins previdenciários.

    Args:
        remuneracoes: Lista de remunerações mensais.
        indices_inpc: Mapa competência → fator de correção acumulado.
            Se None, usa valores nominais (sem correção).
        teto_atual: Teto do INSS vigente.
        piso_atual: Piso (salário mínimo) vigente.

    Returns:
        MediaSalarial com médias calculadas.
    """
    if not remuneracoes:
        return MediaSalarial(
            media_100=Decimal("0"),
            media_80=Decimal("0"),
            qtd_contribuicoes=0,
            maior_contribuicao=Decimal("0"),
            menor_contribuicao=Decimal("0"),
        )

    # Filtrar contribuições a partir de jul/1994
    validas = [r for r in remuneracoes if r.competencia >= DATA_INICIO_PLANO_REAL]

    if not validas:
        return MediaSalarial(
            media_100=Decimal("0"),
            media_80=Decimal("0"),
            qtd_contribuicoes=0,
            maior_contribuicao=Decimal("0"),
            menor_contribuicao=Decimal("0"),
        )

    # Agrupar concomitantes (cap no teto)
    agrupadas = _agrupar_por_competencia(validas, teto_atual)

    # Aplicar correção monetária
    valores_corrigidos: list[Decimal] = []
    for comp, valor in sorted(agrupadas.items()):
        if indices_inpc and comp in indices_inpc:
            fator = indices_inpc[comp]
            corrigido = (valor * fator).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            corrigido = valor
        # Cap no teto após correção
        corrigido = min(corrigido, teto_atual)
        valores_corrigidos.append(corrigido)

    qtd = len(valores_corrigidos)

    # Média 100% (pós-reforma: todas as contribuições)
    soma_100 = sum(valores_corrigidos)
    media_100 = (soma_100 / qtd).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Média 80% maiores (pré-reforma)
    ordenados_desc = sorted(valores_corrigidos, reverse=True)
    qtd_80 = max(1, int(qtd * 0.8))
    melhores_80 = ordenados_desc[:qtd_80]
    soma_80 = sum(melhores_80)
    media_80 = (soma_80 / qtd_80).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Aplicar piso e teto nas médias
    media_100 = max(piso_atual, min(media_100, teto_atual))
    media_80 = max(piso_atual, min(media_80, teto_atual))

    return MediaSalarial(
        media_100=media_100,
        media_80=media_80,
        qtd_contribuicoes=qtd,
        maior_contribuicao=max(valores_corrigidos),
        menor_contribuicao=min(valores_corrigidos),
    )
