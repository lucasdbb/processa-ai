"""Main API router that aggregates all feature routers"""

from fastapi import APIRouter

# AI features
from src.features.ai.router import router as ai_router
from src.features.billing.credits.router import router as credits_router

# Billing features
from src.features.billing.subscriptions.router import router as subscriptions_router
from src.features.billing.webhooks.router import router as webhooks_router

# Calculator features
from src.features.calculators.router import router as calculators_router
from src.features.core.blog.router import router as blog_router
from src.features.core.dashboard.router import router as dashboard_router

# Core features
from src.features.core.documents.router import router as gen_documents_router
from src.features.core.feedback.router import router as feedback_router
from src.features.core.materials.router import router as materials_router
from src.features.core.newsletter.router import router as newsletter_router
from src.features.core.notification_logs.router import router as notification_logs_router
from src.features.core.notifications.router import router as notifications_router
from src.features.core.plans.router import router as plans_router
from src.features.core.profiles.router import router as profiles_router
from src.features.core.storage.router import router as storage_router
from src.features.core.support.router import router as support_router
from src.features.core.waitlist.router import router as waitlist_router

# Office features
from src.features.office.calendar.router import router as calendar_router
from src.features.office.clients.router import router as clients_router
from src.features.office.deadlines.router import router as deadlines_router
from src.features.office.documents.router import router as documents_router
from src.features.office.fee_payments.router import router as fee_payments_router
from src.features.office.fees.router import router as fees_router
from src.features.office.notes.router import router as notes_router
from src.features.office.processes.router import router as processes_router
from src.features.office.services.router import router as services_router
from src.features.office.timeline.router import router as timeline_router

# Portal (client-facing read-only views)
from src.features.portal.router import router as portal_router

api_router = APIRouter()

# Core features
api_router.include_router(profiles_router, prefix="/profiles", tags=["Profiles"])
api_router.include_router(profiles_router, prefix="/users", tags=["Profiles", "Users (Alias)"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(blog_router, prefix="/blog", tags=["Blog"])
api_router.include_router(newsletter_router, prefix="/newsletter", tags=["Newsletter"])
api_router.include_router(support_router, prefix="/support", tags=["Support"])
api_router.include_router(feedback_router, prefix="/feedback", tags=["Feedback"])
api_router.include_router(materials_router, prefix="/materials", tags=["Materials"])
api_router.include_router(plans_router, prefix="/plans", tags=["Plans"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(
    notification_logs_router, prefix="/notification-logs", tags=["Notification Logs"]
)
api_router.include_router(storage_router, prefix="/storage", tags=["Storage"])
api_router.include_router(gen_documents_router, prefix="/documents", tags=["Documents"])
api_router.include_router(waitlist_router, prefix="/waitlist", tags=["Waitlist"])

# Billing features
api_router.include_router(subscriptions_router, prefix="/billing/subscriptions", tags=["Billing"])
api_router.include_router(webhooks_router, prefix="/billing/webhooks", tags=["Billing Webhooks"])
api_router.include_router(credits_router, prefix="/credits", tags=["Credits"])

# Calculator features
api_router.include_router(calculators_router, prefix="/calculators", tags=["Calculators"])

# AI features
api_router.include_router(ai_router, prefix="/ai", tags=["AI"])

# Portal
api_router.include_router(portal_router, prefix="/portal", tags=["Portal"])

# Office features
api_router.include_router(calendar_router, prefix="/office/calendar", tags=["Calendar"])
api_router.include_router(clients_router, prefix="/office/clients", tags=["Clients"])
api_router.include_router(processes_router, prefix="/office/processes", tags=["Processes"])
api_router.include_router(deadlines_router, prefix="/office/deadlines", tags=["Deadlines"])
api_router.include_router(documents_router, prefix="/office/documents", tags=["Documents"])
api_router.include_router(fees_router, prefix="/office/fees", tags=["Fees"])
api_router.include_router(fee_payments_router, prefix="/office/fee-payments", tags=["Fee Payments"])
api_router.include_router(notes_router, prefix="/office/notes", tags=["Notes"])
api_router.include_router(services_router, prefix="/office/services", tags=["Services"])
api_router.include_router(timeline_router, prefix="/office/timeline", tags=["Timeline"])
