"""Tests for the process summary report generator (DOCX generation).

Run from services/worker/:
    uv run pytest tests/
    uv run pytest tests/ -v --tb=short

Note: PDF conversion tests are excluded — they require LibreOffice (Docker).
"""

import pytest

from src.handlers.reports.process_summary import generate_process_summary_docx_from_template


class TestGenerateProcessSummaryDocx:
    def test_returns_bytes(self, process_summary_payload):
        result = generate_process_summary_docx_from_template(process_summary_payload)
        assert isinstance(result, bytes)

    def test_docx_is_valid_zip(self, process_summary_payload):
        """DOCX files are ZIP archives — must start with PK magic bytes."""
        result = generate_process_summary_docx_from_template(process_summary_payload)
        assert result[:2] == b"PK", "Expected DOCX (ZIP) magic bytes 'PK'"

    def test_docx_has_meaningful_size(self, process_summary_payload):
        result = generate_process_summary_docx_from_template(process_summary_payload)
        assert len(result) > 10_000, "Generated DOCX is unexpectedly small"

    def test_raises_if_template_missing(self, process_summary_payload, tmp_path, monkeypatch):
        import src.handlers.reports.process_summary as report_module

        monkeypatch.setattr(report_module, "TEMPLATE_PATH", tmp_path / "nonexistent.docx")
        with pytest.raises(FileNotFoundError, match="Template não encontrado"):
            generate_process_summary_docx_from_template(process_summary_payload)

    def test_empty_payload_uses_fallbacks(self):
        """Empty payload must not raise — fallback values fill the template."""
        result = generate_process_summary_docx_from_template({})
        assert result[:2] == b"PK"

    def test_payload_without_optional_lists(self):
        """Payload with empty lists for decisions/deadlines must not raise."""
        payload = {
            "identificacao": {
                "tipo_acao": "Ação de Cobrança",
                "numero_processo": "0000000-00.2025.0.00.0000",
                "vara_tribunal": "1ª Vara Cível",
                "autor": "Fulano de Tal",
                "reu": "Empresa Exemplo Ltda",
            },
            "valor_causa": "R$ 5.000,00",
            "resumo_executivo": "Ação de cobrança de valores inadimplidos.",
            "fatos_relevantes": ["Dívida contraída em 01/01/2024 não foi quitada."],
            "pedidos": ["Pagamento do débito principal acrescido de juros e correção monetária."],
            "decisoes": [],
            "prazos_datas": [],
            "pontos_atencao": [],
            "proximos_passos": [],
        }
        result = generate_process_summary_docx_from_template(payload)
        assert result[:2] == b"PK"
