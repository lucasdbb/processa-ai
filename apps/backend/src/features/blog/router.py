from fastapi import APIRouter, Depends, Query, status

from src.core.dependencies import get_current_admin, get_current_staff
from src.features.blog.schemas import (
    AddCoauthorRequest,
    BlogPostCreate,
    BlogPostDetailResponse,
    BlogPostListResponse,
    BlogPostUpdate,
)
from src.features.blog.service import BlogService

router = APIRouter()
service = BlogService()


@router.get("/admin/posts", response_model=BlogPostListResponse)
async def list_admin_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    admin=Depends(get_current_staff),
):
    return await service.list_all(admin, page, page_size, search, status)


@router.get("/admin/posts/{post_id}", response_model=BlogPostDetailResponse)
async def get_admin_post(post_id: str, admin=Depends(get_current_staff)):
    return await service.get_admin_post(admin, post_id)


@router.get("/posts", response_model=BlogPostListResponse)
async def list_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    category_slug: str | None = None,
):
    return await service.list_published(page, page_size, search, category_slug)


@router.get("/posts/{slug}", response_model=BlogPostDetailResponse)
async def get_post(slug: str):
    return await service.get_published_by_slug(slug)


@router.post("/posts", status_code=status.HTTP_201_CREATED)
async def create_post(data: BlogPostCreate, user=Depends(get_current_staff)):
    return await service.create_draft(user, data)


@router.patch("/posts/{post_id}")
async def update_post(post_id: str, data: BlogPostUpdate, user=Depends(get_current_staff)):
    return await service.update_draft(user, post_id, data)


@router.post("/posts/{post_id}/authors")
async def add_coauthor(post_id: str, data: AddCoauthorRequest, user=Depends(get_current_staff)):
    return await service.add_coauthor(user, post_id, data.user_id)


@router.patch("/posts/{post_id}/publish")
async def publish_post(post_id: str, admin=Depends(get_current_admin)):
    return await service.publish(admin, post_id)


@router.patch("/posts/{post_id}/restore")
async def restore_post(post_id: str, admin=Depends(get_current_admin)):
    return await service.restore(admin, post_id)


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, admin=Depends(get_current_admin)):
    return await service.delete_post(admin, post_id)
