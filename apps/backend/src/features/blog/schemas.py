from typing import Optional

from pydantic import BaseModel


class BlogPostCreate(BaseModel):
    title: str
    excerpt: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    category_id: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None


class AuthorInfo(BaseModel):
    id: str
    name: Optional[str] = None


class BlogPostItem(BaseModel):
    id: str
    title: str
    slug: str
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    category_id: Optional[str] = None
    author: AuthorInfo
    published_at: Optional[str] = None


class BlogPostListResponse(BaseModel):
    items: list[BlogPostItem]
    page: int
    page_size: int


class BlogPostDetailResponse(BaseModel):
    id: str
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: str
    cover_image_url: Optional[str] = None
    category_id: Optional[str] = None
    published_at: Optional[str] = None
    authors: list[AuthorInfo]


class AddCoauthorRequest(BaseModel):
    user_id: str
