"""Tests for the CNIS report generator (DOCX generation).

Run from services/worker/:
    uv run pytest tests/
    uv run pytest tests/ -v --tb=short

Note: PDF conversion tests are excluded — they require LibreOffice (Docker).
"""

from src.handlers.reports.cnis import generate_cnis_docx_from_template


class TestGenerateCnisDocx:
    def test_returns_bytes(self, cnis_payload):
        result = generate_cnis_docx_from_template(cnis_payload)
        assert isinstance(result, bytes)

    def test_docx_is_valid_zip(self, cnis_payload):
        """DOCX files are ZIP archives — must start with PK magic bytes."""
        result = generate_cnis_docx_from_template(cnis_payload)
        assert result[:2] == b"PK", "Expected DOCX (ZIP) magic bytes 'PK'"

    def test_docx_has_meaningful_size(self, cnis_payload):
        result = generate_cnis_docx_from_template(cnis_payload)
        assert len(result) > 10_000, "Generated DOCX is unexpectedly small"

    def test_raises_if_template_missing(self, cnis_payload, tmp_path, monkeypatch):
        import src.handlers.reports.cnis as report_module

        monkeypatch.setattr(report_module, "TEMPLATE_PATH", tmp_path / "nonexistent.docx")
        import pytest

        with pytest.raises(FileNotFoundError, match="Template não encontrado"):
            generate_cnis_docx_from_template(cnis_payload)

    def test_empty_payload_uses_fallbacks(self):
        """Empty payload must not raise — fallback values fill the template."""
        result = generate_cnis_docx_from_template({})
        assert result[:2] == b"PK"
