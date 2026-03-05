"""Script para testar a geração do DOCX/PDF do CNIS com payload de exemplo.

Uso:
    uv run python test_cnis_report.py            # gera DOCX + PDF
    uv run python test_cnis_report.py --docx     # gera apenas DOCX
"""

import argparse
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Payload de exemplo com a estrutura exata que o Gemini retorna
# ---------------------------------------------------------------------------
PAYLOAD = {
    "resumo_segurado": {
        "cpf": "019.170.127-01",
        "nit": "123.96233.79-0",
        "nome": "MARCIA GUIMARAES DE ALBUQUERQUE",
        "nome_mae": "NELZA GUIMARAES DOS SANTOS",
        "data_nascimento": "25/12/1970",
    },
    "resumo_executivo": "A segurada possui um histórico contributivo extenso e consistente, somando aproximadamente 32 anos de contribuição. Destaca-se a concomitância de três vínculos ativos a partir de 2020 e 2024, cujos valores somados podem ultrapassar o teto do RGPS, exigindo atenção. Existem quatro competências como Contribuinte Individual (2004/2005) com recolhimento abaixo do salário mínimo (PREC-MENOR-MIN), que não contarão para nenhum fim previdenciário sem a devida complementação ou agrupamento. Há também um indicador PEXT em vínculo de 2011 a 2021, requerendo validação documental.",
    "vinculos": [
        {
            "empresa": "PAULO CESAR A ABRANTES (30.820.914/0001-60)",
            "periodo": {"fim": "31/05/1991", "inicio": "01/11/1989"},
            "indicadores": [],
            "analise_critica": "Vínculo antigo e regular. Informações e remunerações consistentes com a época. Período contabilizado normalmente para tempo de contribuição e carência.",
        },
        {
            "empresa": "ORGANIZACAO RELIGIOSA SAO VICENTE DE PAULO (33.570.052/0063-55)",
            "periodo": {"fim": "06/1996", "inicio": "01/04/1993"},
            "indicadores": [],
            "analise_critica": "Vínculo regular. Remunerações registradas com os devidos reflexos das moedas da época (Cruzeiros Reais / Real).",
        },
        {
            "empresa": "COLEGIO EQUIPE GRAU LTDA (27.977.149/0001-81)",
            "periodo": {"fim": "30/11/2010", "inicio": "01/09/1997"},
            "indicadores": [],
            "analise_critica": "Longo período contributivo contínuo, fundamental para a manutenção da qualidade de segurada e acúmulo de tempo de contribuição.",
        },
        {
            "empresa": "AGRUPAMENTO DE CONTRATANTES/COOPERATIVAS (Seq. 4, 5, 6 e 7)",
            "periodo": {"fim": "31/10/2005", "inicio": "01/07/2004"},
            "indicadores": ["IREM-INDPEND", "PREM-EXT", "PREC-MENOR-MIN"],
            "analise_critica": "Referem-se a 4 competências esparsas (07/04, 09/04, 08/05 e 10/05) como Contribuinte Individual prestando serviço a empresas. Salários registrados em R$ 60,00, muito inferiores ao mínimo da época. Sem complementação, esses meses não entram no cômputo previdenciário.",
        },
        {
            "empresa": "INSS - AUXILIO DOENCA PREVIDENCIARIO (NB: 5362957640)",
            "periodo": {"fim": "31/08/2009", "inicio": "24/06/2009"},
            "indicadores": [],
            "analise_critica": "Benefício por incapacidade intercalado com o vínculo do Colégio Equipe Grau. Computa-se como tempo de contribuição e carência por estar entre recolhimentos normais.",
        },
        {
            "empresa": "COLEGIO EQUIPE GRAU LTDA (Seq. 9 e 10)",
            "periodo": {"fim": "06/03/2021", "inicio": "01/03/2011"},
            "indicadores": ["IVIN-JORN-DIFERENCIADA", "PEXT"],
            "analise_critica": "Seq 9 e 10 representam o mesmo vínculo, mas divididos por matrícula. O indicador PEXT assinala que a informação foi prestada fora do prazo. Imprescindível apresentar a CTPS original ou contrato de trabalho no momento da aposentadoria para averbação definitiva.",
        },
        {
            "empresa": "COLEGIO EQUIPE SEC LTDA (Seq. 11)",
            "periodo": {"fim": "Em aberto (Últ. Remun. 11/2025)", "inicio": "03/12/2020"},
            "indicadores": ["IVIN-JORN-DIFERENCIADA"],
            "analise_critica": "Vínculo atualmente ativo e sem data de fim. Concomitante com vínculos subsequentes. Remunerações normais acima do salário mínimo.",
        },
        {
            "empresa": "COLEGIO SER E CRESCER DE NOVA IGUACU LTDA (Seq. 12)",
            "periodo": {"fim": "Em aberto (Últ. Remun. 11/2025)", "inicio": "03/12/2020"},
            "indicadores": ["IVIN-JORN-DIFERENCIADA"],
            "analise_critica": "Início idêntico ao vínculo 11. Trabalha em concomitância. Necessário verificar se a soma dos salários de contribuição destes empregos simultâneos não ultrapassa o teto do INSS.",
        },
        {
            "empresa": "MUNICIPIO DE MESQUITA (Seq. 13)",
            "periodo": {"fim": "Em aberto (Últ. Remun. 11/2025)", "inicio": "19/04/2024"},
            "indicadores": ["IVIN-JORN-DIFERENCIADA"],
            "analise_critica": "Emprego público (celetista ou comissionado sob RGPS) concomitante com as outras duas escolas privadas. Aumenta substancialmente o valor do Salário de Benefício, devendo-se aplicar as regras estritas da Reforma da Previdência para contribuições concomitantes.",
        },
    ],
    "indicadores": [
        {
            "codigo": "PEXT",
            "descricao": "Vínculo com informação extemporânea, passível de comprovação.",
            "implicacao": "O INSS não computará este período automaticamente até que a segurada apresente prova material contemporânea (como a anotação na CTPS).",
        },
        {
            "codigo": "PREM-EXT",
            "descricao": "Remuneração informada fora do prazo, passível de comprovação.",
            "implicacao": "Pode exigir recibos de pagamento (holerites) ou outros comprovantes financeiros para validar a remuneração.",
        },
        {
            "codigo": "IREM-INDPEND",
            "descricao": "Remunerações com indicadores/pendências.",
            "implicacao": "Alerta que as competências listadas exigem tratamento por possuírem alguma falha ou exceção.",
        },
        {
            "codigo": "PREC-MENOR-MIN",
            "descricao": "Recolhimento abaixo do valor mínimo.",
            "implicacao": "Não gera tempo de contribuição sem complementação via DARF ou agrupamento (EC 103/2019 e Decreto 3.048/99).",
        },
        {
            "codigo": "IVIN-JORN-DIFERENCIADA",
            "descricao": "Vínculo possui regime de jornada diferenciada.",
            "implicacao": "Pós EC 103/2019, o somatório das contribuições deve atingir o salário mínimo; caso contrário, demanda complementação.",
        },
    ],
    "dados_previdenciarios": {
        "quantidade_vinculos": 13,
        "tempo_total_estimado": {"anos": 32, "dias": 0, "meses": 10},
        "periodos_sem_contribuicao": 2,
        "maior_salario_contribuicao": 6337.38,
        "contribuicoes_abaixo_minimo": 4,
    },
    "alertas_gerais": [
        "Sobreposição/Concomitância: A segurada possui 3 empregos simultâneos desde 2024 (e 2 desde 2020). A partir da Lei 13.846/2019, os salários de contribuição concomitantes são somados integralmente. Como os valores somados chegam a mais de R$ 6.000,00 mensais, pode estar havendo desconto acima do Teto do INSS. Recomenda-se auditoria para solicitação de restituição de indébito tributário.",
        "Períodos Abertos: Os vínculos recentes (11, 12 e 13) não possuem data de encerramento no extrato. Ao requerer benefício, o INSS considerará apenas até a última remuneração consolidada, exigindo comprovação de eventual continuidade.",
        "Complementação EC 103/2019: Apesar de os salários abaixo do mínimo serem de 2004/2005 (antes da Reforma), o recolhimento na condição de prestador de serviço/CI requer alcance do mínimo para cômputo em qualquer tempo.",
        "Regularização de PEXT: O vínculo entre 2011 e 2021 com o Colégio Equipe Grau precisa de atenção cautelar. Recomenda-se realizar o acerto de vínculos e remunerações preventivamente via 'Meu INSS' com a carteira de trabalho, evitando atrasos futuros na concessão da aposentadoria.",
    ],
}


