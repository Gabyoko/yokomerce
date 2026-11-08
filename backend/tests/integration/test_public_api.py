"""Endpoints públicos contra la base real con los datos de prueba (SPEC.md, secciones 5 y 7)."""

import random
from datetime import date, timedelta

from sqlalchemy import text

from app.shared.domain.time import add_days, today_in_lima, weekday_key

DA = "dulcesdeana"


def phone() -> str:
    return "9" + "".join(random.choices("0123456789", k=8))


def first_delivery_date(lead_days: int = 1, closed: tuple[str, ...] = ("sun",)) -> str:
    day = add_days(today_in_lima(), lead_days)
    while weekday_key(day) in closed:
        day += timedelta(days=1)
    return day.isoformat()


def order_body(**overrides):
    body = {
        "storeSlug": DA,
        "items": [{"variantId": "va_da_alfajores-x12", "quantity": 2, "customValues": {}}],
        "customer": {"name": "María López", "phone": phone()},
        "fulfillment": {"type": "delivery", "zoneId": "zn_da_santiago-de-surco", "address": "Av. Primavera 123"},
        "deliveryDate": first_delivery_date(),
        "paymentMethod": "yape",
    }
    body.update(overrides)
    return body


def stock(engine, variant_id: str) -> tuple[int, int]:
    with engine.connect() as connection:
        row = connection.execute(
            text("select on_hand, reserved from stock_items where variant_id = :v"), {"v": variant_id}
        ).one()
    return row.on_hand, row.reserved


# --- Catálogo ---


def test_catalogo_en_camel_case_con_solo_lo_visible(client, seeded):
    response = client.get(f"/public/stores/{DA}")
    assert response.status_code == 200
    catalog = response.json()
    assert set(catalog) == {"store", "categories", "products", "deliveryZones"}
    store = catalog["store"]
    assert store["slug"] == DA and store["whatsapp"].startswith("51")
    assert {"planExpiresAt", "reservationHours", "shippingFeeCents", "businessHours"} <= set(store)
    assert store["features"]["leadTimeDays"] == 1
    assert [z["name"] for z in catalog["deliveryZones"]] == ["Santiago de Surco", "Miraflores", "Barranco"]
    product = next(p for p in catalog["products"] if p["id"] == "pr_da_torta-chocolate")
    assert product["priceFromCents"] == 4500
    assert {v["label"]: (v["available"], v["lowStock"]) for v in product["variants"]} == {
        "Mediana": (4, False),
        "Grande": (1, True),
    }
    # Datos internos del stock nunca salen al público
    assert "onHand" not in product["variants"][0] and "reserved" not in product["variants"][0]


def test_por_encargo_nunca_aparece_agotado(client, seeded):
    product = client.get(f"/public/stores/{DA}/products/pr_da_torta-tres-leches").json()
    assert product["madeToOrder"] is True
    assert product["variants"][0]["available"] == 99 and product["variants"][0]["lowStock"] is False


def test_funciones_apagadas_no_aparecen(client, seeded):
    # Funda Lab no usa delivery por zonas: no hay zonas aunque existan en la base
    assert client.get("/public/stores/fundalab").json()["deliveryZones"] == []


def test_no_existe_y_oculto(client, seeded):
    assert client.get("/public/stores/no-existe").json() == {"error": "not_found", "message": "Esta tienda no existe."}
    hidden = client.get("/public/stores/tallernorte/products/pr_tn_short-cargo")
    assert hidden.status_code == 404
    # Un producto de otra tienda tampoco existe en esta
    assert client.get(f"/public/stores/{DA}/products/pr_tn_polo-oversize").status_code == 404


def test_link_libre(client, seeded):
    assert client.get("/public/slugs/mi-tienda-nueva").json() == {"available": True}
    assert client.get(f"/public/slugs/{DA}").json() == {"available": False}
    assert client.get("/public/slugs/panel").json() == {"available": False}


# --- Crear pedido ---


