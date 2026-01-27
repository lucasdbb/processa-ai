from fastapi import APIRouter

from src.features.calendar.router import router as calendar_router
from src.features.clients.router import router as clients_router
from src.features.deadlines.router import router as deadlines_router
from src.features.documents.router import router as documents_router
from src.features.processes.router import router as processes_router

api_router = APIRouter()

# Office management features
api_router.include_router(clients_router, prefix="/v1/clients", tags=["Clients"])
api_router.include_router(processes_router, prefix="/v1/processes", tags=["Processes"])
api_router.include_router(deadlines_router, prefix="/v1/deadlines", tags=["Deadlines"])
api_router.include_router(documents_router, prefix="/v1/documents", tags=["Documents"])
api_router.include_router(calendar_router, prefix="/v1/calendar", tags=["Calendar"])
