"""Tipos de dados para o engine de cálculo previdenciário."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum


class Sexo(str, Enum):
    MASCULINO = "M"
    FEMININO = "F"


class TipoVinculo(str, Enum):
    EMPREGADO = "Empregado"
    CONTRIBUINTE_INDIVIDUAL = "Contribuinte Individual"
    FACULTATIVO = "Facultativo"
    AVULSO = "Avulso"
    DOMESTICO = "Empregado Doméstico"
    SEGURADO_ESPECIAL = "Segurado Especial"
    SERVIDOR_PUBLICO = "Servidor Público"
    BENEFICIO = "Benefício"


class CategoriaEspecial(int, Enum):
    """Tempo mínimo de exposição para aposentadoria especial."""
    ANOS_15 = 15
    ANOS_20 = 20
    ANOS_25 = 25


class RegraAposentadoria(str, Enum):
    PERMANENTE = "permanente"
    PONTOS = "pontos"
    IDADE_PROGRESSIVA = "idade_progressiva"
    PEDAGIO_50 = "pedagio_50"
    PEDAGIO_100 = "pedagio_100"
    DIREITO_ADQUIRIDO = "direito_adquirido"


# ---------------------------------------------------------------------------
# Dados de entrada
# ---------------------------------------------------------------------------

@dataclass
class Vinculo:
    data_inicio: date
    data_fim: date | None = None  # None = vínculo aberto / ativo
    empresa: str | None = None
    cnpj: str | None = None
    tipo_vinculo: TipoVinculo = TipoVinculo.EMPREGADO
    atividade_especial: bool = False
    categoria_especial: CategoriaEspecial | None = None
    indicadores: list[str] = field(default_factory=list)


@dataclass
class Remuneracao:
    competencia: date  # primeiro dia do mês (YYYY-MM-01)
    valor: Decimal
    indicadores: list[str] = field(default_factory=list)


@dataclass
class DadosSegurado:
    data_nascimento: date
    sexo: Sexo
    nome: str | None = None
    cpf: str | None = None
    nit: str | None = None
    professor: bool = False
    atividade_especial: bool = False
    categoria_especial: CategoriaEspecial | None = None


# ---------------------------------------------------------------------------
# Resultados intermediários
# ---------------------------------------------------------------------------

@dataclass
class TempoContribuicao:
    anos: int
    meses: int
    dias: int
    total_dias: int
    vinculos_processados: int = 0
    alertas: list[str] = field(default_factory=list)

    @property
    def total_anos_decimal(self) -> float:
        """Tempo em anos decimais (para fórmulas)."""
        return self.total_dias / 360


@dataclass
class MediaSalarial:
    media_100: Decimal  # pós-reforma: 100% das contribuições
    media_80: Decimal   # pré-reforma: 80% maiores
    qtd_contribuicoes: int
    maior_contribuicao: Decimal
    menor_contribuicao: Decimal


@dataclass
class FatorPrevidenciario:
    valor: float
    formula_detalhada: str  # ex: "(36 × 0.31 / 22.5) × [1 + ...]"
    tc_usado: float         # tempo de contribuição usado (com bônus mulher)
    es_usado: float         # expectativa de sobrevida usada
    id_usado: float         # idade usada


# ---------------------------------------------------------------------------
# Resultado por cenário
# ---------------------------------------------------------------------------

@dataclass
class CenarioAposentadoria:
    regra: RegraAposentadoria
    regra_nome: str
    elegivel: bool
    data_elegibilidade: date | None = None
    beneficio_estimado: Decimal | None = None
    coeficiente: float | None = None
    fator_previdenciario: float | None = None
    requisitos_faltantes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Projeção futura
# ---------------------------------------------------------------------------

@dataclass
class CenarioProjetado:
    """Cenário futuro com benefício recalculado na data de elegibilidade."""
    regra: RegraAposentadoria
    regra_nome: str
    meses_restantes: int
    data_elegibilidade: date
    tempo_contribuicao_projetado: float  # anos decimais na data
    coeficiente_projetado: float | None
    beneficio_projetado: Decimal | None


@dataclass
class ProjecaoFutura:
    """Análise comparativa dos cenários futuros."""
    salario_contribuicao: Decimal
    cenario_mais_proximo: CenarioProjetado | None
    cenario_mais_vantajoso: CenarioProjetado | None  # None se igual ao mais próximo
    ganho_mensal_esperar: Decimal | None
    recomendacao: str


# ---------------------------------------------------------------------------
# Resultado final da simulação
# ---------------------------------------------------------------------------

@dataclass
class ResultadoSimulacao:
    segurado: DadosSegurado
    tempo_contribuicao: TempoContribuicao
    media_salarial: MediaSalarial | None
    cenarios: list[CenarioAposentadoria]
    melhor_cenario: RegraAposentadoria | None = None
    alertas: list[str] = field(default_factory=list)
    projecao: ProjecaoFutura | None = None


# ---------------------------------------------------------------------------
# Dados do CNIS parseado
# ---------------------------------------------------------------------------

@dataclass
class CnisSegurado:
    nome: str | None = None
    cpf: str | None = None
    nit: str | None = None
    data_nascimento: date | None = None
    nome_mae: str | None = None


@dataclass
class CnisVinculo:
    sequencia: int | None = None
    empresa: str | None = None
    cnpj: str | None = None
    tipo: str | None = None
    data_inicio: date | None = None
    data_fim: date | None = None
    ultima_remuneracao: Decimal | None = None
    indicadores: list[str] = field(default_factory=list)
    remuneracoes: list[Remuneracao] = field(default_factory=list)


@dataclass
class CnisExtraido:
    segurado: CnisSegurado
    vinculos: list[CnisVinculo]
    alertas: list[str] = field(default_factory=list)
