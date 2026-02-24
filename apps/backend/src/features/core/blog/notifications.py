"""
Blog post notifications helpers
Create in-app notifications when new blog posts are published
"""

from src.core.logging import logger
from src.core.supabase import get_supabase


async def notify_new_blog_post(post_id: str, post_title: str, post_slug: str):
    """
    Create in-app notifications for all users when a new blog post is published

    Args:
        post_id: ID of the blog post
        post_title: Title of the blog post
        post_slug: Slug of the blog post (for link)
    """
    supabase = get_supabase()

    try:
        # Get all active users
        users_result = supabase.table("profiles").select("id").execute()

        if not users_result.data:
            logger.warning("No users found to notify about new blog post")
            return 0

        # Create notifications for all users
        notifications = [
            {
                "user_id": user["id"],
                "type": "blog",
                "title": "Novo artigo publicado no blog",
                "description": post_title,
                "metadata": {
                    "post_id": post_id,
                    "post_slug": post_slug,
                    "post_title": post_title,
                },
            }
            for user in users_result.data
        ]

        result = supabase.table("notifications").insert(notifications).execute()

        logger.info(
            f"Created {len(result.data)} in-app notifications for new blog post: {post_title}"
        )
        return len(result.data)

    except Exception as e:
        logger.error(f"Failed to create blog post notifications: {e}")
        return 0


# Usage: Add this to BlogService.publish() method after publishing:
#
# if post.status == 'published':
#     # Send email notifications (already exists)
#     if notify_subscribers:
#         notifications_sent = await self._notify_subscribers(post_id)
#
#     # Send in-app notifications (NEW)
#     from src.features.core.blog.notifications import notify_new_blog_post
#     await notify_new_blog_post(post_id, post.title, post.slug)
