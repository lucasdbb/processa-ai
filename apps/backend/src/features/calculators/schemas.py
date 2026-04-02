from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class RescisaoTrabalhistaRequest(BaseModel):
    client_id: str | None = None

    # Composição Salarial
    salario_base: float = Field(gt=0, description="Salário base registrado na carteira")
    adicional_periculosidade: bool = False
    adicional_insalubridade_grau: int = Field(default=0, description="0, 10, 20 ou 40")
    base_insalubridade: float = Field(
        default=1621.00, description="Base de cálculo da insalubridade"
    )
    adicional_noturno_percent: float = Field(default=20.0, ge=0)
    media_horas_noturnas: float = Field(default=0.0, ge=0)
    outras_verbas: float = Field(default=0.0, ge=0)

    data_admissao: date
    data_rescisao: date
    tipo_rescisao: str = Field(min_length=1)
    tipo_aviso_previo: str = Field(
        default="indenizado",
        pattern="^(indenizado|trabalhado|dispensado|nao_cumprido)$",
        description=("Tipo de aviso prévio: indenizado, trabalhado, dispensado ou nao_cumprido"),
    )
    ferias_vencidas: int = Field(default=0, ge=0, le=365)
    ferias_proporcionais: bool = True
    decimo_terceiro: bool = True

    export_pdf: bool = False
    signed_url_expires_in: int = Field(default=3600, ge=60, le=60 * 60 * 24 * 7)


class RescisaoTrabalhistaDetalhes(BaseModel):
    remuneracao_bruta: float
    saldo_salario: float
    aviso_previo: float
    ferias_vencidas: float
    ferias_proporcionais: float
    decimo_terceiro: float
    fgts_acumulado: float
    fgts_rescisorio: float = 0.0
    multa_fgts: float
    inss: float = 0.0
    irrf: float = 0.0
    total_bruto: float
    total_descontos: float
    total: float


class PdfExport(BaseModel):
    job_id: str
    status: str = "queued"


class RescisaoTrabalhistaResponse(BaseModel):
    calculation_id: str
    calculator_key: str
    input: dict
    detalhes: RescisaoTrabalhistaDetalhes
    pdf: PdfExport | None = None


# ---------------------------------------------------------------------------
# Calculadoras Previdenciárias
# ---------------------------------------------------------------------------


class VinculoSchema(BaseModel):
    empresa: str | None = None
    cnpj: str | None = None
    data_inicio: date
    data_fim: date | None = None
    tipo_vinculo: str = "Empregado"
    atividade_especial: bool = False
    categoria_especial: int | None = Field(default=None, description="15, 20 ou 25 anos")
    indicadores: list[str] = []


class RemuneracaoSchema(BaseModel):
    competencia: date  # YYYY-MM-01
    valor: float = Field(gt=0)
    indicadores: list[str] = []


class DadosSeguradoSchema(BaseModel):
    nome: str | None = None
    cpf: str | None = None
    data_nascimento: date
    sexo: str = Field(pattern="^(M|F)$")
    professor: bool = False


# --- Tempo de Contribuição ---


class TempoContribuicaoRequest(BaseModel):
    vinculos: list[VinculoSchema] = Field(min_length=1)
    client_id: str | None = None
    export_pdf: bool = False


class TempoContribuicaoResult(BaseModel):
    anos: int
    meses: int
    dias: int
    total_dias: int
    vinculos_processados: int
    alertas: list[str]


class TempoContribuicaoResponse(BaseModel):
    calculation_id: str
    calculator_key: str
    input: dict
    detalhes: TempoContribuicaoResult
    pdf: PdfExport | None = None


# --- Média Salarial ---


class MediaSalarialRequest(BaseModel):
    remuneracoes: list[RemuneracaoSchema] = Field(min_length=1)
    client_id: str | None = None


class MediaSalarialResult(BaseModel):
    media_100: float
    media_80: float
    qtd_contribuicoes: int
    maior_contribuicao: float
    menor_contribuicao: float


class MediaSalarialResponse(BaseModel):
    calculation_id: str
    calculator_key: str
    input: dict
    detalhes: MediaSalarialResult
    pdf: PdfExport | None = None


