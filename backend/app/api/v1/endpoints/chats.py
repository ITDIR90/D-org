from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import EntityType, UserActionType, UserRole
from app.core.permissions import can_message_user, can_view_group_chat
from app.db.session import get_db
from app.models.chat import DirectChatMessage, GroupChatMessage
from app.models.user import User
from app.schemas.chat import ChatContactRead, ChatMessageCreate, DirectChatMessageRead, DirectThreadRead, GroupChatMessageRead
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


@router.get("/direct/threads", response_model=list[DirectThreadRead])
async def direct_threads(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DirectChatMessage).where(
            or_(DirectChatMessage.sender_id == user.id, DirectChatMessage.recipient_id == user.id)
        ).order_by(DirectChatMessage.created_at.desc())
    )
    latest_by_other: dict[int, DirectChatMessage] = {}
    for message in result.scalars().all():
        other_id = message.recipient_id if message.sender_id == user.id else message.sender_id
        if other_id not in latest_by_other:
            latest_by_other[other_id] = message

    threads: list[DirectThreadRead] = []
    for other_id, message in latest_by_other.items():
        if not await can_message_user(db, user, other_id):
            continue
        other = await db.get(User, other_id)
        if not other or not other.is_active:
            continue
        threads.append(
            DirectThreadRead(
                user_id=other_id,
                full_name=other.full_name,
                last_message_text=message.text,
                last_message_at=message.created_at,
                last_message_is_mine=message.sender_id == user.id,
            )
        )
    threads.sort(key=lambda t: t.last_message_at, reverse=True)
    return threads


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


@router.get("/direct/{other_user_id}/messages", response_model=list[DirectChatMessageRead])
async def direct_messages(
    other_user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await can_message_user(db, user, other_user_id):
        raise HTTPException(status_code=403, detail="Нет доступа к переписке с этим пользователем")
    result = await db.execute(
        select(DirectChatMessage).where(
            or_(
                (DirectChatMessage.sender_id == user.id) & (DirectChatMessage.recipient_id == other_user_id),
                (DirectChatMessage.sender_id == other_user_id) & (DirectChatMessage.recipient_id == user.id),
            )
        ).order_by(DirectChatMessage.created_at)
    )
    messages = result.scalars().all()
    out = []
    for m in messages:
        mr = DirectChatMessageRead.model_validate(m)
        sender = await db.get(User, m.sender_id)
        if sender:
            mr.sender_name = sender.full_name
        out.append(mr)
    return out


@router.post("/direct/{other_user_id}/messages", response_model=MessageResponse)
async def send_direct_message(
    other_user_id: int,
    data: ChatMessageCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    other = await db.get(User, other_user_id)
    if not other:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if not await can_message_user(db, user, other_user_id):
        raise HTTPException(status_code=403, detail="Нет доступа к переписке с этим пользователем")
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
    msg = DirectChatMessage(sender_id=user.id, recipient_id=other_user_id, text=ai_result.text)
    db.add(msg)
    await log_user_action(
        db, user.id, UserActionType.CHAT_MESSAGE, EntityType.CHAT_MESSAGE, other_user_id,
        details="direct chat", ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return MessageResponse(message="Сообщение отправлено", ai_corrected=ai_result.was_corrected)
