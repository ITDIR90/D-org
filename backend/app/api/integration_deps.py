from fastapi import Depends, HTTPException, Request, status

from app.core.config import get_settings


async def verify_integration_api_key(request: Request) -> None:
    settings = get_settings()
    if not settings.INTEGRATION_API_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API интеграции отключён на сервере",
        )
    if not settings.INTEGRATION_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="API-ключ интеграции не настроен",
        )

    api_key = request.headers.get("X-API-Key", "").strip()
    if not api_key:
        auth = request.headers.get("Authorization", "").strip()
        if auth.lower().startswith("bearer "):
            api_key = auth[7:].strip()

    if api_key != settings.INTEGRATION_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный API-ключ",
        )


IntegrationAuth = Depends(verify_integration_api_key)
