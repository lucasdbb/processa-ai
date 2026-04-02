"""Constantes legais para cálculos previdenciários.

Tabelas de progressão definidas pela EC 103/2019 (lei fixa, não mudam).
Valores de teto/piso e índices INPC ficam no banco (atualizáveis).
"""

from datetime import date

# Data da Reforma da Previdência (EC 103/2019)
DATA_REFORMA = date(2019, 11, 13)

# Alíquota fixa para fator previdenciário (Lei 9.876/1999)
ALIQUOTA_FATOR = 0.31

# ---------------------------------------------------------------------------
# Regra Permanente (Art. 201, §7°, CF/88 alterado pela EC 103/2019)
# ---------------------------------------------------------------------------

IDADE_MINIMA_PERMANENTE = {"M": 65, "F": 62}
CONTRIB_MINIMA_PERMANENTE_NOVOS = {"M": 20, "F": 15}  # Novos filiados pós-reforma
CONTRIB_MINIMA_PERMANENTE_ANTIGOS = {"M": 15, "F": 15}  # Já filiados antes da reforma

# ---------------------------------------------------------------------------
# Coeficiente do benefício pós-reforma
# 60% base + 2% por ano excedente acima do limiar
# ---------------------------------------------------------------------------

COEFICIENTE_BASE = 0.60
COEFICIENTE_POR_ANO_EXTRA = 0.02
LIMIAR_ANOS_COEFICIENTE = {"M": 20, "F": 15}

# ---------------------------------------------------------------------------
# Regra de Pontos (Art. 15, EC 103/2019)
# Idade + tempo de contribuição >= pontos do ano
# ---------------------------------------------------------------------------

CONTRIB_MINIMA_PONTOS = {"M": 35, "F": 30}

# Progressão: +1 ponto por ano
_PONTOS_BASE = {"M": 96, "F": 86}  # 2019
_PONTOS_CAP = {"M": 105, "F": 100}

def pontos_minimos(ano: int, sexo: str) -> int:
    """Pontos mínimos para a regra de pontos em determinado ano."""
    if ano < 2019:
        return 999  # Regra não existia
    base = _PONTOS_BASE[sexo]
    cap = _PONTOS_CAP[sexo]
    return min(base + (ano - 2019), cap)

# Ano em que a regra de pontos atinge o cap
ANO_CAP_PONTOS = {"M": 2028, "F": 2033}

# ---------------------------------------------------------------------------
# Idade Mínima Progressiva (Art. 16, EC 103/2019)
# +6 meses por ano
# ---------------------------------------------------------------------------

CONTRIB_MINIMA_IDADE_PROGRESSIVA = {"M": 35, "F": 30}

_IDADE_BASE_PROGRESSIVA = {"M": 61.0, "F": 56.0}  # 2019
_IDADE_CAP_PROGRESSIVA = {"M": 65.0, "F": 62.0}

def idade_minima_progressiva(ano: int, sexo: str) -> float:
    """Idade mínima progressiva para determinado ano."""
    if ano < 2019:
        return 999.0
    base = _IDADE_BASE_PROGRESSIVA[sexo]
    cap = _IDADE_CAP_PROGRESSIVA[sexo]
    return min(base + 0.5 * (ano - 2019), cap)

# ---------------------------------------------------------------------------
# Pedágio 50% (Art. 17, EC 103/2019)
# Apenas quem faltava <=2 anos em 13/11/2019
# ---------------------------------------------------------------------------

CONTRIB_MINIMA_PEDAGIO_50 = {"M": 35, "F": 30}
FALTAVA_MAXIMO_PEDAGIO_50 = 2  # anos

# ---------------------------------------------------------------------------
# Pedágio 100% (Art. 20, EC 103/2019)
# ---------------------------------------------------------------------------

IDADE_MINIMA_PEDAGIO_100 = {"M": 60, "F": 57}
CONTRIB_MINIMA_PEDAGIO_100 = {"M": 35, "F": 30}

