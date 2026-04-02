"""create_calc_engine_reference_tables

Cria schema calc_engine e tabelas de referência para calculadoras
previdenciárias: índices INPC, tábua de mortalidade IBGE e parâmetros
anuais do INSS.

Revision ID: a1b2c3_calc_ref
Revises: f8c892b0f14d
Create Date: 2026-04-01 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3_calc_ref"
down_revision: Union[str, None] = "f8c892b0f14d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS calc_engine;")

    op.execute("""
        CREATE TABLE IF NOT EXISTS calc_engine.indices_inpc (
            competencia DATE PRIMARY KEY,
            indice NUMERIC(12, 8) NOT NULL,
            fator_acumulado NUMERIC(16, 8)
        );

        COMMENT ON TABLE calc_engine.indices_inpc IS
            'Índices mensais INPC desde jul/1994 para correção monetária de salários de contribuição.';
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS calc_engine.tabua_mortalidade (
            ano_referencia INT NOT NULL,
            idade INT NOT NULL,
            expectativa_sobrevida NUMERIC(6, 2) NOT NULL,
            PRIMARY KEY (ano_referencia, idade)
        );

        COMMENT ON TABLE calc_engine.tabua_mortalidade IS
            'Tábua de mortalidade IBGE, usada no cálculo do fator previdenciário. Atualizada anualmente.';
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS calc_engine.parametros_anuais_inss (
            ano INT PRIMARY KEY,
            salario_minimo NUMERIC(10, 2) NOT NULL,
            teto_inss NUMERIC(10, 2) NOT NULL
        );

        COMMENT ON TABLE calc_engine.parametros_anuais_inss IS
            'Salário mínimo e teto do INSS por ano. Atualizado em janeiro.';
    """)

    # Seed parâmetros anuais do INSS (valores históricos recentes)
    op.execute("""
        INSERT INTO calc_engine.parametros_anuais_inss (ano, salario_minimo, teto_inss) VALUES
            (1994, 70.00, 582.86),
            (1995, 100.00, 832.66),
            (1996, 112.00, 957.56),
            (1997, 120.00, 1031.87),
            (1998, 130.00, 1081.50),
            (1999, 136.00, 1128.90),
            (2000, 151.00, 1255.32),
            (2001, 180.00, 1430.00),
            (2002, 200.00, 1561.56),
            (2003, 240.00, 1869.34),
            (2004, 260.00, 2508.72),
            (2005, 300.00, 2668.15),
            (2006, 350.00, 2801.56),
            (2007, 380.00, 2894.28),
            (2008, 415.00, 3038.99),
            (2009, 465.00, 3218.90),
            (2010, 510.00, 3467.40),
            (2011, 545.00, 3691.74),
            (2012, 622.00, 3916.20),
            (2013, 678.00, 4159.00),
            (2014, 724.00, 4390.24),
            (2015, 788.00, 4663.75),
            (2016, 880.00, 5189.82),
            (2017, 937.00, 5531.31),
            (2018, 954.00, 5645.80),
            (2019, 998.00, 5839.45),
            (2020, 1045.00, 6101.06),
            (2021, 1100.00, 6433.57),
            (2022, 1212.00, 7087.22),
            (2023, 1320.00, 7507.49),
            (2024, 1412.00, 7786.02),
            (2025, 1518.00, 8157.41),
            (2026, 1621.00, 8475.55)
        ON CONFLICT (ano) DO NOTHING;
    """)

    # Seed tábua de mortalidade IBGE 2023 (usada em 2024/2025)
    # Fonte: IBGE Tábuas Completas de Mortalidade - ambos os sexos
    op.execute("""
        INSERT INTO calc_engine.tabua_mortalidade (ano_referencia, idade, expectativa_sobrevida) VALUES
            (2023, 40, 38.5), (2023, 41, 37.6), (2023, 42, 36.7), (2023, 43, 35.7),
            (2023, 44, 34.8), (2023, 45, 33.9), (2023, 46, 33.0), (2023, 47, 32.1),
            (2023, 48, 31.2), (2023, 49, 30.3), (2023, 50, 29.4), (2023, 51, 28.5),
            (2023, 52, 27.7), (2023, 53, 26.8), (2023, 54, 26.0), (2023, 55, 25.1),
            (2023, 56, 24.3), (2023, 57, 23.5), (2023, 58, 22.7), (2023, 59, 21.9),
            (2023, 60, 21.1), (2023, 61, 20.3), (2023, 62, 19.6), (2023, 63, 18.8),
            (2023, 64, 18.1), (2023, 65, 17.4), (2023, 66, 16.7), (2023, 67, 16.0),
            (2023, 68, 15.3), (2023, 69, 14.7), (2023, 70, 14.0), (2023, 71, 13.4),
            (2023, 72, 12.8), (2023, 73, 12.2), (2023, 74, 11.6), (2023, 75, 11.0),
            (2023, 76, 10.5), (2023, 77, 10.0), (2023, 78, 9.5), (2023, 79, 9.0),
            (2023, 80, 8.5)
        ON CONFLICT (ano_referencia, idade) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS calc_engine.parametros_anuais_inss;")
    op.execute("DROP TABLE IF EXISTS calc_engine.tabua_mortalidade;")
    op.execute("DROP TABLE IF EXISTS calc_engine.indices_inpc;")
    op.execute("DROP SCHEMA IF EXISTS calc_engine CASCADE;")
