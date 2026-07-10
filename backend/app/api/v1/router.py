from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    chats,
    groups,
    integrations,
    logs,
    notifications,
    projects,
    recurring_tasks,
    request_templates,
    settings,
    tasks,
    users,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(groups.router)
api_router.include_router(categories.router)
api_router.include_router(tasks.router)
api_router.include_router(integrations.router)
api_router.include_router(projects.router)
api_router.include_router(recurring_tasks.router)
api_router.include_router(request_templates.router)
api_router.include_router(notifications.router)
api_router.include_router(chats.router)
api_router.include_router(logs.router)
api_router.include_router(settings.router)
