"""Combinaciones de opciones de un producto. Python puro."""

from itertools import product


def combinations(values_per_option: list[list[str]]) -> list[list[str]]:
    """[["S", "M"], ["Negro"]] → [["S", "Negro"], ["M", "Negro"]]. Sin opciones → [[]]: la variante por defecto."""
    return [list(combo) for combo in product(*values_per_option)]


def combination_key(values: list[str]) -> str:
    """Identifica una combinación sin distinguir mayúsculas."""
    return "\u0000".join(value.lower() for value in values)
