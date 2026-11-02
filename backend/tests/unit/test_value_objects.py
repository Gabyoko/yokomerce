from datetime import UTC, date, datetime

import pytest

from app.shared.domain.money import Money
from app.shared.domain.phone import PhoneNumber
from app.shared.domain.slug import Slug
from app.shared.domain.time import today_in_lima, weekday_key


def test_money():
    assert Money(4500) + Money(800) == Money(5300)
    assert Money(4500).times(2) == Money(9000)
    assert Money.sum([]) == Money.zero()
    assert str(Money(124000)) == "S/ 1,240.00"
    assert str(Money(5)) == "S/ 0.05"
    with pytest.raises(ValueError):
        Money(-1)
    with pytest.raises(TypeError):
        Money(45.5)  # type: ignore[arg-type]


@pytest.mark.parametrize("raw", ["987654321", "987 654 321", "+51 987-654-321", "51987654321", "(987) 654.321"])
def test_celulares_validos(raw):
    phone = PhoneNumber.parse(raw)
    assert phone is not None
    assert phone.digits == "987654321"
    assert phone.whatsapp == "51987654321"
    assert str(phone) == "987 654 321"


@pytest.mark.parametrize("raw", ["", "87654321", "887654321", "9876543210", "98765432a", "+52 987654321"])
def test_celulares_invalidos(raw):
    assert PhoneNumber.parse(raw) is None


def test_slug():
    assert Slug.parse(" Dulces-de-Ana ") == Slug("dulces-de-ana")
    for bad in ["ab", "-ana", "ana-", "a--b", "panel", "dulces de ana", "x" * 31]:
        assert Slug.parse(bad) is None, bad


def test_fechas_en_lima():
    # 11 p. m. del viernes en Lima ya es sábado en UTC
    assert today_in_lima(datetime(2026, 10, 31, 4, 0, tzinfo=UTC)) == date(2026, 10, 30)
    assert weekday_key(date(2026, 10, 31)) == "sat"
