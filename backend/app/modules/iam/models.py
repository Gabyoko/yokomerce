"""Tablas de iam: usuarios (dueños y miembros de tiendas). El login real llega en B3."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.db import Base
from app.shared.models import IdColumn, TimestampMixin


class UserModel(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(IdColumn, primary_key=True)
    # El `sub` del token de sesión: identifica a la persona (el correo puede cambiar)
    auth_subject: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(60))
