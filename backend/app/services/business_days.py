"""Business-day helpers: skip Saturday and Sunday when computing due dates."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

DEFAULT_TZ = ZoneInfo("Europe/Moscow")


def is_weekend(d: date) -> bool:
    return d.weekday() >= 5


def is_non_working_day(d: date) -> bool:
    return is_weekend(d)


def add_business_days(start: datetime, days: int, tz: ZoneInfo = DEFAULT_TZ) -> datetime:
    """Add `days` business days to `start`, preserving local time. Skips Sat/Sun."""
    if days <= 0:
        return start
    local = start.astimezone(tz)
    current = local.date()
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if not is_non_working_day(current):
            remaining -= 1
    result_local = datetime(
        current.year,
        current.month,
        current.day,
        local.hour,
        local.minute,
        local.second,
        local.microsecond,
        tzinfo=tz,
    )
    return result_local.astimezone(timezone.utc)


def compute_default_due_at(now: datetime, due_days: int, tz: ZoneInfo = DEFAULT_TZ) -> datetime:
    return add_business_days(now, due_days, tz)
