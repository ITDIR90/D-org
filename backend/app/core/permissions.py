from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.models.group import Group
from app.models.user import User, UserGroupMembership, UserTaskTargetGroup


def is_request_only(user: User) -> bool:
    return user.role == UserRole.REQUEST_ONLY


async def get_creatable_group_ids(db: AsyncSession, user: User) -> set[int]:
    if user.role == UserRole.SUPERADMIN:
        result = await db.execute(select(Group.id).where(Group.is_active == True))
        return set(result.scalars().all())
    if is_request_only(user):
        return await get_user_task_target_group_ids(db, user.id)
    return await get_accessible_group_ids(db, user)


async def get_user_member_group_ids(db: AsyncSession, user_id: int) -> set[int]:
    result = await db.execute(
        select(UserGroupMembership.group_id).where(UserGroupMembership.user_id == user_id)
    )
    return set(result.scalars().all())


async def get_user_admin_group_ids(db: AsyncSession, user: User) -> set[int]:
    if user.role == UserRole.GROUP_ADMIN:
        return await get_user_member_group_ids(db, user.id)
    return set()


async def get_user_task_target_group_ids(db: AsyncSession, user_id: int) -> set[int]:
    result = await db.execute(
        select(UserTaskTargetGroup.group_id).where(UserTaskTargetGroup.user_id == user_id)
    )
    return set(result.scalars().all())


async def get_accessible_group_ids(db: AsyncSession, user: User) -> set[int]:
    if user.role == UserRole.SUPERADMIN:
        result = await db.execute(select(Group.id).where(Group.is_active == True))
        return set(result.scalars().all())
    member = await get_user_member_group_ids(db, user.id)
    admin = await get_user_admin_group_ids(db, user)
    return member | admin


async def can_create_task_in_group(db: AsyncSession, user: User, group_id: int) -> bool:
    if user.role == UserRole.SUPERADMIN:
        return True
    if is_request_only(user):
        targets = await get_user_task_target_group_ids(db, user.id)
        return group_id in targets
    member = await get_user_member_group_ids(db, user.id)
    if group_id in member:
        return True
    targets = await get_user_task_target_group_ids(db, user.id)
    return group_id in targets


async def is_group_admin(db: AsyncSession, user: User, group_id: int) -> bool:
    if user.role == UserRole.SUPERADMIN:
        return True
    admin_ids = await get_user_admin_group_ids(db, user)
    return group_id in admin_ids


def is_admin_user(user: User) -> bool:
    return user.role in (UserRole.SUPERADMIN, UserRole.GROUP_ADMIN)


async def can_archive_task(db: AsyncSession, user: User, task) -> bool:
    if user.role == UserRole.SUPERADMIN:
        return True
    if user.role == UserRole.GROUP_ADMIN:
        return await is_group_admin(db, user, task.target_group_id)
    return False


async def can_manage_group(db: AsyncSession, user: User, group_id: int) -> bool:
    return await is_group_admin(db, user, group_id)


async def can_view_task(db: AsyncSession, user: User, task) -> bool:
    if user.role == UserRole.SUPERADMIN:
        return True
    if is_request_only(user):
        return task.author_id == user.id
    accessible = await get_accessible_group_ids(db, user)
    if task.target_group_id in accessible:
        return True
    if task.author_id == user.id:
        return True
    targets = await get_user_task_target_group_ids(db, user.id)
    if task.target_group_id in targets and task.author_id == user.id:
        return True
    return False


async def can_view_group_chat(db: AsyncSession, user: User, group_id: int) -> bool:
    if is_request_only(user):
        return False
    if user.role == UserRole.SUPERADMIN:
        return True
    accessible = await get_accessible_group_ids(db, user)
    return group_id in accessible


async def can_message_user(db: AsyncSession, user: User, other_user_id: int) -> bool:
    if is_request_only(user):
        return False
    if user.id == other_user_id:
        return False
    other = await db.get(User, other_user_id)
    if not other or not other.is_active:
        return False
    if user.role == UserRole.SUPERADMIN:
        return True
    accessible = await get_accessible_group_ids(db, user)
    if not accessible:
        return False
    result = await db.execute(
        select(UserGroupMembership.group_id).where(
            UserGroupMembership.user_id == other_user_id,
            UserGroupMembership.group_id.in_(accessible),
        )
    )
    return result.first() is not None


async def can_create_project(db: AsyncSession, user: User, group_id: int) -> bool:
    if is_request_only(user):
        return False
    if user.role == UserRole.SUPERADMIN:
        return True
    return await is_group_admin(db, user, group_id)


async def can_manage_users(db: AsyncSession, user: User) -> bool:
    if user.role == UserRole.SUPERADMIN:
        return True
    if user.role == UserRole.GROUP_ADMIN:
        member = await get_user_member_group_ids(db, user.id)
        return len(member) > 0
    return False
