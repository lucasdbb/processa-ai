from datetime import datetime, timezone
from uuid import uuid4

from src.features.office.deadlines.schemas import (
    DeadlineCreateRequest,
    DeadlineListParams,
    DeadlineResponse,
    DeadlineUpdateRequest,
)

# Mock data baseado no frontend
MOCK_DEADLINES = [
    {
        "id": "1",
        "type": "Contestacao",
        "process_id": "1",
        "process_number": "0001234-12.2025.5.02.0001",
        "client_name": "Joao Silva",
        "date": datetime(2026, 1, 20, 23, 59, tzinfo=timezone.utc),
        "description": None,
        "status": "pending",
    },
    {
        "id": "2",
        "type": "Recurso Ordinario",
        "process_id": "2",
        "process_number": "0005678-34.2025.5.02.0002",
        "client_name": "Maria Oliveira",
        "date": datetime(2026, 1, 22, 23, 59, tzinfo=timezone.utc),
        "description": None,
        "status": "pending",
    },
    {
        "id": "3",
        "type": "Manifestacao",
        "process_id": "1",
        "process_number": "0009012-56.2025.8.26.0100",
        "client_name": "Pedro Santos",
        "date": datetime(2026, 1, 25, 23, 59, tzinfo=timezone.utc),
        "description": None,
        "status": "pending",
    },
    {
        "id": "4",
        "type": "Audiencia",
        "process_id": "2",
        "process_number": "0003456-78.2025.5.02.0003",
        "client_name": "Ana Costa",
        "date": datetime(2026, 1, 28, 14, 0, tzinfo=timezone.utc),
        "description": "Audiencia de instrucao e julgamento",
        "status": "pending",
    },
]


class DeadlinesService:
    """Service for deadline operations (mock data for now)."""

    def _calculate_days_until(self, date: datetime) -> int:
        """Calculate days until deadline."""
        now = datetime.now(timezone.utc)
        diff = date - now
        return diff.days

    def _get_status(self, date: datetime, original_status: str) -> str:
        """Get actual status based on date."""
        if original_status == "completed":
            return "completed"
        days = self._calculate_days_until(date)
        if days < 0:
            return "overdue"
        return "pending"

    async def list_deadlines(
        self,
        user_id: str,
        params: DeadlineListParams,
    ) -> tuple[list[DeadlineResponse], int, int, int, int]:
        """List deadlines for a user."""
        deadlines = MOCK_DEADLINES.copy()

        # Filter by date range
        if params.start_date:
            deadlines = [d for d in deadlines if d["date"] >= params.start_date]
        if params.end_date:
            deadlines = [d for d in deadlines if d["date"] <= params.end_date]

        # Filter by status
        if params.status:
            deadlines = [
                d for d in deadlines if self._get_status(d["date"], d["status"]) == params.status
            ]

        # Filter by process
        if params.process_id:
            deadlines = [d for d in deadlines if d["process_id"] == params.process_id]

        # Sort by date
        deadlines = sorted(deadlines, key=lambda d: d["date"])

        # Calculate counts
        today_count = sum(1 for d in deadlines if self._calculate_days_until(d["date"]) == 0)
        week_count = sum(1 for d in deadlines if 0 < self._calculate_days_until(d["date"]) <= 7)
        overdue_count = sum(1 for d in deadlines if self._calculate_days_until(d["date"]) < 0)

        total = len(deadlines)

        # Pagination
        deadlines = deadlines[params.offset : params.offset + params.limit]

        now_ts = datetime.now(timezone.utc)
        responses = [
            DeadlineResponse(
                id=d["id"],
                user_id=user_id,
                type=d["type"],
                process_id=d["process_id"],
                process_number=d["process_number"],
                client_name=d["client_name"],
                date=d["date"],
                description=d["description"],
                status=self._get_status(d["date"], d["status"]),
                days_until=self._calculate_days_until(d["date"]),
                created_at=now_ts,
                updated_at=now_ts,
            )
            for d in deadlines
        ]

        return responses, total, today_count, week_count, overdue_count

    async def get_deadline(self, user_id: str, deadline_id: str) -> DeadlineResponse | None:
        """Get a single deadline by ID."""
        for d in MOCK_DEADLINES:
            if d["id"] == deadline_id:
                now = datetime.now(timezone.utc)
                return DeadlineResponse(
                    id=d["id"],
                    user_id=user_id,
                    type=d["type"],
                    process_id=d["process_id"],
                    process_number=d["process_number"],
                    client_name=d["client_name"],
                    date=d["date"],
                    description=d["description"],
                    status=self._get_status(d["date"], d["status"]),
                    days_until=self._calculate_days_until(d["date"]),
                    created_at=now,
                    updated_at=now,
                )
        return None

    async def create_deadline(self, user_id: str, data: DeadlineCreateRequest) -> DeadlineResponse:
        """Create a new deadline."""
        deadline_id = str(uuid4())
        now = datetime.now(timezone.utc)

        new_deadline = {
            "id": deadline_id,
            "type": data.type,
            "process_id": data.process_id,
            "process_number": f"PROC-{deadline_id[:8].upper()}",  # Mock process number
            "client_name": "Cliente Mock",  # Mock client name
            "date": data.date,
            "description": data.description,
            "status": "pending",
        }

        MOCK_DEADLINES.append(new_deadline)

        return DeadlineResponse(
            id=deadline_id,
            user_id=user_id,
            type=new_deadline["type"],
            process_id=new_deadline["process_id"],
            process_number=new_deadline["process_number"],
            client_name=new_deadline["client_name"],
            date=new_deadline["date"],
            description=new_deadline["description"],
            status=self._get_status(new_deadline["date"], new_deadline["status"]),
            days_until=self._calculate_days_until(new_deadline["date"]),
            created_at=now,
            updated_at=now,
        )

    async def update_deadline(
        self, user_id: str, deadline_id: str, data: DeadlineUpdateRequest
    ) -> DeadlineResponse | None:
        """Update an existing deadline."""
        for d in MOCK_DEADLINES:
            if d["id"] == deadline_id:
                if data.type is not None:
                    d["type"] = data.type
                if data.date is not None:
                    d["date"] = data.date
                if data.description is not None:
                    d["description"] = data.description
                if data.status is not None:
                    d["status"] = data.status

                now = datetime.now(timezone.utc)
                return DeadlineResponse(
                    id=d["id"],
                    user_id=user_id,
                    type=d["type"],
                    process_id=d["process_id"],
                    process_number=d["process_number"],
                    client_name=d["client_name"],
                    date=d["date"],
                    description=d["description"],
                    status=self._get_status(d["date"], d["status"]),
                    days_until=self._calculate_days_until(d["date"]),
                    created_at=now,
                    updated_at=now,
                )
        return None

    async def delete_deadline(self, user_id: str, deadline_id: str) -> bool:
        """Delete a deadline."""
        for i, d in enumerate(MOCK_DEADLINES):
            if d["id"] == deadline_id:
                MOCK_DEADLINES.pop(i)
                return True
        return False


deadlines_service = DeadlinesService()