# --- Fator Previdenciário ---


class FatorPrevidenciarioRequest(BaseModel):
    tempo_contribuicao_anos: float = Field(gt=0, le=60)
    idade: float = Field(gt=0, le=120)
    sexo: str = Field(pattern="^(M|F)$")


class FatorPrevidenciarioResult(BaseModel):
    fator: float
    formula_detalhada: str


class FatorPrevidenciarioResponse(BaseModel):
    fator: float
    formula_detalhada: str


# --- Simulação de Aposentadoria ---


class CenarioAposentadoriaSchema(BaseModel):
    regra: str
    regra_nome: str
    elegivel: bool
    data_elegibilidade: str | None = None
    beneficio_estimado: float | None = None
    coeficiente: float | None = None
    fator_previdenciario: float | None = None
    requisitos_faltantes: list[str] = []


class AposentadoriaRequest(BaseModel):
    segurado: DadosSeguradoSchema
    vinculos: list[VinculoSchema] = Field(min_length=1)
    remuneracoes: list[RemuneracaoSchema] = []
    client_id: str | None = None
    export_pdf: bool = True
    com_cnis: bool = False  # True se dados vieram de parse do CNIS
    salario_contribuicao_futuro: float | None = Field(
        default=None,
        gt=0,
        description="Salário de contribuição futuro para projeção",
    )


class CenarioProjetadoSchema(BaseModel):
    regra: str
    regra_nome: str
    meses_restantes: int
    data_elegibilidade: str
    tempo_contribuicao_projetado: float
    coeficiente_projetado: float | None = None
    beneficio_projetado: float | None = None


class ProjecaoFuturaSchema(BaseModel):
    salario_contribuicao: float
    cenario_mais_proximo: CenarioProjetadoSchema | None = None
    cenario_mais_vantajoso: CenarioProjetadoSchema | None = None
    ganho_mensal_esperar: float | None = None
    recomendacao: str


class AposentadoriaResult(BaseModel):
    tempo_contribuicao: TempoContribuicaoResult
    media_salarial: MediaSalarialResult | None = None
    cenarios: list[CenarioAposentadoriaSchema]
    melhor_cenario: str | None = None
    alertas: list[str]
    projecao: ProjecaoFuturaSchema | None = None


class AposentadoriaResponse(BaseModel):
    calculation_id: str
    calculator_key: str
    input: dict
    detalhes: AposentadoriaResult
    pdf: PdfExport | None = None


# --- Parse CNIS ---


class ParseCnisRequest(BaseModel):
    file_url: str


class CnisSeguradoSchema(BaseModel):
    nome: str | None = None
    cpf: str | None = None
    nit: str | None = None
    data_nascimento: str | None = None
    nome_mae: str | None = None


class CnisVinculoSchema(BaseModel):
    sequencia: int | None = None
    empresa: str | None = None
    cnpj: str | None = None
    tipo: str | None = None
    data_inicio: str | None = None
    data_fim: str | None = None
    ultima_remuneracao: float | None = None
    indicadores: list[str] = []
    remuneracoes: list[RemuneracaoSchema] = []


class ParseCnisResult(BaseModel):
    segurado: CnisSeguradoSchema
    vinculos: list[CnisVinculoSchema]
    alertas: list[str]


class ParseCnisResponse(BaseModel):
    job_id: str
    status: str = "queued"


class CalculatorResponse(BaseModel):
    """Response para uma calculadora disponível."""

    slug: str
    name: str
    description: str
    icon: str
    path: str
    locked: bool
    order: int


class CalculatorsListResponse(BaseModel):
    """Lista de calculadoras disponíveis."""

    calculators: list[CalculatorResponse]


class CalculationHistoryItem(BaseModel):
    """Item do histórico de cálculos."""

    id: str
    calculator_key: str
    status: str
    client_id: str | None = None
    input_payload: dict | None = None
    output_payload: dict | None = None
    error: str | None = None
    created_at: str
    finished_at: str | None = None
    document_id: str | None = None


class CalculationHistoryResponse(BaseModel):
    """Resposta do histórico de cálculos."""

    calculations: list[CalculationHistoryItem]
