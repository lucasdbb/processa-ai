from datetime import datetime

from src.features.processes.schemas import (
    ProcessListParams,
    ProcessResponse,
)

# Mock data baseado no frontend
MOCK_PROCESSES = [
    {
        "id": "1",
        "number": "0001234-12.2025.5.02.0001",
        "type": "Reclamacao Trabalhista",
        "court": "2a Vara do Trabalho de Sao Paulo",
        "client_id": "1",
        "client_name": "Joao Silva",
        "defendant": "Empresa ABC Ltda",
        "value": 45000.0,
        "description": None,
        "status": "active",
        "next_deadline": "3 dias",
    },
    {
        "id": "2",
        "number": "0005678-34.2025.5.02.0002",
        "type": "Recurso Ordinario",
        "court": "TRT 2a Regiao",
        "client_id": "2",
        "client_name": "Maria Oliveira",
        "defendant": "Empresa XYZ S.A.",
        "value": 120000.0,
        "description": None,
        "status": "active",
        "next_deadline": "7 dias",
    },
    {
        "id": "3",
        "number": "1000567-89.2024.8.26.0100",
        "type": "Acao de Cobranca",
        "court": "5a Vara Civel de Sao Paulo",
        "client_id": "3",
        "client_name": "Carlos Santos",
        "defendant": "Empresa DEF Ltda",
        "value": 35000.0,
        "description": None,
        "status": "archived",
        "next_deadline": None,
    },
]


class ProcessesService:
    """Service for process operations (mock data for now)."""

    async def list_processes(
        self,
        user_id: str,
        params: ProcessListParams,
    ) -> tuple[list[ProcessResponse], int]:
        """List processes for a user."""
        processes = MOCK_PROCESSES.copy()

        # Filter by search
        if params.search:
            search = params.search.lower()
            processes = [
                p for p in processes
                if search in p["number"].lower()
                or search in p["type"].lower()
                or search in p["client_name"].lower()
                or search in p["defendant"].lower()
            ]

        # Filter by status
        if params.status:
            processes = [p for p in processes if p["status"] == params.status]

        # Filter by client
        if params.client_id:
            processes = [p for p in processes if p["client_id"] == params.client_id]

        total = len(processes)

        # Pagination
        processes = processes[params.offset:params.offset + params.limit]

        now = datetime.now()
        return [
            ProcessResponse(
                id=p["id"],
                user_id=user_id,
                number=p["number"],
                type=p["type"],
                court=p["court"],
                client_id=p["client_id"],
                client_name=p["client_name"],
                defendant=p["defendant"],
                value=p["value"],
                description=p["description"],
                status=p["status"],
                next_deadline=p["next_deadline"],
                created_at=now,
                updated_at=now,
            )
            for p in processes
        ], total

    async def get_process(self, user_id: str, process_id: str) -> ProcessResponse | None:
        """Get a single process by ID."""
        for p in MOCK_PROCESSES:
            if p["id"] == process_id:
                now = datetime.now()
                return ProcessResponse(
                    id=p["id"],
                    user_id=user_id,
                    number=p["number"],
                    type=p["type"],
                    court=p["court"],
                    client_id=p["client_id"],
                    client_name=p["client_name"],
                    defendant=p["defendant"],
                    value=p["value"],
                    description=p["description"],
                    status=p["status"],
                    next_deadline=p["next_deadline"],
                    created_at=now,
                    updated_at=now,
                )
        return None


processes_service = ProcessesService()