def main():
    parser = argparse.ArgumentParser(description="Testa geração de relatório CNIS")
    parser.add_argument("--docx", action="store_true", help="Gera apenas o DOCX (sem PDF)")
    args = parser.parse_args()

    output_dir = Path(__file__).parent
    docx_path = output_dir / "test_output_cnis.docx"
    pdf_path = output_dir / "test_output_cnis.pdf"

    print("Gerando DOCX a partir do template...")
    try:
        from src.handlers.reports.cnis import (
            docx_bytes_to_pdf_bytes,
            generate_cnis_docx_from_template,
        )
    except ImportError as e:
        print(f"Erro ao importar módulo: {e}")
        print("Execute a partir da pasta services/worker: uv run python test_cnis_report.py")
        sys.exit(1)

    # try:
    docx_bytes = generate_cnis_docx_from_template(PAYLOAD)
    docx_path.write_bytes(docx_bytes)
    print(f"DOCX gerado: {docx_path} ({len(docx_bytes):,} bytes)")
    # except FileNotFoundError as e:
    #     print(f"Template não encontrado: {e}")
    #     sys.exit(1)
    # except Exception as e:
    #     print(f"Erro ao gerar DOCX: {e}")
    #     sys.exit(1)

    if args.docx:
        print("Concluído (apenas DOCX).")
        return

    print("Convertendo DOCX -> PDF via LibreOffice...")
    try:
        pdf_bytes = docx_bytes_to_pdf_bytes(docx_bytes)
        pdf_path.write_bytes(pdf_bytes)
        print(f"PDF gerado:  {pdf_path} ({len(pdf_bytes):,} bytes)")
    except RuntimeError as e:
        print(f"Erro ao converter para PDF: {e}")
        sys.exit(1)

    print("Concluído.")


if __name__ == "__main__":
    main()
