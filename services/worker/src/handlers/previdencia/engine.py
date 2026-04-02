"""Engine orquestrador da Simulação de Aposentadoria.

Recebe os dados do segurado, vínculos e remunerações,
executa os módulos intermediários e avalia os 6 cenários.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from .constantes import DATA_REFORMA
from .fator_previdenciario import calcular_fator_previdenciario
from .media_salarial import calcular_media_salarial
from .regras import (
    _calcular_beneficio,
    _coeficiente_pos_reforma,
    avaliar_direito_adquirido,
    avaliar_idade_progressiva,
    avaliar_pedagio_100,
    avaliar_pedagio_50,
    avaliar_permanente,
    avaliar_pontos,
)
from .tempo_contribuicao import calcular_tempo_contribuicao, calcular_tempo_na_data
from .tipos import (
    CenarioAposentadoria,
    CenarioProjetado,
    DadosSegurado,
    FatorPrevidenciario,
    MediaSalarial,
    ProjecaoFutura,
    RegraAposentadoria,
    Remuneracao,
    ResultadoSimulacao,
    Sexo,
    TempoContribuicao,
    Vinculo,
)


def _buscar_expectativa_sobrevida(idade: int, tabua: dict[int, float]) -> float:
    """Busca expectativa de sobrevida na tábua IBGE pela idade."""
    if idade in tabua:
        return tabua[idade]
    # Interpolar para idades fora da tabela
    idades = sorted(tabua.keys())
    if idade < idades[0]:
        return tabua[idades[0]]
    if idade > idades[-1]:
        return tabua[idades[-1]]
    # Interpolação linear
    for i in range(len(idades) - 1):
        if idades[i] <= idade <= idades[i + 1]:
            frac = (idade - idades[i]) / (idades[i + 1] - idades[i])
            return tabua[idades[i]] + frac * (tabua[idades[i + 1]] - tabua[idades[i]])
    return 20.0  # fallback


def _calcular_projecao(
    cenarios: list[CenarioAposentadoria],
    tempo_atual: TempoContribuicao,
    media_atual_100: Decimal | None,
    salario_futuro: Decimal,
    sexo: str,
    piso: Decimal,
    teto: Decimal,
    fator: FatorPrevidenciario | None,
    tabua_mortalidade: dict[int, float] | None,
    data_nascimento: date,
) -> ProjecaoFutura | None:
    """Calcula projeção futura: recalcula benefício na data de elegibilidade."""
    from dateutil.relativedelta import relativedelta
    from .constantes import DIAS_POR_ANO

    hoje = date.today()
    media_base = media_atual_100 or salario_futuro

    # Projetar cada cenário não-elegível com data de elegibilidade
    projetados: list[CenarioProjetado] = []

    for c in cenarios:
        if c.elegivel or not c.data_elegibilidade:
            continue
        # Direito adquirido não se projeta (se não é elegível, nunca será)
        if c.regra == RegraAposentadoria.DIREITO_ADQUIRIDO:
            continue

        delta = relativedelta(c.data_elegibilidade, hoje)
        meses_restantes = delta.years * 12 + delta.months + (1 if delta.days > 0 else 0)
        if meses_restantes <= 0:
            continue

        # Tempo de contribuição projetado (atual + meses de contribuição futura)
        tempo_projetado = tempo_atual.total_dias / DIAS_POR_ANO + meses_restantes / 12

        # Calcular coeficiente e benefício projetados por tipo de regra
        coef_projetado: float | None = None
        beneficio_projetado: Decimal | None = None

        if c.regra == RegraAposentadoria.PEDAGIO_100:
            # Pedágio 100%: 100% da média
            coef_projetado = 1.0
            beneficio_projetado = max(piso, min(media_base, teto))
        elif c.regra == RegraAposentadoria.PEDAGIO_50:
            # Pedágio 50%: usa fator previdenciário recalculado na data futura
            if tabua_mortalidade:
                idade_futura = relativedelta(c.data_elegibilidade, data_nascimento)
                idade_futura_anos = idade_futura.years + idade_futura.months / 12
                es = _buscar_expectativa_sobrevida(int(idade_futura_anos), tabua_mortalidade)
                fator_futuro = calcular_fator_previdenciario(
                    tempo_contribuicao_anos=tempo_projetado,
                    idade=idade_futura_anos,
                    sexo=sexo,
                    expectativa_sobrevida=es,
                )
                coef_projetado = fator_futuro.valor
                beneficio_projetado = _calcular_beneficio(media_base, fator_futuro.valor, piso, teto)
            elif fator:
                coef_projetado = fator.valor
                beneficio_projetado = _calcular_beneficio(media_base, fator.valor, piso, teto)
        else:
            # Permanente, Pontos, Idade Progressiva: coeficiente pós-reforma
            coef_projetado = _coeficiente_pos_reforma(int(tempo_projetado), sexo)
            beneficio_projetado = _calcular_beneficio(media_base, coef_projetado, piso, teto)

        projetados.append(CenarioProjetado(
            regra=c.regra,
            regra_nome=c.regra_nome,
            meses_restantes=meses_restantes,
            data_elegibilidade=c.data_elegibilidade,
            tempo_contribuicao_projetado=round(tempo_projetado, 2),
            coeficiente_projetado=round(coef_projetado, 4) if coef_projetado else None,
            beneficio_projetado=beneficio_projetado,
        ))

    if not projetados:
        return None

    # Cenário mais próximo
    mais_proximo = min(projetados, key=lambda p: p.meses_restantes)

    # Cenário mais vantajoso (maior benefício)
    com_beneficio = [p for p in projetados if p.beneficio_projetado]
    mais_vantajoso: CenarioProjetado | None = None
    ganho: Decimal | None = None

    if com_beneficio:
        melhor_beneficio = max(com_beneficio, key=lambda p: p.beneficio_projetado or Decimal(0))
        if melhor_beneficio.regra != mais_proximo.regra and melhor_beneficio.beneficio_projetado:
            mais_vantajoso = melhor_beneficio
            ben_proximo = mais_proximo.beneficio_projetado or Decimal(0)
            ganho = melhor_beneficio.beneficio_projetado - ben_proximo

    # Gerar recomendação
    recomendacao = _gerar_recomendacao(
        cenarios=cenarios,
        mais_proximo=mais_proximo,
        mais_vantajoso=mais_vantajoso,
        ganho=ganho,
        salario_futuro=salario_futuro,
    )

    return ProjecaoFutura(
        salario_contribuicao=salario_futuro,
        cenario_mais_proximo=mais_proximo,
        cenario_mais_vantajoso=mais_vantajoso,
        ganho_mensal_esperar=ganho,
        recomendacao=recomendacao,
    )


def _gerar_recomendacao(
    cenarios: list[CenarioAposentadoria],
    mais_proximo: CenarioProjetado,
    mais_vantajoso: CenarioProjetado | None,
    ganho: Decimal | None,
    salario_futuro: Decimal,
) -> str:
    """Gera texto de recomendação em português."""

    def _fmt_moeda(v: Decimal | None) -> str:
        if v is None:
            return "—"
        return f"R$ {float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    def _fmt_data(d: date) -> str:
        meses_pt = [
            "", "jan", "fev", "mar", "abr", "mai", "jun",
            "jul", "ago", "set", "out", "nov", "dez",
        ]
        return f"{meses_pt[d.month]}/{d.year}"

    def _fmt_coef(c: float | None) -> str:
        if c is None:
            return ""
        return f" (coeficiente {c * 100:.0f}%)"

    elegiveis = [c for c in cenarios if c.elegivel and c.beneficio_estimado]

    # Caso 2: Já tem elegível — comparar com cenário futuro melhor
    if elegiveis:
        melhor_atual = max(elegiveis, key=lambda c: c.beneficio_estimado or Decimal(0))
        nome_atual = melhor_atual.regra_nome
        ben_atual = _fmt_moeda(melhor_atual.beneficio_estimado)

        if mais_vantajoso and mais_vantajoso.beneficio_projetado and melhor_atual.beneficio_estimado:
            if mais_vantajoso.beneficio_projetado > melhor_atual.beneficio_estimado:
                diff = mais_vantajoso.beneficio_projetado - melhor_atual.beneficio_estimado
                return (
                    f"Você já pode se aposentar pela {nome_atual} com benefício de {ben_atual}. "
                    f"Porém, se continuar contribuindo por mais {mais_vantajoso.meses_restantes} meses "
                    f"com salário de {_fmt_moeda(salario_futuro)}, atingirá a "
                    f"{mais_vantajoso.regra_nome} com benefício de "
                    f"{_fmt_moeda(mais_vantajoso.beneficio_projetado)}"
                    f"{_fmt_coef(mais_vantajoso.coeficiente_projetado)}"
                    f" — um ganho de {_fmt_moeda(diff)}/mês."
                )

        # Cenário mais próximo futuro é melhor que o elegível atual?
        if mais_proximo.beneficio_projetado and melhor_atual.beneficio_estimado:
            if mais_proximo.beneficio_projetado > melhor_atual.beneficio_estimado:
                diff = mais_proximo.beneficio_projetado - melhor_atual.beneficio_estimado
                return (
                    f"Você já pode se aposentar pela {nome_atual} com benefício de {ben_atual}. "
                    f"Se continuar contribuindo por mais {mais_proximo.meses_restantes} meses, "
                    f"atingirá a {mais_proximo.regra_nome} com benefício de "
                    f"{_fmt_moeda(mais_proximo.beneficio_projetado)}"
                    f"{_fmt_coef(mais_proximo.coeficiente_projetado)}"
                    f" — um ganho de {_fmt_moeda(diff)}/mês."
                )

        return (
            f"Você já pode se aposentar pela {nome_atual} com benefício de {ben_atual}. "
            f"Não há cenário futuro projetado com benefício significativamente maior."
        )

    # Caso 1 e 3: Nenhum elegível hoje
    nome_proximo = mais_proximo.regra_nome
    data_proximo = _fmt_data(mais_proximo.data_elegibilidade)
    ben_proximo = _fmt_moeda(mais_proximo.beneficio_projetado)

    if mais_vantajoso and ganho and ganho > 0:
        meses_extra = mais_vantajoso.meses_restantes - mais_proximo.meses_restantes
        return (
            f"Continuando a contribuir com salário de {_fmt_moeda(salario_futuro)}, "
            f"a regra mais próxima é {nome_proximo} em {data_proximo} "
            f"({mais_proximo.meses_restantes} meses), com benefício projetado de "
            f"{ben_proximo}{_fmt_coef(mais_proximo.coeficiente_projetado)}. "
            f"Se esperar mais {meses_extra} meses, poderá usar a "
            f"{mais_vantajoso.regra_nome} com benefício de "
            f"{_fmt_moeda(mais_vantajoso.beneficio_projetado)}"
            f"{_fmt_coef(mais_vantajoso.coeficiente_projetado)}"
            f" — um ganho de {_fmt_moeda(ganho)}/mês."
        )

    # Caso 3: mais próximo == mais vantajoso
    return (
        f"Continuando a contribuir com salário de {_fmt_moeda(salario_futuro)}, "
        f"a melhor opção é a {nome_proximo} em {data_proximo} "
        f"({mais_proximo.meses_restantes} meses), com benefício projetado de "
        f"{ben_proximo}{_fmt_coef(mais_proximo.coeficiente_projetado)}."
    )


def simular_aposentadoria(
    segurado: DadosSegurado,
    vinculos: list[Vinculo],
    remuneracoes: list[Remuneracao] | None = None,
    indices_inpc: dict[date, Decimal] | None = None,
    tabua_mortalidade: dict[int, float] | None = None,
    teto_inss: Decimal = Decimal("8475.55"),
    piso_inss: Decimal = Decimal("1621.00"),
    salario_contribuicao_futuro: Decimal | None = None,
) -> ResultadoSimulacao:
    """Executa a simulação completa de aposentadoria.

    Args:
        segurado: Dados pessoais do segurado.
        vinculos: Lista de vínculos empregatícios.
        remuneracoes: Lista de remunerações mensais (opcional).
        indices_inpc: Mapa competência → fator de correção INPC.
        tabua_mortalidade: Mapa idade → expectativa de sobrevida.
        teto_inss: Teto do INSS vigente.
        piso_inss: Piso (salário mínimo) vigente.

    Returns:
        ResultadoSimulacao com todos os cenários avaliados.
    """
    sexo = segurado.sexo.value if isinstance(segurado.sexo, Sexo) else segurado.sexo
    professor = segurado.professor
    alertas: list[str] = []

    if professor:
        alertas.append("Regras de professor da educação básica aplicadas (Art. 16, §1° e Art. 20, §1°, EC 103/2019).")

    # --- 1. Tempo de contribuição atual ---
    tempo = calcular_tempo_contribuicao(vinculos)
    alertas.extend(tempo.alertas)

    # --- 2. Tempo de contribuição na data da reforma ---
    tempo_na_reforma = calcular_tempo_na_data(vinculos, DATA_REFORMA)

    # --- 3. Média salarial ---
    media: MediaSalarial | None = None
    if remuneracoes:
        media = calcular_media_salarial(
            remuneracoes,
            indices_inpc=indices_inpc,
            teto_atual=teto_inss,
            piso_atual=piso_inss,
        )

    media_100 = media.media_100 if media else None
    media_80 = media.media_80 if media else None

    # --- 4. Fator previdenciário ---
    fator = None
    if tabua_mortalidade:
        from dateutil.relativedelta import relativedelta
        idade_atual = relativedelta(date.today(), segurado.data_nascimento)
        idade_anos = idade_atual.years + idade_atual.months / 12
        es = _buscar_expectativa_sobrevida(int(idade_anos), tabua_mortalidade)
        fator = calcular_fator_previdenciario(
            tempo_contribuicao_anos=tempo.total_anos_decimal,
            idade=idade_anos,
            sexo=sexo,
            expectativa_sobrevida=es,
        )

    # --- 5. Avaliar cenários ---
    cenarios: list[CenarioAposentadoria] = []

    # 5.1 Regra Permanente
    cenarios.append(
        avaliar_permanente(
            segurado.data_nascimento, sexo, tempo,
            media_100, piso_inss, teto_inss, vinculos,
            professor=professor,
        )
    )

    # 5.2 Regra de Pontos
    cenarios.append(
        avaliar_pontos(
            segurado.data_nascimento, sexo, tempo,
            media_100, piso_inss, teto_inss, vinculos,
            professor=professor,
        )
    )

    # 5.3 Idade Mínima Progressiva
    cenarios.append(
        avaliar_idade_progressiva(
            segurado.data_nascimento, sexo, tempo,
            media_100, piso_inss, teto_inss, vinculos,
            professor=professor,
        )
    )

    # 5.4 Pedágio 50% (não se aplica a professor — usará requisitos comuns)
    cenarios.append(
        avaliar_pedagio_50(
            segurado.data_nascimento, sexo, tempo, tempo_na_reforma,
            media_100, fator, piso_inss, teto_inss, vinculos,
        )
    )

    # 5.5 Pedágio 100%
    cenarios.append(
        avaliar_pedagio_100(
            segurado.data_nascimento, sexo, tempo, tempo_na_reforma,
            media_100, piso_inss, teto_inss, vinculos,
            professor=professor,
        )
    )

    # 5.6 Direito Adquirido
    cenarios.append(
        avaliar_direito_adquirido(
            segurado.data_nascimento, sexo, tempo_na_reforma,
            media_80, fator, piso_inss, teto_inss,
            professor=professor,
        )
    )

    # --- 6. Determinar melhor cenário ---
    melhor = _determinar_melhor_cenario(cenarios)

    # --- 7. Projeção futura ---
    projecao = None
    if salario_contribuicao_futuro is not None:
        projecao = _calcular_projecao(
            cenarios=cenarios,
            tempo_atual=tempo,
            media_atual_100=media_100,
            salario_futuro=salario_contribuicao_futuro,
            sexo=sexo,
            piso=piso_inss,
            teto=teto_inss,
            fator=fator,
            tabua_mortalidade=tabua_mortalidade,
            data_nascimento=segurado.data_nascimento,
        )

    return ResultadoSimulacao(
        segurado=segurado,
        tempo_contribuicao=tempo,
        media_salarial=media,
        cenarios=cenarios,
        melhor_cenario=melhor,
        alertas=alertas,
        projecao=projecao,
    )


def _determinar_melhor_cenario(
    cenarios: list[CenarioAposentadoria],
) -> RegraAposentadoria | None:
    """Determina o melhor cenário: prioriza elegíveis com maior benefício.

    Se nenhum é elegível, prioriza o com data de elegibilidade mais próxima.
    """
    elegiveis = [c for c in cenarios if c.elegivel and c.beneficio_estimado]
    if elegiveis:
        melhor = max(elegiveis, key=lambda c: c.beneficio_estimado or Decimal(0))
        return melhor.regra

    # Nenhum elegível: mais cedo
    com_data = [c for c in cenarios if c.data_elegibilidade]
    if com_data:
        mais_cedo = min(com_data, key=lambda c: c.data_elegibilidade)  # type: ignore
        return mais_cedo.regra

    return None
