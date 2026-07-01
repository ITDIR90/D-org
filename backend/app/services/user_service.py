from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.core.enums import UiTheme, UserRole
from app.core.permissions import get_accessible_group_ids, get_user_admin_group_ids, get_user_member_group_ids, get_user_task_target_group_ids
from app.core.security import get_password_hash
from app.models.user import User, UserGroupMembership, UserTaskTargetGroup
from app.schemas.user import UserCreate, UserRead, UserUpdate


async def user_to_read(db: AsyncSession, user: User) -> UserRead:
    result = await db.execute(select(User).where(User.id == user.id))
    fresh = result.scalar_one()
    member = await get_user_member_group_ids(db, fresh.id)
    admin = await get_user_admin_group_ids(db, fresh)
    targets = await get_user_task_target_group_ids(db, fresh.id)
    data = UserRead.model_validate(fresh)
    data.member_group_ids = list(member)
    data.admin_group_ids = list(admin)
    data.task_target_group_ids = list(targets)
    data.full_name = fresh.full_name
    return data


async def sync_user_groups(
    db: AsyncSession,
    user: User,
    member_ids: list[int] | None = None,
    target_ids: list[int] | None = None,
) -> None:
    if member_ids is not None:
        await db.execute(
            UserGroupMembership.__table__.delete().where(UserGroupMembership.user_id == user.id)
        )
        for gid in member_ids:
            db.add(UserGroupMembership(user_id=user.id, group_id=gid))
    if target_ids is not None:
        await db.execute(
            UserTaskTargetGroup.__table__.delete().where(UserTaskTargetGroup.user_id == user.id)
        )
        for gid in target_ids:
            db.add(UserTaskTargetGroup(user_id=user.id, group_id=gid))


def resolve_role_groups(
    role: UserRole,
    member_ids: list[int] | None,
    target_ids: list[int] | None,
) -> tuple[list[int], list[int]]:
    if role == UserRole.REQUEST_ONLY:
        targets = list(target_ids or [])
        if not targets:
            raise HTTPException(
                status_code=400,
                detail="Для роли «Только оформление заявок» укажите группы для заявок",
            )
        return [], targets
    return list(member_ids or []), list(target_ids or [])


async def create_user_record(db: AsyncSession, data: UserCreate) -> User:
    user = User(
        last_name=data.last_name,
        first_name=data.first_name,
        middle_name=data.middle_name,
        nickname=data.nickname,
        timezone=data.timezone,
        ui_theme=UiTheme(data.ui_theme),
        email=data.email,
        notify_via_email=data.notify_via_email,
        notify_via_telegram=data.notify_via_telegram,
        telegram_chat_id=data.telegram_chat_id,
        password_hash=get_password_hash(data.password),
        role=data.role,
    )
    db.add(user)
    await db.flush()
    member_ids, target_ids = resolve_role_groups(
        data.role, data.member_group_ids, data.task_target_group_ids
    )
    await sync_user_groups(db, user, member_ids, target_ids)
    return user


async def list_chat_contacts(db: AsyncSession, actor: User) -> list[User]:
    if actor.role == UserRole.SUPERADMIN:
        result = await db.execute(
            select(User)
            .where(User.is_active == True, User.id != actor.id)
            .order_by(User.last_name, User.first_name)
        )
        return list(result.scalars().all())

    group_ids = await get_accessible_group_ids(db, actor)
    if not group_ids:
        return []

    result = await db.execute(
        select(User)
        .join(UserGroupMembership, UserGroupMembership.user_id == User.id)
        .where(
            UserGroupMembership.group_id.in_(group_ids),
            User.is_active == True,
            User.id != actor.id,
        )
        .distinct()
        .order_by(User.last_name, User.first_name)
    )
    return list(result.scalars().all())


async def list_users_for_actor(db: AsyncSession, actor: User) -> list[User]:
    if actor.role == UserRole.SUPERADMIN:
        result = await db.execute(select(User).order_by(User.id))
        return list(result.scalars().all())
    admin_groups = await get_user_admin_group_ids(db, actor)
    if not admin_groups:
        return [actor]
    result = await db.execute(
        select(User)
        .join(UserGroupMembership, UserGroupMembership.user_id == User.id)
        .where(UserGroupMembership.group_id.in_(admin_groups))
        .distinct()
    )
    users = list(result.scalars().all())
    if actor not in users:
        users.append(actor)
    return users
