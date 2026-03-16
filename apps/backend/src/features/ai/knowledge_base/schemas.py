"""Pydantic schemas for the Knowledge Base module."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LegalAreaResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None = None


class LegalTopicResponse(BaseModel):
    id: str
    area_id: str
    name: str
    slug: str
    keywords: list[str] = []


class TaxonomyResponse(BaseModel):
    areas: list[LegalAreaResponse]
    topics: list[LegalTopicResponse]


class CreateAreaRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50)
    description: str | None = None


class CreateTopicRequest(BaseModel):
    area_id: str
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(..., min_length=2, max_length=50)
    keywords: list[str] = []


class RagDocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    document_type: str
    status: str
    error_message: str | None = None
    total_chunks: int = 0
    is_compound: bool = False
    area_id: str | None = None
    area_name: str | None = None
    topic_id: str | None = None
    topic_name: str | None = None
    created_at: str
    updated_at: str


class RagDocumentListResponse(BaseModel):
    documents: list[RagDocumentResponse]
    total: int


class RagChunkPreview(BaseModel):
    id: str
    content: str
    section_title: str | None = None
    area: str
    legislacao: str | None = None
    artigo: str | None = None
    chunk_index: int


class RagDocumentDetailResponse(BaseModel):
    document: RagDocumentResponse
    chunks: list[RagChunkPreview]


class TextDocumentRequest(BaseModel):
    content: str = Field(..., min_length=50, max_length=100000)
    area_id: str
    legislacao: str | None = None
    artigo: str | None = None
    title: str = Field(..., min_length=2, max_length=200)


class UrlDocumentRequest(BaseModel):
    url: str = Field(..., min_length=10)
    area_id: str
    title: str | None = None


class KnowledgeBaseStatsResponse(BaseModel):
    total_documents: int
    total_chunks: int
    documents_by_status: dict[str, int]
    chunks_by_area: dict[str, int]
