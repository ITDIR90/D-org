from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import Depends, FastAPI, Request
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.scheduler.scheduler import start_scheduler, stop_scheduler
from app.db.session import async_session, get_db
from app.services.ai_service import ModerationError, get_ai_status, probe_correction
from app.services.notification_delivery import get_channels_status

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session() as db:
        ai = await get_ai_status(db)
    if ai["enabled"] and ai["ready"]:
        print(f"AI: включён ({ai['provider']}, модель {ai['model']})")
    elif ai["enabled"]:
        print(f"AI: включён в настройках, но не готов — {ai['reason']}")
    else:
        print(f"AI: выключен — {ai['reason']}")
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_TAGLINE,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ModerationError)
async def moderation_error_handler(request: Request, exc: ModerationError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": "Внутренняя ошибка сервера"})


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    return {
        "status": "ok",
        "app": settings.APP_SHORT_NAME,
        "ai": await get_ai_status(db),
        "notifications": get_channels_status(),
    }


@app.get("/health/ai/probe")
async def health_ai_probe(db: AsyncSession = Depends(get_db)):
    """Реальный тест исправления текста (не только проверка .env)."""
    return await probe_correction(db)


app.include_router(api_router)
