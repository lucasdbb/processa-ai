from __future__ import annotations

import hashlib
import io
import re
from datetime import date
from urllib.parse import unquote, urlparse

import httpx
from fastapi import HTTPException, status

from src.core.config import settings
from src.core.logging import logger


class CalculatorsService:
    def _sanitize_path_segment(self, value: str | None, *, default: str) -> str:
        v = (value or "").strip()
        if not v:
            return default
        cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", v).strip("-._")
        return cleaned or default

    def _slugify_filename(self, filename: str) -> str:
        name = (filename or "document").strip()
        if name.lower().endswith(".pdf"):
            name = name[:-4]
        name = name.strip() or "document"
        name = re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip("-._")
        return name or "document"

    def _infer_pdf_filename_from_url(self, file_url: str) -> str:
        parsed = urlparse((file_url or "").strip())
        path = unquote(parsed.path or "")
        name = (path.rsplit("/", 1)[-1] or "").strip() or "document.pdf"
        if not name.lower().endswith(".pdf"):
            name = f"{name}.pdf"
        return name

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
        },
        "por_pedido": {
            "saldo_salario": True,
            "aviso_previo": True,
            "ferias_vencidas": True,
            "ferias_proporcionais": True,
            "decimo_terceiro": True,
            "fgts_rescisorio": False,
            "multa_fgts_percent": 0.0,
            "aviso_previo_fator": 1.0,
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
        },
        "termino_contrato": {
            "saldo_salario": True,
            "aviso_previo": False,
            "ferias_vencidas": True,
            "ferias_proporcionais": True,
            "decimo_terceiro": True,
            "fgts_rescisorio": True,
            "multa_fgts_percent": 0.40,
            "aviso_previo_fator": 0.0,
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
        aviso_previo: bool,
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
        dias_aviso = 30
        if anos_completos > 0:
            dias_aviso += min(60, anos_completos * 3)

        fator_aviso = regras["aviso_previo_fator"]
        tem_aviso = regras["aviso_previo"] and aviso_previo and fator_aviso > 0
        valor_aviso_previo = (remuneracao / 30.0) * dias_aviso * fator_aviso if tem_aviso else 0.0

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
            if tem_aviso:
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
            if tem_aviso:
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
        # Estimativa do saldo acumulado na conta vinculada (8% * remuneração * meses)
        fgts_acumulado = remuneracao * 0.08 * meses_trabalhados_total

        # FGTS rescisório: 8% sobre verbas rescisórias (saldo salário, aviso prévio, 13º)
        fgts_rescisorio = 0.0
        if regras["fgts_rescisorio"]:
            fgts_rescisorio = (saldo_salario + valor_aviso_previo + valor_13) * 0.08

        # Multa sobre o FGTS total (acumulado + rescisório)
        multa_percent = regras["multa_fgts_percent"]
        multa_fgts = (fgts_acumulado + fgts_rescisorio) * multa_percent

        # 9. Total (verbas rescisórias brutas, sem FGTS acumulado que é sacado à parte)
        total = (
            saldo_salario
            + valor_aviso_previo
            + valor_ferias_vencidas
            + valor_ferias_prop
            + valor_13
            + fgts_rescisorio
            + multa_fgts
        )

        return {
            "detalhes": {
                "remuneracao_bruta": remuneracao,
                "saldo_salario": saldo_salario,
                "aviso_previo": valor_aviso_previo,
                "ferias_vencidas": valor_ferias_vencidas,
                "ferias_proporcionais": valor_ferias_prop,
                "decimo_terceiro": valor_13,
                "fgts": fgts_acumulado,
                "fgts_rescisorio": fgts_rescisorio,
                "multa_fgts": multa_fgts,
                "total": total,
            },
            "meta": {
                "meses_trabalhados": meses_trabalhados_total,
                "dias_trabalhados": dias_trabalhados,
                "dias_aviso_previo": dias_aviso if tem_aviso else 0,
                "meses_ferias_proporcionais": meses_ferias_prop,
                "meses_13": meses_13,
                "tipo_rescisao": tipo,
                "multa_fgts_percent": multa_percent,
                "remuneracao_composta": {
                    "base": salario_base,
                    "periculosidade": val_periculosidade,
                    "insalubridade": val_insalubridade,
                    "noturno": val_noturno,
                    "outras": outras_verbas,
                },
            },
        }

    def _render_rescisao_markdown(self, *, input_payload: dict, output_payload: dict) -> str:
        detalhes = (
            output_payload.get("detalhes") if isinstance(output_payload, dict) else None
        ) or {}

        meta = (output_payload.get("meta") if isinstance(output_payload, dict) else None) or {}
        comps = meta.get("remuneracao_composta") or {}

        def money(v: object) -> str:
            try:
                return f"R$ {float(v):.2f}"
            except Exception:
                return "-"

        lines: list[str] = []
        lines.append("# Rescisão Trabalhista")
        lines.append("")

        lines.append("## Dados do Contrato")
        lines.append(f"- Admissão: {input_payload.get('data_admissao')}")
        lines.append(f"- Rescisão: {input_payload.get('data_rescisao')}")
        lines.append(f"- Tipo: {input_payload.get('tipo_rescisao')}")
        lines.append(f"- Aviso Prévio: {'Sim' if input_payload.get('aviso_previo') else 'Não'}")
        lines.append("")

        lines.append("## Composição da Remuneração")
        lines.append(f"- Salário Base: {money(input_payload.get('salario_base'))}")
        if input_payload.get("adicional_periculosidade"):
            lines.append(f"- Periculosidade (30%): {money(comps.get('periculosidade'))}")
        if input_payload.get("adicional_insalubridade_grau"):
            grau = input_payload.get("adicional_insalubridade_grau")
            lines.append(f"- Insalubridade ({grau}%): {money(comps.get('insalubridade'))}")
        if input_payload.get("media_horas_noturnas"):
            lines.append(f"- Adicional Noturno: {money(comps.get('noturno'))}")
        if input_payload.get("outras_verbas"):
            lines.append(f"- Outras Verbas: {money(input_payload.get('outras_verbas'))}")

        lines.append(
            f"**Remuneração para Fins Rescisórios: {money(detalhes.get('remuneracao_bruta'))}**"
        )
        lines.append("")

        lines.append("## Detalhamento das Verbas")
        lines.append("")
        lines.append("| Item | Valor |")
        lines.append("|---|---:|")
        lines.append(f"| Saldo de Salário | {money(detalhes.get('saldo_salario'))} |")
        lines.append(f"| Aviso Prévio Indenizado | {money(detalhes.get('aviso_previo'))} |")
        lines.append(f"| Férias Vencidas + 1/3 | {money(detalhes.get('ferias_vencidas'))} |")
        lines.append(
            f"| Férias Proporcionais + 1/3 | {money(detalhes.get('ferias_proporcionais'))} |"
        )
        lines.append(f"| 13º Salário Proporcional | {money(detalhes.get('decimo_terceiro'))} |")
        lines.append(f"| FGTS Acumulado (estimativa) | {money(detalhes.get('fgts'))} |")
        lines.append(f"| FGTS Rescisório (8%) | {money(detalhes.get('fgts_rescisorio'))} |")

        multa_pct = (meta.get("multa_fgts_percent") or 0) * 100
        multa_label = f"Multa FGTS ({multa_pct:.0f}%)" if multa_pct > 0 else "Multa FGTS"
        lines.append(f"| {multa_label} | {money(detalhes.get('multa_fgts'))} |")
        lines.append(f"| **Total Estimado** | **{money(detalhes.get('total'))}** |")
        lines.append("")
        lines.append(
            "> Nota: O cálculo do FGTS é uma estimativa baseada na remuneração atual aplicada "
            "a todo o período."
        )
        lines.append("> O valor real depende dos depósitos efetuados.")
        return "\n".join(lines)

    def _markdown_to_pdf_bytes(self, markdown: str, *, title: str | None = None) -> bytes:
        text = (markdown or "").strip()
        if not text:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao gerar relatório",
            )

        try:
            from markdown_pdf import MarkdownPdf, Section
        except ModuleNotFoundError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Dependência de PDF não instalada",
            )

        try:
            pdf = MarkdownPdf(toc_level=2, optimize=True)
            if title:
                pdf.meta["title"] = title
            pdf.add_section(Section(text))

            out = io.BytesIO()
            pdf.save_bytes(out)
            pdf_bytes = out.getvalue()
        except HTTPException:
            raise
        except Exception as e:
            logger.error("Falha ao gerar PDF do markdown", exc_info=e)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao gerar PDF",
            )

        if not pdf_bytes.lstrip().startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao gerar PDF",
            )

        return pdf_bytes

    async def _upload_pdf_to_supabase(
        self,
        *,
        pdf_bytes: bytes,
        user_id: str,
        client_id: str | None,
        endpoint: str,
        filename: str,
        expires_in: int,
    ) -> dict:
        base_url = (settings.SUPABASE_URL or "").strip().rstrip("/")
        api_key = (settings.SUPABASE_SERVICE_ROLE_KEY or "").strip()
        bucket = "documents"
        if not base_url or not api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase Storage não configurado",
            )

        sha = hashlib.sha256(pdf_bytes).hexdigest()[:32]
        slug = self._slugify_filename(filename)
        storage_filename = f"{sha}_{slug}.pdf"
        uid = self._sanitize_path_segment(user_id, default="unknown-user")
        cid = self._sanitize_path_segment(client_id, default="no-client")
        ep = self._sanitize_path_segment(endpoint, default="unknown")
        storage_path = f"{uid}/{cid}/{ep}/{storage_filename}"

        upload_url = f"{base_url}/storage/v1/object/{bucket}/{storage_path}"
        headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/pdf",
            "x-upsert": "true",
        }

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(upload_url, headers=headers, content=pdf_bytes)
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao subir PDF para storage",
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão ao subir PDF para storage",
            )

        if resp.status_code >= 400:
            body = (resp.text or "").strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Falha ao subir PDF para storage"
                    + (f" (status {resp.status_code})" if resp.status_code else "")
                    + (f": {body[:200]}" if body else "")
                ),
            )

        sign_url = f"{base_url}/storage/v1/object/sign/{bucket}/{storage_path}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                signed = await client.post(
                    sign_url,
                    headers={
                        "apikey": api_key,
                        "Authorization": f"Bearer {api_key}",
                    },
                    json={"expiresIn": int(expires_in)},
                )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Tempo limite ao gerar URL assinada",
            )
        except httpx.RequestError:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Erro de conexão ao gerar URL assinada",
            )

        if signed.status_code >= 400:
            body = (signed.text or "").strip()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    "Falha ao gerar URL assinada"
                    + (f" (status {signed.status_code})" if signed.status_code else "")
                    + (f": {body[:200]}" if body else "")
                ),
            )

        try:
            data = signed.json()
        except Exception:
            data = None

        signed_url = None
        if isinstance(data, dict):
            signed_url = data.get("signedURL") or data.get("signedUrl")
        if not signed_url or not isinstance(signed_url, str):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Resposta inválida ao gerar URL assinada",
            )

        if signed_url.startswith("http"):
            download_url = signed_url
        else:
            download_url = f"{base_url}/storage/v1{signed_url}"

        return {
            "bucket": bucket,
            "storage_path": storage_path,
            "download_url": download_url,
        }

    async def markdown_to_pdf_and_store(
        self,
        *,
        markdown: str,
        filename: str,
        user_id: str,
        client_id: str | None,
        endpoint: str,
        expires_in: int,
    ) -> dict:
        title = str(filename)
        if title.lower().endswith(".pdf"):
            title = title[:-4]

        pdf_bytes = self._markdown_to_pdf_bytes(markdown, title=title)
        uploaded = await self._upload_pdf_to_supabase(
            pdf_bytes=pdf_bytes,
            user_id=user_id,
            client_id=client_id,
            endpoint=endpoint,
            filename=filename,
            expires_in=expires_in,
        )

        return {
            "content": pdf_bytes,
            **uploaded,
        }

    async def export_rescisao_pdf(
        self,
        *,
        input_payload: dict,
        output_payload: dict,
        user_id: str,
        client_id: str | None,
        calculation_id: str,
        expires_in: int,
    ) -> dict:
        from src.features.calculators.reports import generate_rescisao_pdf

        try:
            pdf_bytes = generate_rescisao_pdf(
                input_payload=input_payload,
                output_payload=output_payload,
            )
        except (FileNotFoundError, RuntimeError) as exc:
            logger.warning(
                "Falha ao gerar PDF via template DOCX, usando fallback markdown: %s", exc
            )
            md = self._render_rescisao_markdown(
                input_payload=input_payload,
                output_payload=output_payload,
            )
            filename = f"rescisao-trabalhista_{calculation_id}.pdf"
            return await self.markdown_to_pdf_and_store(
                markdown=md,
                filename=filename,
                user_id=user_id,
                client_id=client_id,
                endpoint="trabalhista/rescisao-trabalhista",
                expires_in=expires_in,
            )

        filename = f"rescisao-trabalhista_{calculation_id}.pdf"
        uploaded = await self._upload_pdf_to_supabase(
            pdf_bytes=pdf_bytes,
            user_id=user_id,
            client_id=client_id,
            endpoint="trabalhista/rescisao-trabalhista",
            filename=filename,
            expires_in=expires_in,
        )

        return {
            "content": pdf_bytes,
            **uploaded,
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
        # Lógica simplificada (regra geral 65/62 anos, 15 anos contribuição)
        # TODO: Expandir com regras de transição reais

        idade_minima = 65 if sexo == "masculino" else 62
        tempo_minimo_contrib = 15

        pode_aposentar = (idade >= idade_minima) and (tempo_contribuicao >= tempo_minimo_contrib)

        anos_restantes = max(0, idade_minima - idade)
        tempo_restante = max(0, tempo_minimo_contrib - tempo_contribuicao)

        # Cálculo simplificado do benefício: 60% + 2% por ano acima de 15/20 anos
        # Baseado na regra pós-EC 103/2019
        coeficiente = 0.60
        anos_excedentes = max(0, tempo_contribuicao - 15)  # Simplificação: usando 15 para ambos
        if anos_excedentes > 0:
            coeficiente += anos_excedentes * 0.02

        # Limita a 100% (ou mais se permitir >100%)
        # Mas regra geral teto é 100% da média,
        # podendo passar em casos específicos
        # Vamos deixar passar de 100% pois a regra permite

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

    def _render_aposentadoria_markdown(self, *, input_payload: dict, output_payload: dict) -> str:
        detalhes = (
            output_payload.get("detalhes") if isinstance(output_payload, dict) else None
        ) or {}

        def money(v: object) -> str:
            try:
                return f"R$ {float(v):.2f}"
            except Exception:
                return "-"

        lines: list[str] = []
        lines.append("# Simulação de Aposentadoria")
        lines.append("")
        lines.append("## Parâmetros")
        lines.append("")
        lines.append(f"- Sexo: {input_payload.get('sexo', '').capitalize()}")
        lines.append(f"- Idade atual: {input_payload.get('idade')} anos")
        lines.append(f"- Tempo de contribuição: {input_payload.get('tempo_contribuicao')} anos")
        lines.append(
            f"- Salário de contribuição: {money(input_payload.get('salario_contribuicao'))}"
        )
        lines.append("")
        lines.append("## Resultado")
        lines.append("")

        pode = detalhes.get("pode_aposentar")
        status_text = (
            "APROVADO - Requisitos atendidos" if pode else "PENDENTE - Requisitos não atendidos"
        )

        lines.append(f"**Status: {status_text}**")
        lines.append("")

        if pode:
            lines.append(f"### Valor Estimado do Benefício: {money(detalhes.get('beneficio'))}")
            lines.append("")
            lines.append("> Nota: Este valor é uma estimativa baseada nas regras gerais.")
            lines.append(
                "> O valor real depende do cálculo da média de todos os salários de contribuição."
            )
        else:
            lines.append("### O que falta:")
            lines.append("")
            lines.append(
                f"- Idade mínima exigida: {detalhes.get('idade_minima')} anos "
                f"(Faltam {detalhes.get('anos_restantes')} anos)"
            )
            lines.append(
                f"- Tempo de contribuição mínimo: {detalhes.get('tempo_minimo_contrib')} anos "
                f"(Faltam {detalhes.get('tempo_restante')} anos)"
            )

        lines.append("")
        lines.append("---")
        lines.append("Este relatório é uma simulação e não possui valor legal.")
        lines.append("Consulte um advogado previdenciário.")

        return "\n".join(lines)

    async def export_aposentadoria_pdf(
        self,
        *,
        input_payload: dict,
        output_payload: dict,
        user_id: str,
        client_id: str | None,
        calculation_id: str,
        expires_in: int,
    ) -> dict:
        md = self._render_aposentadoria_markdown(
            input_payload=input_payload,
            output_payload=output_payload,
        )
        filename = f"simulacao-aposentadoria_{calculation_id}.pdf"
        return await self.markdown_to_pdf_and_store(
            markdown=md,
            filename=filename,
            user_id=user_id,
            client_id=client_id,
            endpoint="previdencia/aposentadoria",
            expires_in=expires_in,
        )
