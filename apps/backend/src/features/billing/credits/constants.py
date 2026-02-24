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
        FeatureCost("ai_chat", "Chat IA Jurídica", 1, "Cada mensagem no chat com a IA"),
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
        CreditPackageDef("pkg_10", "Pacote Inicial", 10, 990, 1),
        CreditPackageDef("pkg_30", "Pacote Intermediário", 30, 2490, 2),
        CreditPackageDef("pkg_100", "Pacote Profissional", 100, 7490, 3),
    ]
}

# Créditos de boas-vindas
WELCOME_CREDITS_AMOUNT = 10
