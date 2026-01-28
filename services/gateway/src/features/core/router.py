"""Core API proxy router - Routes requests to the Core API microservice."""

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile

from src.core.auth import get_current_user
from src.core.config import settings
from src.core.proxy import proxy_request

router = APIRouter()


# === Profiles ===


@router.get("/profiles/me")
async def get_my_profile(user=Depends(get_current_user)):
    """Get current user's profile."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/profiles/me",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


@router.put("/profiles/me")
async def update_my_profile(request: Request, user=Depends(get_current_user)):
    """Update current user's profile."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="PUT",
        path="/api/v1/profiles/me",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )


@router.get("/profiles")
async def list_profiles(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List all profiles (admin only)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/profiles",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params={"limit": limit, "offset": offset},
    )


@router.patch("/profiles/role")
async def update_role(request: Request, user=Depends(get_current_user)):
    """Update user role (admin only)."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="PATCH",
        path="/api/v1/profiles/role",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )


# === Blog ===


@router.get("/blog/posts")
async def list_blog_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    category_slug: str | None = None,
):
    """List published blog posts (public)."""
    params = {"page": page, "page_size": page_size}
    if search:
        params["search"] = search
    if category_slug:
        params["category_slug"] = category_slug

    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/blog/posts",
        params=params,
    )


@router.get("/blog/posts/{slug}")
async def get_blog_post(slug: str):
    """Get a published blog post by slug (public)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/blog/posts/{slug}",
    )


@router.get("/blog/admin/posts")
async def list_admin_posts(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    user=Depends(get_current_user),
):
    """List all blog posts for admin."""
    params = {"page": page, "page_size": page_size}
    if search:
        params["search"] = search
    if status:
        params["status"] = status

    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/blog/admin/posts",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        params=params,
    )


@router.get("/blog/admin/posts/{post_id}")
async def get_admin_post(post_id: str, user=Depends(get_current_user)):
    """Get a blog post for admin editing."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/blog/admin/posts/{post_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


@router.post("/blog/posts")
async def create_blog_post(request: Request, user=Depends(get_current_user)):
    """Create a new blog post."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="POST",
        path="/api/v1/blog/posts",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )


@router.patch("/blog/posts/{post_id}")
async def update_blog_post(
    post_id: str, request: Request, user=Depends(get_current_user)
):
    """Update a blog post."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="PATCH",
        path=f"/api/v1/blog/posts/{post_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
        json=body,
    )


@router.patch("/blog/posts/{post_id}/publish")
async def publish_blog_post(post_id: str, user=Depends(get_current_user)):
    """Publish a blog post (admin only)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="PATCH",
        path=f"/api/v1/blog/posts/{post_id}/publish",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


@router.delete("/blog/posts/{post_id}")
async def delete_blog_post(post_id: str, user=Depends(get_current_user)):
    """Delete a blog post (admin only)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="DELETE",
        path=f"/api/v1/blog/posts/{post_id}",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


# === Newsletter ===


@router.post("/newsletter/subscribe")
async def subscribe_newsletter(request: Request):
    """Subscribe to newsletter (public)."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="POST",
        path="/api/v1/newsletter/subscribe",
        json=body,
    )


@router.get("/newsletter/confirm")
async def confirm_newsletter(token: str = Query(...)):
    """Confirm newsletter subscription (public)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/newsletter/confirm",
        params={"token": token},
    )


@router.post("/newsletter/unsubscribe")
async def unsubscribe_newsletter(request: Request):
    """Unsubscribe from newsletter (public)."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="POST",
        path="/api/v1/newsletter/unsubscribe",
        json=body,
    )


# === Support ===


@router.post("/support/contact")
async def contact_support(request: Request):
    """Submit a support contact form (public)."""
    body = await request.json()
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="POST",
        path="/api/v1/support/contact",
        json=body,
    )


# === Materials ===


@router.get("/materials/list")
async def list_materials():
    """List available materials (public)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/materials/list",
    )


@router.get("/materials/{slug}/download")
async def download_material(slug: str, user=Depends(get_current_user)):
    """Download a material (authenticated)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path=f"/api/v1/materials/{slug}/download",
        user_id=user.get("user_id"),
        user_role=user.get("role"),
    )


# === Plans ===


@router.get("/plans")
async def list_plans():
    """List available plans (public)."""
    return await proxy_request(
        base_url=settings.CORE_API_BASE_URL,
        internal_token=settings.CORE_API_INTERNAL_TOKEN,
        method="GET",
        path="/api/v1/plans",
    )
