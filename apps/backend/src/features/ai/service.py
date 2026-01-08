from fastapi import UploadFile

from src.shared.database import get_supabase


class AiService:
    def __init__(self):
        self.supabase = get_supabase()

    async def analyze_cnis(self, file: UploadFile) -> str:
        content = await file.read()
        size_mb = len(content) / (1024 * 1024)
        return (
            "ANÁLISE DE CNIS (PRÉVIA)\n\n"
            "Arquivo recebido:\n"
            f"- Nome: {file.filename}\n"
            f"- Tamanho: {size_mb:.2f} MB\n\n"
            "1) Resumo\n"
            "- Extração e leitura do CNIS a partir do PDF.\n"
            "- Identificação de vínculos, remunerações e contribuições por competência.\n\n"
            "2) Pontos de atenção\n"
            "- Lacunas contributivas e períodos sem remuneração.\n"
            "- Divergências de vínculo/empregador e indicadores (ex.: extemporâneo).\n"
            "- Concomitâncias e possíveis sobreposições.\n\n"
            "3) Próximos passos\n"
            "- Informar DER pretendida e tipo de segurado.\n"
            "- Se houver, enviar CTPS, carnês e/ou PPP para confrontar o CNIS.\n"
        )

    async def list_tools(self):
        response = (
            self.supabase.table("ai_tools")
            .select("slug,name,description,icon,locked,order")
            .order("order")
            .execute()
        )

        return response.data or []
