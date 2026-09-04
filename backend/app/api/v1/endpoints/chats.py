from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import EntityType, UserActionType, UserRole
from app.core.permissions import can_view_group_chat
from app.db.session import get_db
from app.models.chat import GroupChatMessage
from app.models.user import User
from app.schemas.chat import ChatContactRead, ChatMessageCreate, GroupChatMessageRead
from app.schemas.common import MessageResponse
from app.services.ai_service import ModerationError
from app.services.duplicate_message_service import DuplicateMessageError
from app.services.message_submission_service import process_user_message
from app.services.audit_service import log_user_action
from app.services.user_service import list_chat_contacts

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("/contacts", response_model=list[ChatContactRead])
async def chat_contacts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contacts = await list_chat_contacts(db, user)
    return [ChatContactRead(id=u.id, full_name=u.full_name) for u in contacts]


@router.get("/group/{group_id}/messages", response_model=list[GroupChatMessageRead])
async def group_messages(
    group_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_view_group_chat(db, user, group_id):
        raise HTTPException(status_code=403, detail="Нет доступа к чату группы")
    result = await db.execute(
        select(GroupChatMessage).where(GroupChatMessage.group_id == group_id).order_by(GroupChatMessage.created_at)
    )
    messages = result.scalars().all()
    out = []
    for m in messages:
        mr = GroupChatMessageRead.model_validate(m)
        author = await db.get(User, m.author_id)
        if author:
            mr.author_name = author.full_name
        out.append(mr)
    return out


@router.post("/group/{group_id}/messages", response_model=MessageResponse)
async def send_group_message(
    group_id: int,
    data: ChatMessageCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_view_group_chat(db, user, group_id):
        raise HTTPException(status_code=403, detail="Нет доступа")
    try:
        ai_result = await process_user_message(
            db, user.id, data.text,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except DuplicateMessageError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    msg = GroupChatMessage(group_id=group_id, author_id=user.id, text=ai_result.text)
    db.add(msg)
    await log_user_action(
        db, user.id, UserActionType.CHAT_MESSAGE, EntityType.CHAT_MESSAGE, group_id,
        details="group chat", ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return MessageResponse(message="Сообщение отправлено", ai_corrected=ai_result.was_corrected)
