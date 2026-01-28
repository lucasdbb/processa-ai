from fastapi import APIRouter, Depends, Header, Query, status

from src.core.auth import get_user_id, verify_internal_token
from src.features.core.blog.schemas import (
    AddCoauthorRequest,
    BlogPostCreate,
    BlogPostDetailResponse,
    BlogPostListResponse,
    BlogPostUpdate,
)
from src.features.core.blog.service import BlogService

router = APIRouter(dependencies=[Depends(verify_internal_token)])
service = BlogService()


@router.get("/admin/posts", response_model=BlogPostListResponse)
async def list_admin_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    user_id: str = Depends(get_user_id),
    x_user_role: str = Header("user"),
):
    return await service.list_all(user_id, x_user_role, page, page_size, search, status)


@router.get("/admin/posts/{post_id}", response_model=BlogPostDetailResponse)
async def get_admin_post(
    post_id: str,
    user_id: str = Depends(get_user_id),
    x_user_role: str = Header("user"),
):
    return await service.get_admin_post(user_id, x_user_role, post_id)


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
async def create_post(
    data: BlogPostCreate,
    user_id: str = Depends(get_user_id),
    x_user_role: str = Header("user"),
):
    return await service.create_draft(user_id, x_user_role, data)


@router.patch("/posts/{post_id}")
async def update_post(
    post_id: str,
    data: BlogPostUpdate,
    user_id: str = Depends(get_user_id),
):
    return await service.update_draft(user_id, post_id, data)


@router.post("/posts/{post_id}/authors")
async def add_coauthor(
    post_id: str,
    data: AddCoauthorRequest,
    user_id: str = Depends(get_user_id),
    x_user_role: str = Header("user"),
):
    return await service.add_coauthor(user_id, x_user_role, post_id, data.user_id)


@router.patch("/posts/{post_id}/publish")
async def publish_post(
    post_id: str,
    x_user_role: str = Header("user"),
):
    return await service.publish(x_user_role, post_id)


@router.patch("/posts/{post_id}/restore")
async def restore_post(
    post_id: str,
    x_user_role: str = Header("user"),
):
    return await service.restore(x_user_role, post_id)


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    x_user_role: str = Header("user"),
):
    return await service.delete_post(x_user_role, post_id)