# ---------------------------------------------------------------------------
# Direito Adquirido (regras anteriores à reforma)
# Requisitos completos até 13/11/2019
# ---------------------------------------------------------------------------

# Aposentadoria por idade (pré-reforma)
IDADE_MINIMA_PRE_REFORMA = {"M": 65, "F": 60}
CONTRIB_MINIMA_PRE_REFORMA_IDADE = 15  # carência mínima

# Aposentadoria por tempo de contribuição (pré-reforma)
CONTRIB_PRE_REFORMA_TEMPO = {"M": 35, "F": 30}

# Regra 85/95 progressiva (Lei 13.183/2015) - para 2019 era 86/96
PONTOS_85_95_2019 = {"M": 96, "F": 86}

# ---------------------------------------------------------------------------
# Professor da Educação Básica (Art. 16, §1° e Art. 20, §1°, EC 103/2019)
# Redução de 5 anos no tempo de contribuição e idade em relação ao comum
# ---------------------------------------------------------------------------

# Regra Permanente professor (Art. 201, §8°, CF)
IDADE_MINIMA_PERMANENTE_PROFESSOR = {"M": 60, "F": 57}
CONTRIB_MINIMA_PERMANENTE_PROFESSOR = 25  # ambos os sexos

# Contribuição mínima para regras de transição (professor)
CONTRIB_MINIMA_PROFESSOR = 25  # ambos os sexos

# Pontos progressivos para professor (Art. 15, §3°)
_PONTOS_BASE_PROFESSOR = {"M": 92, "F": 82}  # 2019
_PONTOS_CAP_PROFESSOR = {"M": 100, "F": 92}

def pontos_minimos_professor(ano: int, sexo: str) -> int:
    """Pontos mínimos para professor no ano."""
    if ano < 2019:
        return 999
    base = _PONTOS_BASE_PROFESSOR[sexo]
    cap = _PONTOS_CAP_PROFESSOR[sexo]
    return min(base + (ano - 2019), cap)

# Idade mínima progressiva para professor (Art. 16, §1°)
_IDADE_BASE_PROFESSOR = {"M": 56.0, "F": 51.0}  # 2019
_IDADE_CAP_PROFESSOR = {"M": 60.0, "F": 57.0}

def idade_minima_professor(ano: int, sexo: str) -> float:
    """Idade mínima progressiva para professor no ano."""
    if ano < 2019:
        return 999.0
    base = _IDADE_BASE_PROFESSOR[sexo]
    cap = _IDADE_CAP_PROFESSOR[sexo]
    return min(base + 0.5 * (ano - 2019), cap)

# Pedágio 100% professor (Art. 20, §1°)
IDADE_MINIMA_PEDAGIO_100_PROFESSOR = {"M": 55, "F": 52}
CONTRIB_MINIMA_PEDAGIO_100_PROFESSOR = 25  # ambos os sexos

# Direito adquirido professor (regras pré-reforma)
CONTRIB_PRE_REFORMA_TEMPO_PROFESSOR = {"M": 30, "F": 25}
PONTOS_85_95_2019_PROFESSOR = {"M": 91, "F": 81}  # 81/91 em 2019

# ---------------------------------------------------------------------------
# Conversão de tempo especial → comum (pré-reforma apenas)
# Art. 66 do Decreto 3.048/99
# Proibida após 13/11/2019 (Art. 25, §2°, EC 103/2019)
# ---------------------------------------------------------------------------

MULTIPLICADOR_ESPECIAL = {
    # (categoria_anos, sexo) → multiplicador
    (15, "M"): 2.33,
    (15, "F"): 2.00,
    (20, "M"): 1.75,
    (20, "F"): 1.50,
    (25, "M"): 1.40,
    (25, "F"): 1.20,
}

# ---------------------------------------------------------------------------
# Contagem de tempo INSS
# ---------------------------------------------------------------------------

DIAS_POR_MES = 30
DIAS_POR_ANO = 360
MESES_POR_ANO = 12

# Contribuições antes desta data não entram no cálculo do salário de benefício
DATA_INICIO_PLANO_REAL = date(1994, 7, 1)
