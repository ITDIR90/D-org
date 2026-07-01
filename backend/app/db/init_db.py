import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import get_settings
from app.core.enums import (
    ScheduleType,
    TaskPriority,
    TaskStatus,
    UserRole,
)
from app.core.security import get_password_hash
from app.db.session import async_session
from app.models.app_setting import AppSetting
from app.models.category import Category
from app.models.group import Group
from app.models.request_template import RequestTemplate
from app.models.task import Task
from app.models.user import User, UserGroupMembership, UserTaskTargetGroup


async def seed() -> None:
    settings = get_settings()
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == settings.DEFAULT_SUPERADMIN_EMAIL))
        if result.scalar_one_or_none():
            print("Database already seeded")
            return

        superadmin = User(
            last_name="Системный",
            first_name="Администратор",
            nickname="superadmin",
            email=settings.DEFAULT_SUPERADMIN_EMAIL,
            password_hash=get_password_hash(settings.DEFAULT_SUPERADMIN_PASSWORD),
            role=UserRole.SUPERADMIN,
        )
        db.add(superadmin)
        await db.flush()

        db.add(AppSetting(
            key="ai_enabled",
            value="true" if settings.AI_ENABLED else "false",
        ))

        if settings.APP_ENV == "development":
            it_group = Group(name="ИТ-отдел", description="Отдел информационных технологий")
            sales_group = Group(name="Отдел продаж", description="Отдел продаж и маркетинга")
            db.add_all([it_group, sales_group])
            await db.flush()

            it_admin = User(
                last_name="Иванов",
                first_name="Иван",
                middle_name="Иванович",
                nickname="it_admin",
                email="it.admin@example.com",
                password_hash=get_password_hash("admin12345"),
                role=UserRole.GROUP_ADMIN,
            )
            sales_user = User(
                last_name="Петров",
                first_name="Пётр",
                middle_name="Петрович",
                nickname="sales_user",
                email="sales.user@example.com",
                password_hash=get_password_hash("user12345"),
                role=UserRole.USER,
            )
            db.add_all([it_admin, sales_user])
            await db.flush()

            request_user = User(
                last_name="Сидорова",
                first_name="Анна",
                middle_name="Сергеевна",
                nickname="request_user",
                email="request.user@example.com",
                password_hash=get_password_hash("request12345"),
                role=UserRole.REQUEST_ONLY,
            )
            db.add(request_user)
            await db.flush()

            db.add_all([
                UserGroupMembership(user_id=superadmin.id, group_id=it_group.id),
                UserGroupMembership(user_id=superadmin.id, group_id=sales_group.id),
                UserGroupMembership(user_id=it_admin.id, group_id=it_group.id),
                UserGroupMembership(user_id=sales_user.id, group_id=sales_group.id),
                UserTaskTargetGroup(user_id=sales_user.id, group_id=it_group.id),
                UserTaskTargetGroup(user_id=request_user.id, group_id=it_group.id),
            ])

            categories = [
                Category(group_id=it_group.id, name="Работа с сервером", default_due_days=3),
                Category(group_id=it_group.id, name="Заправка картриджей", default_due_days=1),
                Category(group_id=it_group.id, name="Работа с пользователями", default_due_days=2, requires_author_confirmation=True),
                Category(group_id=it_group.id, name="Ремонт оборудования", default_due_days=5),
                Category(group_id=sales_group.id, name="Обработка заявок", default_due_days=1),
                Category(group_id=sales_group.id, name="Подготовка КП", default_due_days=3),
            ]
            db.add_all(categories)
            await db.flush()

            now = datetime.now(timezone.utc)
            tasks = [
                Task(
                    title="Проверить резервное копирование сервера",
                    description="Убедиться, что бэкапы создаются ежедневно",
                    author_id=it_admin.id,
                    author_group_id=it_group.id,
                    target_group_id=it_group.id,
                    category_id=categories[0].id,
                    due_at=now + timedelta(days=2),
                    priority=TaskPriority.HIGH,
                    status=TaskStatus.NEW,
                ),
                Task(
                    title="Заправить картридж в принтере бухгалтерии",
                    author_id=it_admin.id,
                    author_group_id=it_group.id,
                    target_group_id=it_group.id,
                    category_id=categories[1].id,
                    due_at=now + timedelta(days=1),
                    assignee_id=it_admin.id,
                    priority=TaskPriority.MEDIUM,
                    status=TaskStatus.IN_PROGRESS,
                ),
                Task(
                    title="Настроить доступ новому сотруднику",
                    author_id=sales_user.id,
                    author_group_id=sales_group.id,
                    target_group_id=it_group.id,
                    category_id=categories[2].id,
                    due_at=now + timedelta(days=2),
                    priority=TaskPriority.FERRARI,
                    status=TaskStatus.NEW,
                ),
                Task(
                    title="Подготовить коммерческое предложение",
                    author_id=sales_user.id,
                    author_group_id=sales_group.id,
                    target_group_id=sales_group.id,
                    category_id=categories[5].id,
                    due_at=now - timedelta(days=1),
                    priority=TaskPriority.HIGH,
                    status=TaskStatus.NEW,
                ),
            ]
            db.add_all(tasks)

            refill_template = RequestTemplate(
                name="Заправка принтера",
                title="Заправить принтер",
                description="Укажите модель принтера и расположение",
                target_group_id=it_group.id,
                category_id=categories[1].id,
                priority=TaskPriority.MEDIUM,
                sort_order=1,
                created_by_id=it_admin.id,
            )
            db.add(refill_template)
            print("Development seed data created")

        await db.commit()
        print(f"Superadmin created: {settings.DEFAULT_SUPERADMIN_EMAIL}")


if __name__ == "__main__":
    asyncio.run(seed())
