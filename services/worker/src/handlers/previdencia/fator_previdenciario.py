"""Calculadora de Fator Previdenciário.

Fórmula: f = (Tc × a / Es) × [1 + (Id + Tc × a) / 100]

Onde:
    Tc = tempo de contribuição (em anos, com +5 bônus para mulheres)
    a  = alíquota (0.31 fixo)
    Es = expectativa de sobrevida pela tábua IBGE
    Id = idade na aposentadoria
"""

from __future__ import annotations

from .constantes import ALIQUOTA_FATOR
from .tipos import FatorPrevidenciario, Sexo


def calcular_fator_previdenciario(
    tempo_contribuicao_anos: float,
    idade: float,
    sexo: Sexo | str,
    expectativa_sobrevida: float,
) -> FatorPrevidenciario:
    """Calcula o fator previdenciário.

    Args:
        tempo_contribuicao_anos: Tempo de contribuição em anos decimais.
        idade: Idade do segurado em anos decimais.
        sexo: "M" ou "F".
        expectativa_sobrevida: Es da tábua IBGE para a idade.

    Returns:
        FatorPrevidenciario com valor e fórmula detalhada.
    """
    sexo_str = sexo.value if isinstance(sexo, Sexo) else sexo
    a = ALIQUOTA_FATOR

    # Bônus de 5 anos para mulheres (Lei 9.876/1999, Art. 29, §9°)
    # Bônus de 5 anos para professor, 10 para professora
    tc = tempo_contribuicao_anos
    if sexo_str == "F":
        tc += 5

    es = expectativa_sobrevida
    id_ = idade

    # Fórmula
    if es <= 0:
        fator = 1.0
    else:
        fator = (tc * a / es) * (1 + (id_ + tc * a) / 100)

    fator = round(fator, 4)

    # Montar fórmula legível
    formula = (
        f"({tc:.1f} × {a} / {es:.1f}) × "
        f"[1 + ({id_:.1f} + {tc:.1f} × {a}) / 100] = {fator:.4f}"
    )

    return FatorPrevidenciario(
        valor=fator,
        formula_detalhada=formula,
        tc_usado=tc,
        es_usado=es,
        id_usado=id_,
    )
