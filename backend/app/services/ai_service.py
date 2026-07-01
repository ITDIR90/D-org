import logging
import re

from openai import APIError, AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import UserActionType
from app.services.app_settings_service import get_ai_enabled
from app.services.audit_service import log_user_action

logger = logging.getLogger(__name__)

GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
OPENAI_MODEL_PREFIXES = ("gpt-", "o1", "o3", "o4", "chatgpt-")


class AIResult:
    def __init__(self, text: str, was_corrected: bool = False):
        self.text = text
        self.was_corrected = was_corrected


class ModerationError(Exception):
    """Контент заблокирован модерацией (не ошибка доступности сервиса)."""
    pass


def _api_key(settings=None) -> str:
    settings = settings or get_settings()
    return (settings.GEMINI_API_KEY or settings.OPENAI_API_KEY or "").strip()


def _is_gemini_key(key: str) -> bool:
    return key.startswith("AIza")


def detect_provider(settings=None) -> str:
    settings = settings or get_settings()
    configured = (settings.AI_PROVIDER or "auto").lower()
    key = _api_key(settings)

    if configured in ("gemini", "google"):
        return "gemini"
    if configured == "openai":
        return "openai"

    if settings.GEMINI_API_KEY:
        return "gemini"
    if key and _is_gemini_key(key):
        return "gemini"
    return "openai"


def _resolved_base_url(settings=None) -> str:
    settings = settings or get_settings()
    if settings.OPENAI_BASE_URL:
        return settings.OPENAI_BASE_URL
    if detect_provider(settings) == "gemini":
        return GEMINI_OPENAI_BASE_URL
    return "https://api.openai.com/v1"


def _resolved_model(settings=None) -> str:
    settings = settings or get_settings()
    model = (settings.AI_MODEL or "").strip()
    provider = detect_provider(settings)

    if provider == "gemini":
        if model and (model.startswith("gemini") or "gemini" in model):
            return model
        return DEFAULT_GEMINI_MODEL

    if model and not model.startswith("gemini"):
        return model
    return DEFAULT_OPENAI_MODEL


def _normalize_corrected_text(raw: str, original: str) -> str:
    text = (raw or "").strip()
    if not text:
        return original

    fence = re.match(r"^```(?:\w+)?\s*\n?(.*?)\n?```\s*$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()

    if len(text) >= 2 and text[0] == text[-1] and text[0] in "\"'«»":
        text = text[1:-1].strip()

    return text or original


async def get_ai_status(db: AsyncSession | None = None) -> dict:
    settings = get_settings()
    provider = detect_provider(settings)
    key = _api_key(settings)
    key_hint = "none"
    if key:
        key_hint = "gemini" if _is_gemini_key(key) else "openai"

    enabled = settings.AI_ENABLED
    if db is not None:
        enabled = await get_ai_enabled(db)

    if not enabled:
        return {
            "enabled": False,
            "ready": False,
            "provider": provider,
            "key_hint": key_hint,
            "reason": "Исправление текста AI выключено супер-администратором",
        }
    if not key:
        return {
            "enabled": True,
            "ready": False,
            "provider": provider,
            "key_hint": key_hint,
            "reason": "Укажите GEMINI_API_KEY (Google AI Studio) или OPENAI_API_KEY",
        }
    if provider == "gemini" and not _is_gemini_key(key) and not settings.GEMINI_API_KEY:
        return {
            "enabled": True,
            "ready": False,
            "provider": provider,
            "key_hint": key_hint,
            "reason": "Для Gemini нужен ключ AIza... из Google AI Studio (сейчас указан ключ OpenAI)",
        }

    return {
        "enabled": True,
        "ready": True,
        "provider": provider,
        "key_hint": key_hint,
        "model": _resolved_model(settings),
        "base_url": _resolved_base_url(settings),
        "moderation": provider == "openai",
        "fail_open": True,
    }


def _openai_client() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(api_key=_api_key(settings), base_url=_resolved_base_url(settings))


async def _try_moderation(
    client: AsyncOpenAI,
    db: AsyncSession,
    user_id: int,
    text: str,
    ip_address: str | None,
    user_agent: str | None,
) -> bool:
    if detect_provider() == "gemini":
        return True

    try:
        moderation = await client.moderations.create(input=text)
        if moderation.results[0].flagged:
            await log_user_action(
                db,
                user_id=user_id,
                action=UserActionType.AI_MODERATION,
                details=f"Заблокированный текст: {text[:200]}",
                ip_address=ip_address,
                user_agent=user_agent,
            )
            raise ModerationError("Текст содержит недопустимый контент и не может быть сохранён")
        return True
    except ModerationError:
        raise
    except (APIError, Exception) as exc:
        logger.warning("AI moderation skipped (service unavailable): %s", exc)
        return False


async def _try_correction(client: AsyncOpenAI, text: str) -> AIResult | None:
    provider = detect_provider()
    model = _resolved_model()
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Ты корректор русского текста. Исправь только орфографию и пунктуацию. "
                        "Верни только исправленный текст, без кавычек и пояснений. "
                        "Если ошибок нет — верни исходный текст без изменений."
                    ),
                },
                {"role": "user", "content": text},
            ],
            temperature=0,
        )
        raw = response.choices[0].message.content if response.choices else None
        corrected = _normalize_corrected_text(raw or text, text)
        was_corrected = corrected != text.strip()
        if was_corrected:
            logger.info("AI corrected text via %s/%s", provider, model)
        return AIResult(text=corrected, was_corrected=was_corrected)
    except (APIError, Exception) as exc:
        logger.warning(
            "AI correction skipped (provider=%s, model=%s): %s",
            provider,
            model,
            exc,
        )
        return None


async def probe_correction(db: AsyncSession) -> dict:
    """Живая проверка: реальный запрос к AI с тестовой фразой."""
    status = await get_ai_status(db)
    if not status.get("ready"):
        return {"ok": False, **status}

    sample = "Заправить принтер в бухгалтери"
    client = _openai_client()
    result = await _try_correction(client, sample)
    if result is None:
        return {
            "ok": False,
            "provider": detect_provider(),
            "model": _resolved_model(),
            "reason": "Запрос к AI не удался — см. логи backend",
        }
    return {
        "ok": True,
        "provider": detect_provider(),
        "model": _resolved_model(),
        "input": sample,
        "output": result.text,
        "corrected": result.was_corrected,
    }


async def process_text(
    db: AsyncSession,
    user_id: int,
    text: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AIResult:
    if not await get_ai_enabled(db) or not _api_key():
        return AIResult(text=text)

    if not (await get_ai_status(db)).get("ready"):
        logger.warning("AI enabled but misconfigured, skipping")
        return AIResult(text=text)

    client = _openai_client()
    await _try_moderation(client, db, user_id, text, ip_address, user_agent)

    corrected = await _try_correction(client, text)
    if corrected is not None:
        return corrected

    return AIResult(text=text)


async def process_fields(
    db: AsyncSession,
    user_id: int,
    fields: dict[str, str],
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> tuple[dict[str, str], bool]:
    corrected_any = False
    result = {}
    for key, value in fields.items():
        if value:
            ai_result = await process_text(db, user_id, value, ip_address, user_agent)
            result[key] = ai_result.text
            if ai_result.was_corrected:
                corrected_any = True
        else:
            result[key] = value
    return result, corrected_any
