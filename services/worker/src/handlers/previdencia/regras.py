"""Motor de regras de aposentadoria — EC 103/2019.

Avalia as 6 regras (permanente + 4 transição + direito adquirido)
e retorna elegibilidade, data projetada e benefício estimado.
"""

from __future__ import annotations

from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from dateutil.relativedelta import relativedelta

from .constantes import (
    COEFICIENTE_BASE,
    COEFICIENTE_POR_ANO_EXTRA,
    CONTRIB_MINIMA_IDADE_PROGRESSIVA,
    CONTRIB_MINIMA_PEDAGIO_100,
    CONTRIB_MINIMA_PEDAGIO_50,
    CONTRIB_MINIMA_PEDAGIO_100_PROFESSOR,
    CONTRIB_MINIMA_PERMANENTE_ANTIGOS,
    CONTRIB_MINIMA_PERMANENTE_PROFESSOR,
    CONTRIB_MINIMA_PONTOS,
    CONTRIB_MINIMA_PROFESSOR,
    CONTRIB_PRE_REFORMA_TEMPO,
    CONTRIB_PRE_REFORMA_TEMPO_PROFESSOR,
    DATA_REFORMA,
    DIAS_POR_ANO,
    FALTAVA_MAXIMO_PEDAGIO_50,
    IDADE_MINIMA_PEDAGIO_100,
    IDADE_MINIMA_PEDAGIO_100_PROFESSOR,
    IDADE_MINIMA_PERMANENTE,
    IDADE_MINIMA_PERMANENTE_PROFESSOR,
    IDADE_MINIMA_PRE_REFORMA,
    LIMIAR_ANOS_COEFICIENTE,
    PONTOS_85_95_2019,
    PONTOS_85_95_2019_PROFESSOR,
    idade_minima_professor,
    idade_minima_progressiva,
    pontos_minimos,
    pontos_minimos_professor,
)
from .tipos import (
    CenarioAposentadoria,
    FatorPrevidenciario,
    RegraAposentadoria,
    Sexo,
    TempoContribuicao,
    Vinculo,
)
from .tempo_contribuicao import calcular_tempo_na_data


def _idade_em(data_nascimento: date, data_ref: date) -> float:
    """Idade em anos decimais na data de referência."""
    delta = relativedelta(data_ref, data_nascimento)
    return delta.years + delta.months / 12 + delta.days / 365


def _coeficiente_pos_reforma(tempo_contrib_anos: int, sexo: str) -> float:
    """Coeficiente do benefício pós-reforma: 60% + 2% por ano acima do limiar."""
    limiar = LIMIAR_ANOS_COEFICIENTE[sexo]
    excedente = max(0, tempo_contrib_anos - limiar)
    return COEFICIENTE_BASE + COEFICIENTE_POR_ANO_EXTRA * excedente


