"""API pública de iam: lo único que otros módulos pueden usar."""

from sqlalchemy import update
from sqlalchemy.orm import Session

from .dependencies import get_current_store, get_current_user
from .models import UserModel
from .service import CurrentUser

__all__ = ["CurrentUser", "get_current_store", "get_current_user", "rename_user"]


def rename_user(session: Session, user_id: str, name: str) -> None:
    """El nombre que la persona escribió al registrarse (aparece en el historial de stock)."""
    session.execute(update(UserModel).where(UserModel.id == user_id).values(name=name))
