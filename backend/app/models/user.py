from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import UiTheme, UserRole, pg_enum
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    nickname: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Europe/Moscow")
    ui_theme: Mapped[UiTheme] = mapped_column(pg_enum(UiTheme, "ui_theme"), default=UiTheme.LIGHT)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    notify_via_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_via_telegram: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_via_push: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_via_max: Mapped[bool] = mapped_column(Boolean, default=False)
    telegram_chat_id: Mapped[str | None] = mapped_column(String(50))
    max_user_id: Mapped[int | None] = mapped_column(BigInteger)
    printer: Mapped[str | None] = mapped_column(String(255))
    overdue_digest_sent_on: Mapped[date | None] = mapped_column(Date)
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, "user_role"), default=UserRole.USER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    member_groups: Mapped[list["UserGroupMembership"]] = relationship(back_populates="user")
    admin_groups: Mapped[list["UserGroupAdmin"]] = relationship(back_populates="user")
    task_target_groups: Mapped[list["UserTaskTargetGroup"]] = relationship(back_populates="user")

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        return " ".join(parts)


class UserGroupMembership(Base):
    __tablename__ = "user_group_memberships"
    __table_args__ = (UniqueConstraint("user_id", "group_id", name="uq_user_group_member"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))

    user: Mapped["User"] = relationship(back_populates="member_groups")
    group: Mapped["Group"] = relationship(back_populates="members")


class UserGroupAdmin(Base):
    __tablename__ = "user_group_admins"
    __table_args__ = (UniqueConstraint("user_id", "group_id", name="uq_user_group_admin"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))

    user: Mapped["User"] = relationship(back_populates="admin_groups")
    group: Mapped["Group"] = relationship(back_populates="admins")


class UserTaskTargetGroup(Base):
    __tablename__ = "user_task_target_groups"
    __table_args__ = (UniqueConstraint("user_id", "group_id", name="uq_user_task_target"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))

    user: Mapped["User"] = relationship(back_populates="task_target_groups")
    group: Mapped["Group"] = relationship(back_populates="task_target_users")
