from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class RescisaoTrabalhistaRequest(BaseModel):
    user_id: str = Field(min_length=1)
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
    aviso_previo: bool = True
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
    fgts: float
    fgts_rescisorio: float = 0.0
    multa_fgts: float
    total: float


class PdfExport(BaseModel):
    download_url: str
    bucket: str
    storage_path: str
    document_id: str | None = None
    expires_in: int


class RescisaoTrabalhistaResponse(BaseModel):
    calculation_id: str
    calculator_key: str
    input: dict
    detalhes: RescisaoTrabalhistaDetalhes
    pdf: PdfExport | None = None


class AposentadoriaRequest(BaseModel):
    user_id: str = Field(min_length=1)
    client_id: str | None = None

    sexo: str = Field(pattern="^(masculino|feminino)$")
    tipo_aposentadoria: str = Field(default="tempo_contribuicao")
    idade: int = Field(gt=0, le=150)
    tempo_contribuicao: int = Field(ge=0, le=100)
    salario_contribuicao: float = Field(ge=0)

    export_pdf: bool = False
    signed_url_expires_in: int = Field(default=3600, ge=60, le=60 * 60 * 24 * 7)


class AposentadoriaDetalhes(BaseModel):
    pode_aposentar: bool
    anos_restantes: int
    tempo_restante: int
    beneficio: float
    idade_minima: int
    tempo_minimo_contrib: int


class AposentadoriaResponse(BaseModel):
    calculation_id: str
    calculator_key: str
    input: dict
    detalhes: AposentadoriaDetalhes
    pdf: PdfExport | None = None


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
