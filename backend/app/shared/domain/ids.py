"""Ids de texto con prefijo, como en el contrato: "or_3f2a…", "pr_…". El prefijo dice qué es."""

import secrets
import uuid


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


_TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"


def new_public_token(length: int = 20) -> str:
    """Token del link público del pedido: difícil de adivinar y sin caracteres confusos (l, o, 0, 1)."""
    return "".join(secrets.choice(_TOKEN_ALPHABET) for _ in range(length))
