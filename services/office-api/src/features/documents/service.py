from datetime import datetime

from src.features.documents.schemas import (
    DocumentListParams,
    DocumentResponse,
)

# Mock data - lista vazia por enquanto (como no frontend)
MOCK_DOCUMENTS: list[dict] = []


class DocumentsService:
    """Service for document operations (mock data for now)."""

    async def list_documents(
        self,
        user_id: str,
        params: DocumentListParams,
    ) -> tuple[list[DocumentResponse], int]:
        """List documents for a user."""
        documents = MOCK_DOCUMENTS.copy()

        # Filter by search
        if params.search:
            search = params.search.lower()
            documents = [
                d
                for d in documents
                if search in d["name"].lower()
                or (d["description"] and search in d["description"].lower())
            ]

        # Filter by type
        if params.type:
            documents = [d for d in documents if d["type"] == params.type]

        # Filter by status
        if params.status:
            documents = [d for d in documents if d["status"] == params.status]

        # Filter by process
        if params.process_id:
            documents = [d for d in documents if d["process_id"] == params.process_id]

        # Filter by client
        if params.client_id:
            documents = [d for d in documents if d["client_id"] == params.client_id]

        total = len(documents)

        # Pagination
        documents = documents[params.offset : params.offset + params.limit]

        now = datetime.now()
        return [
            DocumentResponse(
                id=d["id"],
                user_id=user_id,
                name=d["name"],
                type=d["type"],
                status=d["status"],
                file_url=d.get("file_url"),
                file_size=d.get("file_size"),
                mime_type=d.get("mime_type"),
                process_id=d.get("process_id"),
                client_id=d.get("client_id"),
                description=d.get("description"),
                created_at=now,
                updated_at=now,
            )
            for d in documents
        ], total

    async def get_document(self, user_id: str, document_id: str) -> DocumentResponse | None:
        """Get a single document by ID."""
        for d in MOCK_DOCUMENTS:
            if d["id"] == document_id:
                now = datetime.now()
                return DocumentResponse(
                    id=d["id"],
                    user_id=user_id,
                    name=d["name"],
                    type=d["type"],
                    status=d["status"],
                    file_url=d.get("file_url"),
                    file_size=d.get("file_size"),
                    mime_type=d.get("mime_type"),
                    process_id=d.get("process_id"),
                    client_id=d.get("client_id"),
                    description=d.get("description"),
                    created_at=now,
                    updated_at=now,
                )
        return None


documents_service = DocumentsService()
