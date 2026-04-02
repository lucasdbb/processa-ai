"""Calculadora de Tempo de Contribuição.

Calcula o tempo total de contribuição a partir de uma lista de vínculos,
tratando sobreposições, vínculos abertos e conversão de tempo especial.
"""

from __future__ import annotations

from datetime import date, timedelta

from .constantes import (
    DATA_REFORMA,
    DIAS_POR_ANO,
    DIAS_POR_MES,
    MULTIPLICADOR_ESPECIAL,
)
from .tipos import TempoContribuicao, Vinculo


def _dias_entre(inicio: date, fim: date) -> int:
    """Dias entre duas datas, inclusive em ambas as pontas."""
    return max((fim - inicio).days + 1, 0)


def _merge_intervalos(intervalos: list[tuple[date, date]]) -> list[tuple[date, date]]:
    """Merge de intervalos sobrepostos. Retorna lista ordenada sem sobreposição."""
    if not intervalos:
        return []
    ordenados = sorted(intervalos, key=lambda x: x[0])
    merged: list[tuple[date, date]] = [ordenados[0]]
    for inicio, fim in ordenados[1:]:
        ult_inicio, ult_fim = merged[-1]
        # Sobreposição ou adjacência (dia seguinte)
        if inicio <= ult_fim + timedelta(days=1):
            merged[-1] = (ult_inicio, max(ult_fim, fim))
        else:
            merged.append((inicio, fim))
    return merged


def _detectar_sobreposicoes(
    vinculos: list[Vinculo],
) -> list[str]:
    """Detecta pares de vínculos com períodos sobrepostos."""
    alertas: list[str] = []
    for i, v1 in enumerate(vinculos):
        fim1 = v1.data_fim or date.today()
        for v2 in vinculos[i + 1 :]:
            fim2 = v2.data_fim or date.today()
            if v1.data_inicio <= fim2 and v2.data_inicio <= fim1:
                emp1 = v1.empresa or f"Vínculo {i + 1}"
                emp2 = v2.empresa or f"Vínculo {i + 2}"
                alertas.append(
                    f"Sobreposição detectada entre '{emp1}' e '{emp2}' "
                    f"({v1.data_inicio.strftime('%d/%m/%Y')} - {fim1.strftime('%d/%m/%Y')} "
                    f"× {v2.data_inicio.strftime('%d/%m/%Y')} - {fim2.strftime('%d/%m/%Y')}). "
                    f"O tempo sobreposto foi contado apenas uma vez."
                )
    return alertas


def _detectar_lacunas(
    intervalos_merged: list[tuple[date, date]],
    limiar_dias: int = 365,
) -> list[str]:
    """Detecta lacunas maiores que o limiar entre períodos de contribuição."""
    alertas: list[str] = []
    for i in range(len(intervalos_merged) - 1):
        fim_atual = intervalos_merged[i][1]
        inicio_prox = intervalos_merged[i + 1][0]
        gap = (inicio_prox - fim_atual).days - 1
        if gap >= limiar_dias:
            anos = gap // 365
            meses = (gap % 365) // 30
            alertas.append(
                f"Lacuna de {anos}a {meses}m entre "
                f"{fim_atual.strftime('%d/%m/%Y')} e {inicio_prox.strftime('%d/%m/%Y')}."
            )
    return alertas


def calcular_tempo_contribuicao(
    vinculos: list[Vinculo],
    data_referencia: date | None = None,
) -> TempoContribuicao:
    """Calcula o tempo total de contribuição a partir dos vínculos.

    Args:
        vinculos: Lista de vínculos empregatícios.
        data_referencia: Data de referência para vínculos abertos (default: hoje).

    Returns:
        TempoContribuicao com o resultado detalhado.
    """
    if not vinculos:
        return TempoContribuicao(
            anos=0, meses=0, dias=0, total_dias=0, vinculos_processados=0
        )

    ref = data_referencia or date.today()
    alertas: list[str] = []

    # Detectar vínculos abertos
    for v in vinculos:
        if v.data_fim is None:
            emp = v.empresa or "Empregador não identificado"
            alertas.append(
                f"Vínculo aberto em '{emp}' (início {v.data_inicio.strftime('%d/%m/%Y')}). "
                f"Considerado ativo até {ref.strftime('%d/%m/%Y')}."
            )

    # Detectar sobreposições
    alertas.extend(_detectar_sobreposicoes(vinculos))

    # Separar vínculos comuns e especiais (pré-reforma)
    intervalos_comuns: list[tuple[date, date]] = []
    dias_especial_bonus = 0  # dias adicionais de conversão especial

    for v in vinculos:
        fim = v.data_fim or ref
        if fim < v.data_inicio:
            alertas.append(
                f"Vínculo com data fim ({fim.strftime('%d/%m/%Y')}) anterior "
                f"à data início ({v.data_inicio.strftime('%d/%m/%Y')}). Ignorado."
            )
            continue

        intervalos_comuns.append((v.data_inicio, fim))

        # Conversão de tempo especial para comum (apenas pré-reforma)
        if v.atividade_especial and v.categoria_especial:
            sexo = "M"  # Será sobrescrito pelo engine quando disponível
            chave = (v.categoria_especial.value if hasattr(v.categoria_especial, 'value') else v.categoria_especial, sexo)
            multiplicador = MULTIPLICADOR_ESPECIAL.get(chave, 1.0)
            if multiplicador > 1.0:
                # Limitar conversão ao período pré-reforma
                fim_especial = min(fim, DATA_REFORMA)
                if v.data_inicio < fim_especial:
                    dias_periodo = _dias_entre(v.data_inicio, fim_especial)
                    bonus = int(dias_periodo * (multiplicador - 1))
                    dias_especial_bonus += bonus
                    alertas.append(
                        f"Tempo especial ({v.categoria_especial}a) de "
                        f"{v.data_inicio.strftime('%d/%m/%Y')} a {fim_especial.strftime('%d/%m/%Y')}: "
                        f"multiplicador {multiplicador}x → +{bonus} dias bônus."
                    )

    # Merge de intervalos sobrepostos
    merged = _merge_intervalos(intervalos_comuns)

    # Detectar lacunas
    alertas.extend(_detectar_lacunas(merged))

    # Somar dias
    total_dias = sum(_dias_entre(ini, fim) for ini, fim in merged)
    total_dias += dias_especial_bonus

    # Converter para anos/meses/dias (convenção INSS: 360 dias/ano, 30 dias/mês)
    anos = total_dias // DIAS_POR_ANO
    restante = total_dias % DIAS_POR_ANO
    meses = restante // DIAS_POR_MES
    dias = restante % DIAS_POR_MES

    return TempoContribuicao(
        anos=anos,
        meses=meses,
        dias=dias,
        total_dias=total_dias,
        vinculos_processados=len(vinculos),
        alertas=alertas,
    )


def calcular_tempo_na_data(
    vinculos: list[Vinculo],
    data_alvo: date,
) -> TempoContribuicao:
    """Calcula quanto tempo de contribuição o segurado terá em uma data futura.

    Assume que vínculos abertos continuam ativos até a data alvo.
    """
    return calcular_tempo_contribuicao(vinculos, data_referencia=data_alvo)
