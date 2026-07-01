from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_superadmin
from app.db.session import get_db
from app.models.logs import TaskChangeLog, UserActionLog
from app.models.user import User
from app.schemas.logs import TaskChangeLogRead, UserActionLogRead

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/task-changes", response_model=list[TaskChangeLogRead])
async def task_changes(
    entity_type: str | None = None,
    entity_id: int | None = None,
    user: User = Depends(get_superadmin),
    db: AsyncSession = Depends(get_db),
):
    q = select(TaskChangeLog).order_by(TaskChangeLog.changed_at.desc()).limit(500)
    if entity_type:
        q = q.where(TaskChangeLog.entity_type == entity_type)
    if entity_id:
        q = q.where(TaskChangeLog.entity_id == entity_id)
    result = await db.execute(q)
    logs = result.scalars().all()
    out = []
    for log in logs:
        lr = TaskChangeLogRead.model_validate(log)
        changer = await db.get(User, log.changed_by_id)
        if changer:
            lr.changed_by_name = changer.full_name
        out.append(lr)
    return out


@router.get("/user-actions", response_model=list[UserActionLogRead])
async def user_actions(user: User = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserActionLog).order_by(UserActionLog.created_at.desc()).limit(500))
    logs = result.scalars().all()
    out = []
    for log in logs:
        lr = UserActionLogRead.model_validate(log)
        if log.user_id:
            u = await db.get(User, log.user_id)
            if u:
                lr.user_name = u.full_name
        out.append(lr)
    return out


@router.delete("/user-actions")
async def clear_user_actions(user: User = Depends(get_superadmin), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(UserActionLog))
    return {"message": "Журнал действий очищен"}
