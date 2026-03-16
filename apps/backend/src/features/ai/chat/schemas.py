from pydantic import BaseModel, ConfigDict, Field


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SessionResponse(BaseModel):
    id: str
    title: str | None = None
    status: str
    message_count: int
    max_messages: int
    credits_consumed: int
    created_at: str
    updated_at: str
    last_message_at: str | None = None


class SessionListResponse(BaseModel):
    sessions: list[SessionResponse]
    total: int


class ChatMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=1, max_length=4000)


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class SessionWithMessagesResponse(BaseModel):
    session: SessionResponse
    messages: list[ChatMessageResponse]