def _calcular_beneficio(
    media_salarial: Decimal,
    coeficiente: float,
    piso: Decimal,
    teto: Decimal,
) -> Decimal:
    """Aplica coeficiente à média e garante piso/teto."""
    beneficio = (media_salarial * Decimal(str(coeficiente))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return max(piso, min(beneficio, teto))


def _projetar_data_elegibilidade(
    data_nascimento: date,
    vinculos: list[Vinculo],
    sexo: str,
    verifica_fn,
    max_anos: int = 40,
) -> date | None:
    """Projeta mês a mês até encontrar a primeira data em que verifica_fn retorna True."""
    data = date.today()
    limite = data + relativedelta(years=max_anos)
    while data <= limite:
        if verifica_fn(data):
            return data
        data += relativedelta(months=1)
    return None


# ---------------------------------------------------------------------------
# Avaliação individual de cada regra
# ---------------------------------------------------------------------------


def avaliar_permanente(
    data_nascimento: date,
    sexo: str,
    tempo: TempoContribuicao,
    media: Decimal | None,
    piso: Decimal,
    teto: Decimal,
    vinculos: list[Vinculo],
    professor: bool = False,
) -> CenarioAposentadoria:
    """Regra permanente: idade + contribuição mínima."""
    if professor:
        idade_min = IDADE_MINIMA_PERMANENTE_PROFESSOR[sexo]
        contrib_min = CONTRIB_MINIMA_PERMANENTE_PROFESSOR
    else:
        idade_min = IDADE_MINIMA_PERMANENTE[sexo]
        contrib_min = CONTRIB_MINIMA_PERMANENTE_ANTIGOS[sexo]

    idade_atual = _idade_em(data_nascimento, date.today())
    contrib_anos = tempo.anos

    faltantes: list[str] = []
    elegivel = True

    if idade_atual < idade_min:
        faltantes.append(f"Faltam {idade_min - idade_atual:.1f} anos de idade (mín. {idade_min})")
        elegivel = False
    if contrib_anos < contrib_min:
        faltantes.append(f"Faltam {contrib_min - contrib_anos} anos de contribuição (mín. {contrib_min})")
        elegivel = False

    coef = _coeficiente_pos_reforma(contrib_anos, sexo)
    beneficio = _calcular_beneficio(media, coef, piso, teto) if media else None

    # Projetar data
    data_eleg = None
    if not elegivel:
        def verifica(d: date) -> bool:
            i = _idade_em(data_nascimento, d)
            t = calcular_tempo_na_data(vinculos, d)
            return i >= idade_min and t.anos >= contrib_min
        data_eleg = _projetar_data_elegibilidade(data_nascimento, vinculos, sexo, verifica)
    else:
        data_eleg = date.today()

    nome = "Regra Permanente — Professor" if professor else "Regra Permanente (Idade)"

    return CenarioAposentadoria(
        regra=RegraAposentadoria.PERMANENTE,
        regra_nome=nome,
        elegivel=elegivel,
        data_elegibilidade=data_eleg,
        beneficio_estimado=beneficio,
        coeficiente=coef,
        requisitos_faltantes=faltantes,
    )


def avaliar_pontos(
    data_nascimento: date,
    sexo: str,
    tempo: TempoContribuicao,
    media: Decimal | None,
    piso: Decimal,
    teto: Decimal,
    vinculos: list[Vinculo],
    professor: bool = False,
) -> CenarioAposentadoria:
    """Regra de pontos (Art. 15): idade + tempo >= pontos do ano."""
    if professor:
        contrib_min = CONTRIB_MINIMA_PROFESSOR
        fn_pontos = pontos_minimos_professor
    else:
        contrib_min = CONTRIB_MINIMA_PONTOS[sexo]
        fn_pontos = lambda ano, s: pontos_minimos(ano, s)

    idade_atual = _idade_em(data_nascimento, date.today())
    contrib_anos = tempo.anos
    ano_atual = date.today().year
    pontos_requeridos = fn_pontos(ano_atual, sexo)
    pontos_atuais = int(idade_atual) + contrib_anos

    faltantes: list[str] = []
    elegivel = True

    if contrib_anos < contrib_min:
        faltantes.append(f"Faltam {contrib_min - contrib_anos} anos de contribuição (mín. {contrib_min})")
        elegivel = False
    if pontos_atuais < pontos_requeridos:
        faltantes.append(f"Faltam {pontos_requeridos - pontos_atuais} pontos (atual: {pontos_atuais}, requerido: {pontos_requeridos})")
        elegivel = False

    coef = _coeficiente_pos_reforma(contrib_anos, sexo)
    beneficio = _calcular_beneficio(media, coef, piso, teto) if media else None

    data_eleg = None
    if not elegivel:
        def verifica(d: date) -> bool:
            i = _idade_em(data_nascimento, d)
            t = calcular_tempo_na_data(vinculos, d)
            pts = fn_pontos(d.year, sexo)
            return t.anos >= contrib_min and (int(i) + t.anos) >= pts
        data_eleg = _projetar_data_elegibilidade(data_nascimento, vinculos, sexo, verifica)
    else:
        data_eleg = date.today()

    nome = "Regra de Pontos — Professor (Art. 15, §3°)" if professor else "Regra de Pontos (Art. 15)"

    return CenarioAposentadoria(
        regra=RegraAposentadoria.PONTOS,
        regra_nome=nome,
        elegivel=elegivel,
        data_elegibilidade=data_eleg,
        beneficio_estimado=beneficio,
        coeficiente=coef,
        requisitos_faltantes=faltantes,
    )


def avaliar_idade_progressiva(
    data_nascimento: date,
    sexo: str,
    tempo: TempoContribuicao,
    media: Decimal | None,
    piso: Decimal,
    teto: Decimal,
    vinculos: list[Vinculo],
    professor: bool = False,
) -> CenarioAposentadoria:
    """Idade mínima progressiva (Art. 16)."""
    if professor:
        contrib_min = CONTRIB_MINIMA_PROFESSOR
        fn_idade = idade_minima_professor
    else:
        contrib_min = CONTRIB_MINIMA_IDADE_PROGRESSIVA[sexo]
        fn_idade = idade_minima_progressiva

    idade_atual = _idade_em(data_nascimento, date.today())
    contrib_anos = tempo.anos
    ano_atual = date.today().year
    idade_min = fn_idade(ano_atual, sexo)

    faltantes: list[str] = []
    elegivel = True

    if contrib_anos < contrib_min:
        faltantes.append(f"Faltam {contrib_min - contrib_anos} anos de contribuição (mín. {contrib_min})")
        elegivel = False
    if idade_atual < idade_min:
        faltantes.append(f"Faltam {idade_min - idade_atual:.1f} anos de idade (mín. {idade_min} em {ano_atual})")
        elegivel = False

    coef = _coeficiente_pos_reforma(contrib_anos, sexo)
    beneficio = _calcular_beneficio(media, coef, piso, teto) if media else None

    data_eleg = None
    if not elegivel:
        def verifica(d: date) -> bool:
            i = _idade_em(data_nascimento, d)
            t = calcular_tempo_na_data(vinculos, d)
            im = fn_idade(d.year, sexo)
            return t.anos >= contrib_min and i >= im
        data_eleg = _projetar_data_elegibilidade(data_nascimento, vinculos, sexo, verifica)
    else:
        data_eleg = date.today()

    nome = "Idade Mínima Progressiva — Professor (Art. 16, §1°)" if professor else "Idade Mínima Progressiva (Art. 16)"

    return CenarioAposentadoria(
        regra=RegraAposentadoria.IDADE_PROGRESSIVA,
        regra_nome=nome,
        elegivel=elegivel,
        data_elegibilidade=data_eleg,
        beneficio_estimado=beneficio,
        coeficiente=coef,
        requisitos_faltantes=faltantes,
    )


def avaliar_pedagio_50(
    data_nascimento: date,
    sexo: str,
    tempo: TempoContribuicao,
    tempo_na_reforma: TempoContribuicao,
    media: Decimal | None,
    fator: FatorPrevidenciario | None,
    piso: Decimal,
    teto: Decimal,
    vinculos: list[Vinculo],
) -> CenarioAposentadoria:
    """Pedágio 50% (Art. 17): faltavam <=2 anos em 13/11/2019."""
    contrib_min = CONTRIB_MINIMA_PEDAGIO_50[sexo]
    contrib_na_reforma = tempo_na_reforma.total_dias / DIAS_POR_ANO
    faltava = max(0, contrib_min - contrib_na_reforma)

    # Só elegível se faltavam <= 2 anos na data da reforma
    if faltava > FALTAVA_MAXIMO_PEDAGIO_50:
        return CenarioAposentadoria(
            regra=RegraAposentadoria.PEDAGIO_50,
            regra_nome="Pedágio 50% (Art. 17)",
            elegivel=False,
            requisitos_faltantes=[
                f"Não se qualifica: faltavam {faltava:.1f} anos na reforma (máx. {FALTAVA_MAXIMO_PEDAGIO_50})"
            ],
        )

    # Tempo necessário: contrib_min + 50% do que faltava
    tempo_necessario = contrib_min + faltava * 0.5
    contrib_atual_anos = tempo.total_dias / DIAS_POR_ANO

    faltantes: list[str] = []
    elegivel = contrib_atual_anos >= tempo_necessario

    if not elegivel:
        falta = tempo_necessario - contrib_atual_anos
        faltantes.append(f"Faltam {falta:.1f} anos (necessário: {tempo_necessario:.1f} com pedágio)")

    # Benefício: fator previdenciário obrigatório
    beneficio = None
    fator_valor = None
    if media and fator:
        fator_valor = fator.valor
        beneficio = (media * Decimal(str(fator.valor))).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        beneficio = max(piso, min(beneficio, teto))

    data_eleg = None
    if not elegivel:
        tempo_necessario_dias = int(tempo_necessario * DIAS_POR_ANO)
        def verifica(d: date) -> bool:
            t = calcular_tempo_na_data(vinculos, d)
            return t.total_dias >= tempo_necessario_dias
        data_eleg = _projetar_data_elegibilidade(data_nascimento, vinculos, sexo, verifica)
    else:
        data_eleg = date.today()

    return CenarioAposentadoria(
        regra=RegraAposentadoria.PEDAGIO_50,
        regra_nome="Pedágio 50% (Art. 17)",
        elegivel=elegivel,
        data_elegibilidade=data_eleg,
        beneficio_estimado=beneficio,
        coeficiente=None,
        fator_previdenciario=fator_valor,
        requisitos_faltantes=faltantes,
    )


def avaliar_pedagio_100(
    data_nascimento: date,
    sexo: str,
    tempo: TempoContribuicao,
    tempo_na_reforma: TempoContribuicao,
    media: Decimal | None,
    piso: Decimal,
    teto: Decimal,
    vinculos: list[Vinculo],
    professor: bool = False,
) -> CenarioAposentadoria:
    """Pedágio 100% (Art. 20): 100% do benefício, mas precisa de mais tempo."""
    if professor:
        idade_min = IDADE_MINIMA_PEDAGIO_100_PROFESSOR[sexo]
        contrib_min = CONTRIB_MINIMA_PEDAGIO_100_PROFESSOR
    else:
        idade_min = IDADE_MINIMA_PEDAGIO_100[sexo]
        contrib_min = CONTRIB_MINIMA_PEDAGIO_100[sexo]

    idade_atual = _idade_em(data_nascimento, date.today())

    contrib_na_reforma = tempo_na_reforma.total_dias / DIAS_POR_ANO
    faltava = max(0, contrib_min - contrib_na_reforma)
    tempo_necessario = contrib_min + faltava  # 100% de pedágio
    contrib_atual_anos = tempo.total_dias / DIAS_POR_ANO

    faltantes: list[str] = []
    elegivel = True

    if idade_atual < idade_min:
        faltantes.append(f"Faltam {idade_min - idade_atual:.1f} anos de idade (mín. {idade_min})")
        elegivel = False
    if contrib_atual_anos < tempo_necessario:
        falta = tempo_necessario - contrib_atual_anos
        faltantes.append(f"Faltam {falta:.1f} anos de contribuição (necessário: {tempo_necessario:.1f} com pedágio)")
        elegivel = False

    # Benefício: 100% da média salarial (mais vantajoso)
    beneficio = None
    if media:
        beneficio = max(piso, min(media, teto))

    data_eleg = None
    if not elegivel:
        tempo_necessario_dias = int(tempo_necessario * DIAS_POR_ANO)
        def verifica(d: date) -> bool:
            i = _idade_em(data_nascimento, d)
            t = calcular_tempo_na_data(vinculos, d)
            return i >= idade_min and t.total_dias >= tempo_necessario_dias
        data_eleg = _projetar_data_elegibilidade(data_nascimento, vinculos, sexo, verifica)
    else:
        data_eleg = date.today()

    nome = "Pedágio 100% — Professor (Art. 20, §1°)" if professor else "Pedágio 100% (Art. 20)"

    return CenarioAposentadoria(
        regra=RegraAposentadoria.PEDAGIO_100,
        regra_nome=nome,
        elegivel=elegivel,
        data_elegibilidade=data_eleg,
        beneficio_estimado=beneficio,
        coeficiente=1.0,
        requisitos_faltantes=faltantes,
    )


def avaliar_direito_adquirido(
    data_nascimento: date,
    sexo: str,
    tempo_na_reforma: TempoContribuicao,
    media_80: Decimal | None,
    fator: FatorPrevidenciario | None,
    piso: Decimal,
    teto: Decimal,
    professor: bool = False,
) -> CenarioAposentadoria:
    """Direito adquirido: já cumpria requisitos antes de 13/11/2019."""
    idade_na_reforma = _idade_em(data_nascimento, DATA_REFORMA)
    contrib_na_reforma_anos = tempo_na_reforma.total_dias / DIAS_POR_ANO

    # Checar aposentadoria por tempo de contribuição (pré-reforma)
    if professor:
        contrib_req = CONTRIB_PRE_REFORMA_TEMPO_PROFESSOR[sexo]
        pontos_req = PONTOS_85_95_2019_PROFESSOR[sexo]
    else:
        contrib_req = CONTRIB_PRE_REFORMA_TEMPO[sexo]
        pontos_req = PONTOS_85_95_2019[sexo]

    cumpriu_tempo = contrib_na_reforma_anos >= contrib_req

    # Checar regra 85/95 (pontos na data da reforma) — para professor: 81/91
    pontos_na_reforma = int(idade_na_reforma) + int(contrib_na_reforma_anos)
    cumpriu_pontos = cumpriu_tempo and pontos_na_reforma >= pontos_req

    # Checar aposentadoria por idade (pré-reforma) — professor não usa essa via
    if professor:
        cumpriu_idade = False
    else:
        idade_req = IDADE_MINIMA_PRE_REFORMA[sexo]
        cumpriu_idade = idade_na_reforma >= idade_req and contrib_na_reforma_anos >= 15

    if not (cumpriu_tempo or cumpriu_idade):
        nome = "Direito Adquirido — Professor" if professor else "Direito Adquirido (Regras pré-reforma)"
        return CenarioAposentadoria(
            regra=RegraAposentadoria.DIREITO_ADQUIRIDO,
            regra_nome=nome,
            elegivel=False,
            requisitos_faltantes=[
                "Não havia completado os requisitos antes da reforma (13/11/2019)"
            ],
        )

    # Calcular benefício
    beneficio = None
    coef = None
    fator_valor = None

    if media_80:
        if cumpriu_pontos:
            # Regra 85/95 (ou 81/91 professor): sem fator, 100% da média dos 80% maiores
            beneficio = max(piso, min(media_80, teto))
            coef = 1.0
        elif cumpriu_tempo and fator:
            # Tempo de contribuição com fator previdenciário
            fator_valor = fator.valor
            beneficio = (media_80 * Decimal(str(fator.valor))).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            beneficio = max(piso, min(beneficio, teto))
        elif cumpriu_idade:
            # Aposentadoria por idade: 70% + 1% por ano de contribuição
            coef = min(1.0, 0.70 + 0.01 * int(contrib_na_reforma_anos))
            beneficio = _calcular_beneficio(media_80, coef, piso, teto)

    nome = "Direito Adquirido — Professor" if professor else "Direito Adquirido (Regras pré-reforma)"

    return CenarioAposentadoria(
        regra=RegraAposentadoria.DIREITO_ADQUIRIDO,
        regra_nome=nome,
        elegivel=True,
        data_elegibilidade=date.today(),
        beneficio_estimado=beneficio,
        coeficiente=coef,
        fator_previdenciario=fator_valor,
    )
