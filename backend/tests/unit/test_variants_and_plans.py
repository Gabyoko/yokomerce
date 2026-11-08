from datetime import UTC, datetime, timedelta

from app.modules.catalog.domain.variants import combination_key, combinations
from app.modules.subscriptions import plans


def test_combinaciones_en_el_orden_de_las_opciones():
    assert combinations([["S", "M"], ["Negro", "Blanco"]]) == [
        ["S", "Negro"],
        ["S", "Blanco"],
        ["M", "Negro"],
        ["M", "Blanco"],
    ]
    assert combinations([]) == [[]]
    assert combination_key(["S", "NEGRO"]) == combination_key(["s", "negro"])


NOW = datetime(2026, 10, 31, 15, 0, tzinfo=UTC)


def _settings(monkeypatch, enforced: bool):
    class Settings:
        plans_enforced = enforced

    monkeypatch.setattr(plans, "get_settings", lambda: Settings)


def test_en_la_beta_todos_son_pro(monkeypatch):
    _settings(monkeypatch, False)
    assert plans.effective_plan("free", None, NOW) == "pro"
    assert plans.plan_of("free", None, NOW).max_products is None


def test_limites_de_cada_plan(monkeypatch):
    _settings(monkeypatch, True)
    assert plans.plan_of("free", None, NOW).max_products == 20
    assert plans.plan_of("free", None, NOW).stock_history is False
    assert plans.plan_of("pro", None, NOW).max_products is None


def test_pro_vencido_tiene_7_dias_de_gracia(monkeypatch):
    _settings(monkeypatch, True)
    expired = NOW - timedelta(days=6)
    assert plans.effective_plan("pro", expired, NOW) == "pro"
    assert plans.effective_plan("pro", NOW - timedelta(days=8), NOW) == "free"
