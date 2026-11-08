"""Lógica de iam (módulo simple): encontrar o crear el usuario de un token válido."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.shared.domain.ids import new_id
from app.shared.errors import Conflict

from .models import UserModel
from .tokens import TokenClaims

NAME_MAX = 60


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    name: str


def _to_user(row: UserModel) -> CurrentUser:
    return CurrentUser(id=row.id, email=row.email, name=row.name)


def get_or_create_user(session: Session, claims: TokenClaims) -> CurrentUser:
    """
    El usuario se identifica por el `sub` del token, nunca por el correo: así nadie entra a una cuenta
    ajena solo por registrar el mismo correo. La primera vez que alguien entra se crea su fila.
    """
    by_subject = select(UserModel).where(UserModel.auth_subject == claims.subject)
    row = session.scalar(by_subject)
    if row is not None:
        return _to_user(row)

    # ON CONFLICT: dos peticiones a la vez en el primer ingreso no chocan; una crea la fila y la otra la lee
    session.execute(
        insert(UserModel)
        .values(
            id=new_id("us"),
            auth_subject=claims.subject,
            email=claims.email,
            name=claims.email.split("@")[0][:NAME_MAX],
        )
        .on_conflict_do_nothing()
    )
    session.commit()
    row = session.scalar(by_subject)
    if row is None:
        # No se insertó y el `sub` no existe: otra cuenta ya usa este correo
        raise Conflict("Este correo ya está en uso en otra cuenta.", code="email_in_use")
    return _to_user(row)
