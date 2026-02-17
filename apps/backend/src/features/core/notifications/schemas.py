from typing import Optional

from pydantic import BaseModel


class NotificationCreate(BaseModel):
    """Schema para criar uma notificação (admin)"""

    type: str  # system, blog, feature, deadline, process, calculation
    title: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    user_id: Optional[str] = None  # Se None, envia para todos


class NotificationUpdate(BaseModel):
    """Schema para atualizar uma notificação"""

    read: Optional[bool] = None


class NotificationItem(BaseModel):
    """Schema de item de notificação"""

    id: str
    user_id: str
    type: str
    title: str
    description: Optional[str] = None
    metadata: Optional[dict] = None
    read: bool
    read_at: Optional[str] = None
    created_at: str
    updated_at: str


class NotificationListResponse(BaseModel):
    """Schema de resposta da listagem de notificações"""

    items: list[NotificationItem]
    total: int
    unread_count: int


class NotificationStatsResponse(BaseModel):
    """Schema de estatísticas de notificações (admin)"""

    total_sent: int
    total_read: int
    total_unread: int
