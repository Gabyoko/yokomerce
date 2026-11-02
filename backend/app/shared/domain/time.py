"""Fechas en America/Lima (SPEC.md). Todos los instantes se guardan con zona horaria."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

LIMA = ZoneInfo("America/Lima")

# Claves de Store.businessHours, empezando el lunes (date.weekday() == 0)
WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


def utc_now() -> datetime:
    return datetime.now(UTC)


def today_in_lima(now: datetime | None = None) -> date:
    return (now or utc_now()).astimezone(LIMA).date()


def weekday_key(day: date) -> str:
    """date(2026, 10, 31) → "sat"."""
    return WEEKDAYS[day.weekday()]


def add_days(day: date, days: int) -> date:
    return day + timedelta(days=days)
