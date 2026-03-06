"""Shared pytest fixtures for the worker test suite."""

import pytest


@pytest.fixture
def cnis_payload() -> dict:
    """Sample CNIS analysis payload matching the Gemini JSON output schema."""
    return {
        "resumo_segurado": {
            "cpf": "000.000.000-00",
            "nit": "000.00000.00-0",
            "nome": "FULANA DE TAL SILVA",
            "nome_mae": "BELTRANA DE TAL",
            "data_nascimento": "01/01/1970",
        },
        "resumo_executivo": (
            "A segurada possui histórico contributivo de aproximadamente 30 anos. "
            "Existem vínculos com indicadores que requerem documentação adicional."
        ),
        "vinculos": [
            {
                "empresa": "EMPRESA ALPHA LTDA (00.000.001/0001-00)",
                "periodo": {"inicio": "01/01/1990", "fim": "31/12/1995"},
                "indicadores": [],
                "analise_critica": "Vínculo regular.",
            },
            {
                "empresa": "EMPRESA BETA S.A. (00.000.002/0001-00)",
                "periodo": {"inicio": "01/03/2000", "fim": "28/02/2010"},
                "indicadores": ["PEXT"],
                "analise_critica": "Indicador PEXT requer documentação.",
            },
            {
                "empresa": "EMPRESA GAMMA LTDA (00.000.003/0001-00)",
                "periodo": {"inicio": "01/01/2015"},
                "indicadores": ["IVIN-JORN-DIFERENCIADA"],
                "analise_critica": "Vínculo ativo, sem data de encerramento.",
            },
        ],
        "indicadores": [
            {
                "codigo": "PEXT",
                "descricao": "Vínculo com informação extemporânea.",
                "implicacao": "Requer documentação para averbação.",
            },
            {
                "codigo": "IVIN-JORN-DIFERENCIADA",
                "descricao": "Vínculo com jornada diferenciada.",
                "implicacao": "Verificar atingimento do salário mínimo.",
            },
        ],
        "dados_previdenciarios": {
            "quantidade_vinculos": 3,
            "tempo_total_estimado": {"anos": 20, "meses": 6, "dias": 0},
            "periodos_sem_contribuicao": 1,
            "maior_salario_contribuicao": 5000.00,
            "contribuicoes_abaixo_minimo": 0,
        },
        "alertas_gerais": [
            "Vínculo aberto sem data de encerramento.",
            "Indicador PEXT requer regularização preventiva.",
        ],
    }


@pytest.fixture
def process_summary_payload() -> dict:
    """Sample process summary payload matching the Gemini JSON output schema."""
    return {
        "identificacao": {
            "tipo_acao": "Reclamação Trabalhista",
            "numero_processo": "0100000-00.2025.5.00.0000",
            "vara_tribunal": "0ª Vara do Trabalho de Cidade/UF",
            "autor": "Fulano de Tal Silva",
            "reu": "Empresa Exemplo de Serviços Ltda",
            "advogado_autor": "Dra. Advogada Exemplo (OAB/UF 000.000)",
            "advogado_reu": "Dr. Advogado Exemplo Réu (OAB/UF 000.001)",
            "juiz_relator": "Dr. Juiz Exemplo",
        },
        "valor_causa": "R$ 100.000,00",
        "resumo_executivo": (
            "Reclamação trabalhista ajuizada pelo reclamante alegando vínculo empregatício "
            "não reconhecido, pagamento de verbas rescisórias inadimplidas, horas extras, "
            "adicional de insalubridade e acúmulo de função. A reclamada contestou os pedidos "
            "alegando inexistência de horas extras e ausência de insalubridade. "
            "Sentença julgou parcialmente procedentes os pedidos. Processo em fase de execução."
        ),
        "fatos_relevantes": [
            "Reclamante foi admitido em 01/01/2020 para exercer a função de auxiliar.",
            "Rescisão sem justa causa ocorreu em 01/01/2025, sem pagamento das verbas rescisórias.",
            "Reclamante ajuizou a demanda em 15/01/2025.",
            "Audiência de instrução realizada com coleta de depoimento pessoal e testemunhos.",
            "Perícia técnica constatou insalubridade em grau médio por exposição a agentes nocivos.",
            "Sentença de mérito proferida julgando parcialmente procedentes os pedidos.",
        ],
        "pedidos": [
            "Reconhecimento de vínculo empregatício e anotação na CTPS.",
            "Pagamento das verbas rescisórias (saldo de salário, férias, 13º e aviso prévio).",
            "Depósitos de FGTS de todo o período acrescidos da multa de 40%.",
            "Pagamento de horas extras acima da jornada contratual com adicional de 50%.",
            "Adicional de insalubridade em grau médio (20%) com reflexos legais.",
            "Adicional por acúmulo de função (10%) pelo período correspondente.",
            "Indenização por danos morais no valor de R$ 10.000,00.",
            "Honorários advocatícios sucumbenciais de 15%.",
        ],
        "decisoes": [
            {
                "data": "01/06/2025",
                "tipo": "Sentença",
                "conteudo": (
                    "Julgou parcialmente procedentes os pedidos, condenando a reclamada ao "
                    "pagamento de adicional de insalubridade, verbas rescisórias e FGTS + 40%. "
                    "Indeferiu horas extras e danos morais."
                ),
            },
            {
                "data": "10/10/2025",
                "tipo": "Decisão Interlocutória",
                "conteudo": (
                    "Homologou os cálculos de liquidação no valor de R$ 60.000,00 e intimou a "
                    "reclamada para pagamento em 48 horas, sob pena de execução forçada."
                ),
            },
            {
                "data": "20/11/2025",
                "tipo": "Despacho",
                "conteudo": "Determinou bloqueio via Sisbajud ante o inadimplemento da reclamada.",
            },
        ],
        "prazos_datas": [
            {
                "data": "A definir",
                "descricao": "Decisão sobre pedido de parcelamento (art. 916 CPC).",
            },
            {"data": "A definir", "descricao": "Vencimento das parcelas mensais vincendas."},
        ],
        "pontos_atencao": [
            "Verificar se o depósito de 30% exigido pelo art. 916 CPC foi realizado corretamente.",
            "Monitorar o cumprimento das parcelas e denunciar inadimplência imediatamente.",
        ],
        "proximos_passos": [
            "Acompanhar publicações para verificar deferimento do parcelamento e expedição de alvará.",
            "Conferir mensalmente os depósitos das parcelas vincendas.",
            "Requerer expedição de ofício para habilitação no Seguro-Desemprego conforme sentença.",
        ],
    }
