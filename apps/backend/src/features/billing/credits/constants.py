"""
Constantes do sistema de créditos.

Substituem as tabelas credit_costs e credit_packages do banco de dados.
Esses valores raramente mudam e não justificam tabelas dedicadas.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class FeatureCost:
    feature_key: str
    display_name: str
    base_cost: int
    description: str
    is_active: bool = True


@dataclass(frozen=True)
class CreditPackageDef:
    id: str
    name: str
    credits: int
    price_cents: int
    sort_order: int = 0


# Custo de cada feature em créditos (era tabela credit_costs)
FEATURE_COSTS: dict[str, FeatureCost] = {
    fc.feature_key: fc
    for fc in [
        FeatureCost("ai_chat_session", "Sessão Chat IA Jurídica", 3, "Sessão de chat com a IA jurídica (mensagens ilimitadas)"),
        FeatureCost(
            "cnis_analysis", "Análise de CNIS", 5, "Análise completa de extrato previdenciário"
        ),
        FeatureCost(
            "process_summary", "Resumo de Processo", 5, "Resumo inteligente de processo judicial"
        ),
        FeatureCost(
            "labor_claim", "Reclamação Trabalhista", 5, "Geração de reclamação trabalhista com IA"
        ),
        FeatureCost("brief_scanner", "Scanner de Peças", 3, "Análise de peças processuais com IA"),
        FeatureCost(
            "calculator_rescisao", "Calculadora Rescisão", 1, "Cálculo de rescisão trabalhista"
        ),
        FeatureCost(
            "calculator_aposentadoria", "Calculadora Aposentadoria", 1, "Simulação de aposentadoria"
        ),
    ]
}

# Pacotes de créditos à venda (era tabela credit_packages)
CREDIT_PACKAGES: dict[str, CreditPackageDef] = {
    pkg.id: pkg
    for pkg in [
        CreditPackageDef("pkg_20", "Pacote Inicial", 20, 1990, 1),  # 1,00/crédito
        CreditPackageDef("pkg_55", "Pacote Essencial", 55, 4990, 2),  # ~0,91/crédito
        CreditPackageDef("pkg_120", "Pacote Profissional", 120, 9990, 3),  # ~0,83/crédito
        CreditPackageDef("pkg_300", "Pacote Master", 300, 22990, 4),  # ~0,77/crédito
    ]
}

# Créditos de boas-vindas
WELCOME_CREDITS_AMOUNT = 10
