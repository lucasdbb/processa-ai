from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status


class CalculatorsService:
    # ── Tabelas tributárias 2026 ──────────────────────────────────────────

    # INSS — tabela progressiva (Portaria Interministerial MPS/MF nº 13/2026)
    _INSS_FAIXAS = [
        (1_621.00, 0.075, 0.0),
        (2_902.84, 0.09, 24.32),
        (4_354.27, 0.12, 111.40),
        (8_475.55, 0.14, 198.49),
    ]

    # IRRF — tabela progressiva mensal 2026
    _IRRF_FAIXAS = [
        (2_428.80, 0.0, 0.0),
        (2_826.65, 0.075, 182.16),
        (3_751.05, 0.15, 394.16),
        (4_664.68, 0.225, 675.49),
        (float("inf"), 0.275, 908.73),
    ]

    @classmethod
    def _calcular_inss(cls, base: float) -> float:
        """Calcula INSS progressivo com parcela a deduzir."""
        if base <= 0:
            return 0.0
        for teto, aliquota, deducao in cls._INSS_FAIXAS:
            if base <= teto:
                return base * aliquota - deducao
        # Acima do teto: contribuição máxima
        ultimo_teto, ultima_aliq, ultima_ded = cls._INSS_FAIXAS[-1]
        return ultimo_teto * ultima_aliq - ultima_ded

    @classmethod
    def _calcular_irrf(cls, base_tributavel: float) -> float:
        """Calcula IRRF progressivo com parcela a deduzir."""
        if base_tributavel <= 0:
            return 0.0
        for teto, aliquota, deducao in cls._IRRF_FAIXAS:
            if base_tributavel <= teto:
                imposto = base_tributavel * aliquota - deducao
                return max(0.0, imposto)
        return 0.0

    # Verbas devidas por tipo de rescisão (art. 477, 484-A CLT)
    _VERBAS_POR_TIPO = {
        "sem_justa_causa": {
            "saldo_salario": True,
            "aviso_previo": True,
            "ferias_vencidas": True,
            "ferias_proporcionais": True,
            "decimo_terceiro": True,
            "fgts_rescisorio": True,
            "multa_fgts_percent": 0.40,
            "aviso_previo_fator": 1.0,
            "saque_fgts": True,
        },
        "por_pedido": {
            "saldo_salario": True,
            "aviso_previo": False,
            "ferias_vencidas": True,
            "ferias_proporcionais": True,
            "decimo_terceiro": True,
            "fgts_rescisorio": False,
            "multa_fgts_percent": 0.0,
            "aviso_previo_fator": 0.0,
            "saque_fgts": False,
        },
        "com_justa_causa": {
            "saldo_salario": True,
            "aviso_previo": False,
            "ferias_vencidas": True,
            "ferias_proporcionais": False,
            "decimo_terceiro": False,
            "fgts_rescisorio": False,
            "multa_fgts_percent": 0.0,
            "aviso_previo_fator": 0.0,
            "saque_fgts": False,
        },
        "acordo": {
            "saldo_salario": True,
            "aviso_previo": True,
            "ferias_vencidas": True,
            "ferias_proporcionais": True,
            "decimo_terceiro": True,
            "fgts_rescisorio": True,
            "multa_fgts_percent": 0.20,
            "aviso_previo_fator": 0.5,
            "saque_fgts": True,
        },
        "termino_contrato": {
            "saldo_salario": True,
            "aviso_previo": False,
            "ferias_vencidas": True,
            "ferias_proporcionais": True,
            "decimo_terceiro": True,
            "fgts_rescisorio": True,
            "multa_fgts_percent": 0.0,
            "aviso_previo_fator": 0.0,
            "saque_fgts": True,
        },
    }

    def calculate_rescisao_trabalhista(
        self,
        *,
        salario_base: float,
        adicional_periculosidade: bool,
        adicional_insalubridade_grau: int,
        base_insalubridade: float,
        adicional_noturno_percent: float,
        media_horas_noturnas: float,
        outras_verbas: float,
        data_admissao: date,
        data_rescisao: date,
        tipo_rescisao: str,
        tipo_aviso_previo: str,
        ferias_vencidas: int,
        ferias_proporcionais: bool,
        decimo_terceiro: bool,
    ) -> dict:
        if data_rescisao < data_admissao:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="data_rescisao deve ser maior ou igual a data_admissao",
            )

        tipo = str(tipo_rescisao).strip()
        regras = self._VERBAS_POR_TIPO.get(tipo)
        if regras is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"tipo_rescisao inválido: {tipo}",
            )

        # 1. Remuneração Bruta (Base de Cálculo)
        remuneracao = float(salario_base)

        val_periculosidade = 0.0
        if adicional_periculosidade:
            val_periculosidade = salario_base * 0.30
            remuneracao += val_periculosidade

        val_insalubridade = 0.0
        if adicional_insalubridade_grau > 0:
            val_insalubridade = float(base_insalubridade) * (
                float(adicional_insalubridade_grau) / 100.0
            )
            remuneracao += val_insalubridade

        val_noturno = 0.0
        if media_horas_noturnas > 0:
            valor_hora = salario_base / 220.0
            val_noturno = (
                valor_hora * media_horas_noturnas * (float(adicional_noturno_percent) / 100.0)
            )
            remuneracao += val_noturno

        remuneracao += float(outras_verbas)

        # 2. Tempo de serviço
        dias_trabalhados = max(0.0, float((data_rescisao - data_admissao).days))
        meses_trabalhados_total = dias_trabalhados / 30.0

        # 3. Saldo de Salário (sempre devido)
        saldo_salario = (remuneracao / 30.0) * min(30, data_rescisao.day)

        # 4. Aviso Prévio (Lei 12.506/2011)
        anos_completos = int(dias_trabalhados / 365.0)
        dias_aviso_proporcional = 30
        if anos_completos > 0:
            dias_aviso_proporcional += min(60, anos_completos * 3)

        fator_aviso = regras["aviso_previo_fator"]

        if tipo_aviso_previo in ("indenizado", "trabalhado"):
            # Empregador paga aviso proporcional ao tempo de serviço
            dias_aviso = dias_aviso_proporcional
            tem_aviso = regras["aviso_previo"] and fator_aviso > 0
            valor_aviso_previo = (
                (remuneracao / 30.0) * dias_aviso * fator_aviso if tem_aviso else 0.0
            )
        elif tipo_aviso_previo == "nao_cumprido":
            # Pedido de demissão sem cumprir aviso: desconto de 30 dias fixos
            dias_aviso = 30
            tem_aviso = True
            valor_aviso_previo = -((remuneracao / 30.0) * 30)
        else:
            # Dispensado: sem pagamento, sem desconto
            dias_aviso = 0
            tem_aviso = False
            valor_aviso_previo = 0.0

        # Projeção só se aplica ao aviso indenizado (trabalhador não trabalhou o período)
        aviso_indenizado = tem_aviso and tipo_aviso_previo == "indenizado"

        # 5. Férias Vencidas + 1/3 (devidas em todos os tipos, inclusive justa causa)
        dias_ferias_vencidas = max(0, int(ferias_vencidas or 0))
        valor_ferias_vencidas = (remuneracao / 30.0) * float(dias_ferias_vencidas) * (4.0 / 3.0)

        # 6. Férias Proporcionais + 1/3
        meses_ferias_prop = 0
        if ferias_proporcionais and regras["ferias_proporcionais"]:
            ano_aniversario = data_rescisao.year
            try:
                aniversario = date(ano_aniversario, data_admissao.month, data_admissao.day)
            except ValueError:
                aniversario = date(ano_aniversario, data_admissao.month, 28)
            if aniversario > data_rescisao:
                try:
                    aniversario = date(
                        ano_aniversario - 1, data_admissao.month, data_admissao.day
                    )
                except ValueError:
                    aniversario = date(ano_aniversario - 1, data_admissao.month, 28)

            delta_ferias = data_rescisao - aniversario
            meses_ferias_prop = delta_ferias.days // 30
            if (delta_ferias.days % 30) >= 15:
                meses_ferias_prop += 1

            # Projeção do aviso prévio indenizado no período aquisitivo
            if aviso_indenizado:
                meses_aviso_projecao = dias_aviso // 30
                if (dias_aviso % 30) >= 15:
                    meses_aviso_projecao += 1
                meses_ferias_prop += meses_aviso_projecao

            meses_ferias_prop = min(12, meses_ferias_prop)

        valor_ferias_prop = (
            (remuneracao / 12.0) * meses_ferias_prop * (4.0 / 3.0)
            if (ferias_proporcionais and regras["ferias_proporcionais"])
            else 0.0
        )

        # 7. 13º Salário Proporcional
        meses_13 = 0
        if decimo_terceiro and regras["decimo_terceiro"]:
            inicio_ano = date(data_rescisao.year, 1, 1)
            inicio_contagem = max(inicio_ano, data_admissao)
            delta_13 = data_rescisao - inicio_contagem
            meses_13 = delta_13.days // 30
            if (delta_13.days % 30) >= 15:
                meses_13 += 1

            # Projeção do aviso prévio indenizado no 13º
            if aviso_indenizado:
                meses_aviso_13 = dias_aviso // 30
                if (dias_aviso % 30) >= 15:
                    meses_aviso_13 += 1
                meses_13 += meses_aviso_13

            meses_13 = min(12, meses_13)

        valor_13 = (
            (remuneracao / 12.0) * meses_13
            if (decimo_terceiro and regras["decimo_terceiro"])
            else 0.0
        )

        # 8. FGTS
        # Estimativa do saldo acumulado (sempre calculada — independente do tipo)
        fgts_acumulado = remuneracao * 0.08 * meses_trabalhados_total
        saque_fgts = regras["saque_fgts"]

        fgts_rescisorio = 0.0
        if regras["fgts_rescisorio"]:
            fgts_rescisorio = (
                saldo_salario + max(0.0, valor_aviso_previo) + valor_13
            ) * 0.08

        multa_percent = regras["multa_fgts_percent"]
        multa_fgts = (fgts_acumulado + fgts_rescisorio) * multa_percent

        # 9. INSS (incide sobre saldo + aviso; 13º calculado separado)
        base_inss_verbas = saldo_salario + max(0.0, valor_aviso_previo)
        inss_verbas = self._calcular_inss(base_inss_verbas)
        inss_13 = self._calcular_inss(valor_13) if valor_13 > 0 else 0.0
        inss_total = inss_verbas + inss_13

        # 10. IRRF (sobre base tributável = verbas - INSS; 13º separado)
        # Férias + 1/3 e FGTS são isentos de IRRF
        base_irrf_verbas = base_inss_verbas - inss_verbas
        irrf_verbas = self._calcular_irrf(base_irrf_verbas)
        base_irrf_13 = valor_13 - inss_13
        irrf_13 = self._calcular_irrf(base_irrf_13) if base_irrf_13 > 0 else 0.0
        irrf_total = irrf_verbas + irrf_13

        # 11. Total bruto e líquido
        total_bruto = (
            saldo_salario
            + valor_aviso_previo
            + valor_ferias_vencidas
            + valor_ferias_prop
            + valor_13
            + fgts_rescisorio
            + multa_fgts
        )
        total_descontos = inss_total + irrf_total
        total_liquido = total_bruto - total_descontos

        return {
            "detalhes": {
                "remuneracao_bruta": remuneracao,
                "saldo_salario": saldo_salario,
                "aviso_previo": valor_aviso_previo,
                "ferias_vencidas": valor_ferias_vencidas,
                "ferias_proporcionais": valor_ferias_prop,
                "decimo_terceiro": valor_13,
                "fgts_acumulado": fgts_acumulado,
                "fgts_rescisorio": fgts_rescisorio,
                "multa_fgts": multa_fgts,
                "inss": inss_total,
                "irrf": irrf_total,
                "total_bruto": total_bruto,
                "total_descontos": total_descontos,
                "total": total_liquido,
            },
            "meta": {
                "meses_trabalhados": meses_trabalhados_total,
                "dias_trabalhados": dias_trabalhados,
                "dias_aviso_previo": dias_aviso,
                "tipo_aviso_previo": tipo_aviso_previo,
                "meses_ferias_proporcionais": meses_ferias_prop,
                "meses_13": meses_13,
                "tipo_rescisao": tipo,
                "multa_fgts_percent": multa_percent,
                "saque_fgts": saque_fgts,
                "inss_verbas": inss_verbas,
                "inss_13": inss_13,
                "irrf_verbas": irrf_verbas,
                "irrf_13": irrf_13,
                "remuneracao_composta": {
                    "base": salario_base,
                    "periculosidade": val_periculosidade,
                    "insalubridade": val_insalubridade,
                    "noturno": val_noturno,
                    "outras": outras_verbas,
                },
            },
        }

    def calculate_aposentadoria(
        self,
        *,
        sexo: str,
        tipo_aposentadoria: str,
        idade: int,
        tempo_contribuicao: int,
        salario_contribuicao: float,
    ) -> dict:
        idade_minima = 65 if sexo == "masculino" else 62
        tempo_minimo_contrib = 15

        pode_aposentar = (idade >= idade_minima) and (tempo_contribuicao >= tempo_minimo_contrib)

        anos_restantes = max(0, idade_minima - idade)
        tempo_restante = max(0, tempo_minimo_contrib - tempo_contribuicao)

        coeficiente = 0.60
        anos_excedentes = max(0, tempo_contribuicao - 15)
        if anos_excedentes > 0:
            coeficiente += anos_excedentes * 0.02

        beneficio = salario_contribuicao * coeficiente if pode_aposentar else 0.0

        return {
            "detalhes": {
                "pode_aposentar": pode_aposentar,
                "anos_restantes": anos_restantes,
                "tempo_restante": tempo_restante,
                "beneficio": beneficio,
                "idade_minima": idade_minima,
                "tempo_minimo_contrib": tempo_minimo_contrib,
            },
            "meta": {"coeficiente_calculado": coeficiente},
        }
