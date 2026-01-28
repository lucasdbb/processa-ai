from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field


class RescisaoTrabalhistaRequest(BaseModel):
    user_id: str = Field(min_length=1)
    client_id: str | None = None

    salario_mensal: float = Field(gt=0)
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
    saldo_salario: float
    aviso_previo: float
    ferias_vencidas: float
    ferias_proporcionais: float
    decimo_terceiro: float
    fgts: float
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
