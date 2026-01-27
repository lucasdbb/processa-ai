from datetime import datetime

from src.features.clients.schemas import (
    ClientListParams,
    ClientResponse,
)

# Mock data baseado no frontend
MOCK_CLIENTS = [
    {
        "id": "1",
        "name": "Joao Silva",
        "cpf": "123.456.789-00",
        "phone": "(11) 99999-0000",
        "email": "joao@email.com",
        "address": None,
        "notes": None,
        "status": "active",
        "processes_count": 2,
        "calculations_count": 5,
        "last_activity": datetime(2026, 1, 25, 10, 30),
    },
    {
        "id": "2",
        "name": "Maria Oliveira",
        "cpf": "987.654.321-00",
        "phone": "(11) 98888-0000",
        "email": "maria@email.com",
        "address": None,
        "notes": None,
        "status": "active",
        "processes_count": 1,
        "calculations_count": 3,
        "last_activity": datetime(2026, 1, 20, 14, 15),
    },
    {
        "id": "3",
        "name": "Carlos Santos",
        "cpf": "111.222.333-00",
        "phone": "(11) 97777-0000",
        "email": "carlos@email.com",
        "address": None,
        "notes": None,
        "status": "archived",
        "processes_count": 1,
        "calculations_count": 2,
        "last_activity": datetime(2025, 12, 27, 9, 0),
    },
]


class ClientsService:
    """Service for client operations (mock data for now)."""

    async def list_clients(
        self,
        user_id: str,
        params: ClientListParams,
    ) -> tuple[list[ClientResponse], int]:
        """List clients for a user."""
        clients = MOCK_CLIENTS.copy()

        # Filter by search
        if params.search:
            search = params.search.lower()
            clients = [
                c for c in clients
                if search in c["name"].lower()
                or search in c["cpf"]
                or (c["email"] and search in c["email"].lower())
            ]

        # Filter by status
        if params.status:
            clients = [c for c in clients if c["status"] == params.status]

        total = len(clients)

        # Pagination
        clients = clients[params.offset:params.offset + params.limit]

        now = datetime.now()
        return [
            ClientResponse(
                id=c["id"],
                user_id=user_id,
                name=c["name"],
                cpf=c["cpf"],
                phone=c["phone"],
                email=c["email"],
                address=c["address"],
                notes=c["notes"],
                status=c["status"],
                processes_count=c["processes_count"],
                calculations_count=c["calculations_count"],
                last_activity=c["last_activity"],
                created_at=now,
                updated_at=now,
            )
            for c in clients
        ], total

    async def get_client(self, user_id: str, client_id: str) -> ClientResponse | None:
        """Get a single client by ID."""
        for c in MOCK_CLIENTS:
            if c["id"] == client_id:
                now = datetime.now()
                return ClientResponse(
                    id=c["id"],
                    user_id=user_id,
                    name=c["name"],
                    cpf=c["cpf"],
                    phone=c["phone"],
                    email=c["email"],
                    address=c["address"],
                    notes=c["notes"],
                    status=c["status"],
                    processes_count=c["processes_count"],
                    calculations_count=c["calculations_count"],
                    last_activity=c["last_activity"],
                    created_at=now,
                    updated_at=now,
                )
        return None


clients_service = ClientsService()