def test_crear_pedido_reserva_y_calcula_desde_la_base(client, fresh):
    before = stock(fresh, "va_da_alfajores-x12")
    # El precio que mande el navegador se ignora: no es parte del input
    response = client.post("/public/orders", json=order_body())
    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["ok"] is True
    order = body["order"]
    assert order["number"] == 43
    assert order["status"] == "new"
    assert order["items"][0]["unitPriceCents"] == 1800 and order["items"][0]["lineTotalCents"] == 3600
    assert (order["subtotalCents"], order["deliveryFeeCents"], order["totalCents"]) == (3600, 800, 4400)
    assert order["fulfillment"]["zoneName"] == "Santiago de Surco"
    assert order["createdAt"].endswith("Z") and order["reservedUntil"].endswith("Z")
    assert "id" not in order and "notes" not in order
    # Reservado: el total no cambia, lo disponible baja
    assert stock(fresh, "va_da_alfajores-x12") == (before[0], before[1] + 2)

    # El link público devuelve el mismo pedido
    public = client.get(f"/public/stores/{DA}/orders/{order['publicToken']}")
    assert public.status_code == 200 and public.json() == order
    assert client.get(f"/public/stores/{DA}/orders/no-existe").status_code == 404


def test_errores_de_validacion_con_las_claves_del_input(client, fresh):
    body = order_body(
        customer={"name": "M", "phone": "123"},
        fulfillment={"type": "delivery", "zoneId": "zn_inexistente"},
        deliveryDate=date.today().isoformat(),
        paymentMethod="transfer",
        items=[
            {"variantId": "va_da_alfajores-x12", "quantity": 0},
            {"variantId": "va_tn_polo-oversize_negro_l", "quantity": 1},
            {"variantId": "va_da_torta-chocolate_mediana", "quantity": 1, "customValues": {"Dedicatoria": "x" * 31}},
        ],
    )
    response = client.post("/public/orders", json=body)
    assert response.status_code == 400
    result = response.json()
    assert result["ok"] is False and result["error"] == "validation" and result["message"]
    assert set(result["fields"]) == {
        "customer.name",
        "customer.phone",
        "fulfillment.zoneId",
        "fulfillment.address",
        "deliveryDate",
        "paymentMethod",
        "items.0.quantity",
        "items.1.variantId",
        "items.2.customValues.Dedicatoria",
    }


def test_funciones_apagadas_se_rechazan(client, fresh):
    # Taller Norte no usa fecha de entrega ni recojo
    body = order_body(
        storeSlug="tallernorte",
        items=[{"variantId": "va_tn_polo-oversize_negro_l", "quantity": 1}],
        fulfillment={"type": "pickup"},
        deliveryDate="2026-12-01",
    )
    fields = client.post("/public/orders", json=body).json()["fields"]
    assert set(fields) == {"fulfillment.type", "deliveryDate"}


def test_sin_stock_no_crea_nada(client, fresh):
    before_grande = stock(fresh, "va_da_torta-chocolate_grande")
    before_alfajor = stock(fresh, "va_da_alfajores-x12")
    body = order_body(
        items=[
            {"variantId": "va_da_alfajores-x12", "quantity": 1},
            {"variantId": "va_da_torta-chocolate_grande", "quantity": 2},
        ]
    )
    response = client.post("/public/orders", json=body)
    assert response.status_code == 409
    assert response.json() == {
        "ok": False,
        "error": "out_of_stock",
        "message": "Algunos productos ya no tienen stock suficiente.",
        "items": [{"variantId": "va_da_torta-chocolate_grande", "available": 1}],
    }
    # Se deshizo todo: ni la reserva de los alfajores ni el número de pedido
    assert stock(fresh, "va_da_torta-chocolate_grande") == before_grande
    assert stock(fresh, "va_da_alfajores-x12") == before_alfajor
    assert client.post("/public/orders", json=order_body()).json()["order"]["number"] == 43


def test_por_encargo_no_reserva(client, fresh):
    body = order_body(items=[{"variantId": "va_da_torta-tres-leches", "quantity": 3}])
    order = client.post("/public/orders", json=body).json()["order"]
    assert order["items"][0]["tracksStock"] is False
    assert stock(fresh, "va_da_torta-tres-leches") == (0, 0)


def test_limite_de_pedidos_por_celular(client, fresh):
    same = phone()
    for _ in range(5):
        body = order_body(customer={"name": "Ana", "phone": same})
        assert client.post("/public/orders", json=body).status_code == 201
    response = client.post("/public/orders", json=order_body(customer={"name": "Ana", "phone": same}))
    assert response.status_code == 429
    assert response.json()["error"] == "rate_limited" and response.json()["ok"] is False


def test_cuerpo_invalido(client, fresh):
    response = client.post("/public/orders", json=[1, 2])
    assert response.status_code == 400 and response.json()["fields"] == {"body": "El pedido no es válido."}
