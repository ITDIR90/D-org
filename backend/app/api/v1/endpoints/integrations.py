from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.integration_deps import IntegrationAuth
from app.db.session import get_db
from app.schemas.integration import IntegrationRequestCreate, IntegrationRequestRead
from app.services.integration_service import create_integration_request

router = APIRouter(prefix="/integrations/onec", tags=["integrations-onec"])


@router.post("/requests", response_model=IntegrationRequestRead)
async def onec_create_request(
    data: IntegrationRequestCreate,
    request: Request,
    _: None = IntegrationAuth,
    db: AsyncSession = Depends(get_db),
):
    """Создать новую заявку из 1С."""
    result = await create_integration_request(
        db,
        data,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    status_code = 200 if result.already_exists else 201
    return JSONResponse(status_code=status_code, content=result.model_dump(mode="json"))
