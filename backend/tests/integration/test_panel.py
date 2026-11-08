"""Endpoints del panel contra la base real con los datos de prueba (SPEC.md, secciones 5 y 7)."""

import copy
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import text

from app.config import DEV_ISSUER, get_settings
from app.modules.ordering.public import expire_due_orders
from app.modules.subscriptions import plans
from app.shared.db import unit_of_work
from tests.integration.test_public_api import order_body, phone

DA, TN = "dulcesdeana", "tallernorte"
ALFAJORES = "va_da_alfajores-x12"
MEDIANA = "va_da_torta-chocolate_mediana"
GRANDE = "va_da_torta-chocolate_grande"
POLO_L = "va_tn_polo-oversize_negro_l"


def token(slug: str = DA, email: str | None = None) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": f"dev|{slug}",
        "email": email or f"{slug}@yokomerce.test",
        "aud": "authenticated",
        "iss": DEV_ISSUER,
        "exp": now + timedelta(hours=1),
    }
    return jwt.encode(claims, get_settings().auth_dev_secret, algorithm="HS256")


def auth(slug: str = DA) -> dict[str, str]:
    return {"Authorization": f"Bearer {token(slug)}"}


def stock(client, variant_id: str, slug: str = DA) -> tuple[int, int]:
    for product in client.get("/me/products", headers=auth(slug)).json():
        for variant in product["variants"]:
            if variant["id"] == variant_id:
                return variant["onHand"], variant["reserved"]
    raise AssertionError(f"no existe {variant_id}")


def new_order(client, **overrides) -> dict:
    """Crea un pedido público y lo devuelve como lo ve el dueño (con su id)."""
    created = client.post("/public/orders", json=order_body(**overrides)).json()["order"]
    orders = client.get("/me/orders", headers=auth()).json()
    return next(o for o in orders if o["publicToken"] == created["publicToken"])


def set_reservation_over(engine, order_id: str) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("update orders set reserved_until = now() - interval '1 minute' where id = :o"), {"o": order_id}
        )


# --- Tienda ---

REGISTER = {
    "ownerName": "Rosa Quispe",
    "name": "Panadería Rosa",
    "slug": "panaderia-rosa",
    "whatsapp": "987 654 321",
    "city": "Lima",
    "answers": {"deliveryDate": True, "madeToOrder": True, "shipping": False},
}


def test_registro_crea_la_tienda_y_queda_como_duenia(client, fresh):
    headers = auth("rosa")
    assert client.get("/me/store", headers=headers).json()["error"] == "no_store"

    response = client.post("/me/store", json=REGISTER, headers=headers)
    assert response.status_code == 201, response.json()
    store = response.json()
    assert store["slug"] == "panaderia-rosa" and store["whatsapp"] == "51987654321"
    assert store["plan"] == "free" and store["planExpiresAt"] is None
    features = store["features"]
    assert (features["deliveryDate"], features["madeToOrder"], features["leadTimeDays"], features["shipping"]) == (
        True,
        True,
        1,
        False,
    )
    assert features["pickup"] is True and store["businessHours"]["sun"] is None

    assert client.get("/me/store", headers=headers).json()["id"] == store["id"]
    assert client.get("/public/stores/panaderia-rosa").status_code == 200
    assert client.get("/public/slugs/panaderia-rosa").json() == {"available": False}
    # El nombre del registro aparece en el historial
    with fresh.connect() as connection:
        assert (
            connection.execute(text("select name from users where auth_subject = 'dev|rosa'")).scalar_one()
            == "Rosa Quispe"
        )


def test_registro_valida_y_no_permite_dos_tiendas(client, fresh):
    headers = auth("rosa")
    bad = client.post(
        "/me/store",
        json={**REGISTER, "ownerName": "", "name": "x", "slug": DA, "whatsapp": "123", "city": ""},
        headers=headers,
    )
    assert bad.status_code == 400
    assert set(bad.json()["fields"]) == {"ownerName", "name", "slug", "whatsapp", "city"}
    assert client.post("/me/store", json=[1], headers=headers).status_code == 400

    assert client.post("/me/store", json=REGISTER, headers=headers).status_code == 201
    again = client.post("/me/store", json={**REGISTER, "slug": "otra-tienda"}, headers=headers)
    assert again.status_code == 409 and again.json()["error"] == "store_exists"


def test_editar_tienda_cambia_solo_lo_que_viene(client, fresh):
    before = client.get("/me/store", headers=auth()).json()
    response = client.patch(
        "/me/store",
        json={"name": " Dulces de Ana Torres ", "whatsapp": "987654321", "features": {"pickup": False}},
        headers=auth(),
    )
    assert response.status_code == 200, response.json()
    after = response.json()
    assert after["name"] == "Dulces de Ana Torres" and after["whatsapp"] == "51987654321"
    assert after["features"]["pickup"] is False
    assert after["features"]["deliveryDate"] == before["features"]["deliveryDate"]
    assert after["city"] == before["city"]
    # Apagar una función la quita de la tienda: la API rechaza pedidos con recojo
    assert "Recojo" not in str(client.get(f"/public/stores/{DA}").json()["store"]["features"])
    body = order_body(fulfillment={"type": "pickup"})
    assert "fulfillment.type" in client.post("/public/orders", json=body).json()["fields"]


@pytest.mark.parametrize(
    ("patch", "field"),
    [
        ({"slug": "otro-link"}, "slug"),
        ({"name": "x"}, "name"),
        ({"whatsapp": "123"}, "whatsapp"),
        ({"paymentMethods": []}, "paymentMethods"),
        ({"paymentMethods": ["bitcoin"]}, "paymentMethods"),
        ({"reservationHours": 0}, "reservationHours"),
        ({"shippingFeeCents": -1}, "shippingFeeCents"),
        ({"businessHours": {"mon": {"open": "20:00", "close": "09:00"}}}, "businessHours.mon"),
        ({"features": {"deliveryZones": False, "pickup": False, "shipping": False}}, "features"),
        ({"features": {"leadTimeDays": 31}}, "features.leadTimeDays"),
    ],
)
def test_editar_tienda_rechaza_datos_invalidos(client, fresh, patch, field):
    before = client.get("/me/store", headers=auth()).json()
    response = client.patch("/me/store", json=patch, headers=auth())
    assert response.status_code == 400
    assert field in response.json()["fields"]
    assert client.get("/me/store", headers=auth()).json() == before


def test_zonas_lista_completa(client, fresh):
    zones = client.get("/me/zones", headers=auth()).json()
    assert [z["name"] for z in zones] == ["Santiago de Surco", "Miraflores", "Barranco"]
    keep = {**zones[0], "priceCents": 900, "active": False}
    response = client.put(
        "/me/zones", json=[{"name": "La Molina", "priceCents": 1500, "active": True}, keep], headers=auth()
    )
    assert response.status_code == 200, response.json()
    result = response.json()
    assert [z["name"] for z in result] == ["La Molina", "Santiago de Surco"]
    assert result[1]["id"] == zones[0]["id"] and result[1]["priceCents"] == 900
    # El catálogo solo muestra las activas
    assert [z["name"] for z in client.get(f"/public/stores/{DA}").json()["deliveryZones"]] == ["La Molina"]


def test_zonas_invalidas(client, fresh):
    zone = client.get("/me/zones", headers=auth()).json()[0]
    bad = [
        {"name": "", "priceCents": -1, "active": "si"},
        {"id": "zn_de_otra_tienda", "name": "A", "priceCents": 1, "active": True},
        {**zone},
        {**zone, "name": "B"},
    ]
    fields = client.put("/me/zones", json=bad, headers=auth()).json()["fields"]
    assert {"0.name", "0.priceCents", "0.active", "1.id", "3.id"} == set(fields)


# --- Categorías y productos ---


def test_categorias(client, fresh):
    categories = client.get("/me/categories", headers=auth()).json()
    tortas = next(c for c in categories if c["name"] == "Tortas")
    response = client.put(
        "/me/categories", json=[{"name": "Nuevas"}, {"id": tortas["id"], "name": "Tortas grandes"}], headers=auth()
    )
    assert [(c["name"], c["position"]) for c in response.json()] == [("Nuevas", 0), ("Tortas grandes", 1)]
    # Los productos de una categoría borrada quedan sin categoría
    products = client.get("/me/products", headers=auth()).json()
    assert next(p for p in products if p["id"] == "pr_da_alfajores-x12")["categoryId"] is None
    assert next(p for p in products if p["id"] == "pr_da_torta-chocolate")["categoryId"] == tortas["id"]

    dup = client.put(
        "/me/categories", json=[{"name": "A"}, {"name": "a"}, {"id": "ct_ajena", "name": "B"}], headers=auth()
    )
    assert set(dup.json()["fields"]) == {"1.name", "2.id"}


def polo(**overrides) -> dict:
    tallas, colores = ["S", "M", "L"], ["Negro", "Blanco"]
    body = {
        "categoryId": None,
        "name": "Polo nuevo",
        "description": "De algodón",
        "images": ["https://cdn.test/1.webp"],
        "madeToOrder": False,
        "sizeGuideUrl": None,
        "visible": True,
        "options": [
            {"name": "Talla", "values": [{"value": v} for v in tallas]},
            {"name": "Color", "values": [{"value": v} for v in colores]},
        ],
        "variants": [
            {
                "optionValues": [t, c],
                "priceCents": 4500,
                "active": True,
                "lowStockThreshold": 2,
                "initialStock": i * 2 + j + 1,
            }
            for i, t in enumerate(tallas)
            for j, c in enumerate(colores)
        ],
        "customFields": [{"label": "Nombre", "required": False, "maxLength": 20}],
    }
    body.update(overrides)
    return body


def edit_body(product: dict) -> dict:
    """Lo que manda el formulario al editar: los mismos datos con sus ids (copia: no toca `product`)."""
    product = copy.deepcopy(product)
    return {
        "categoryId": product["categoryId"],
        "name": product["name"],
        "description": product["description"],
        "images": product["images"],
        "madeToOrder": product["madeToOrder"],
        "sizeGuideUrl": product["sizeGuideUrl"],
        "visible": product["visible"],
        "options": product["options"],
        "variants": [
            {
                "id": v["id"],
                "optionValues": v["label"].split(" / ") if v["label"] else [],
                "priceCents": v["priceCents"],
                "active": v["active"],
                "lowStockThreshold": v["lowStockThreshold"],
            }
            for v in product["variants"]
        ],
        "customFields": product["customFields"],
    }


def test_crear_producto_3_tallas_por_2_colores(client, fresh):
    response = client.post("/me/products", json=polo(), headers=auth(TN))
    assert response.status_code == 201, response.json()
    product = response.json()
    assert [v["label"] for v in product["variants"]][:2] == ["S / Negro", "S / Blanco"]
    assert [v["onHand"] for v in product["variants"]] == [1, 2, 3, 4, 5, 6]
    assert product["variants"][0]["lowStock"] is True and product["variants"][5]["lowStock"] is False
    assert product["priceFromCents"] == 4500 and product["images"] == ["https://cdn.test/1.webp"]
    # Las combinaciones apuntan a los valores correctos
    negro = product["options"][1]["values"][0]["id"]
    assert negro in product["variants"][0]["optionValueIds"]
    # El stock inicial queda en el historial
    moves = client.get(f"/me/variants/{product['variants'][5]['id']}/movements", headers=auth(TN)).json()
    assert [(m["type"], m["quantity"], m["reason"], m["createdBy"]) for m in moves] == [
        ("in", 6, "stock_inicial", "Kevin Huamán")
    ]
    # Se ve en la tienda, sin datos internos
    public = client.get(f"/public/stores/{TN}/products/{product['id']}").json()
    assert public["variants"][5]["available"] == 6 and "onHand" not in public["variants"][5]


def test_editar_conserva_ids_y_stock(client, fresh):
    product = client.post("/me/products", json=polo(), headers=auth(TN)).json()
    body = edit_body(product)
    body["name"] = "Polo editado"
    body["options"][0]["values"].append({"value": "XL"})
    body["variants"][0]["priceCents"] = 5000
    body["variants"] += [
        {"optionValues": ["XL", c], "priceCents": 4900, "active": True, "lowStockThreshold": 2, "initialStock": 4}
        for c in ["Negro", "Blanco"]
    ]
    # Intentar cambiar el stock de una variante existente no tiene efecto
    body["variants"][1]["initialStock"] = 999
    response = client.put(f"/me/products/{product['id']}", json=body, headers=auth(TN))
    assert response.status_code == 200, response.json()
    edited = response.json()
    assert edited["name"] == "Polo editado" and len(edited["variants"]) == 8
    before = {v["id"]: v["onHand"] for v in product["variants"]}
    after = {v["id"]: v["onHand"] for v in edited["variants"]}
    assert all(after[k] == v for k, v in before.items())
    assert edited["variants"][0]["priceCents"] == 5000 and edited["priceFromCents"] == 4500
    assert edited["options"][0]["id"] == product["options"][0]["id"]
    assert edited["options"][0]["values"][0]["id"] == product["options"][0]["values"][0]["id"]
    assert edited["customFields"][0]["id"] == product["customFields"][0]["id"]
    assert [v["onHand"] for v in edited["variants"][-2:]] == [4, 4]
    # Editar dos veces con los mismos datos no cambia nada
    again = client.put(f"/me/products/{product['id']}", json=edit_body(edited), headers=auth(TN)).json()
    assert again == edited


def test_quitar_variante_y_opcion(client, fresh):
    product = client.post("/me/products", json=polo(), headers=auth(TN)).json()
    body = edit_body(product)
    body["options"][0]["values"] = body["options"][0]["values"][:1]
    body["variants"] = body["variants"][:2]
    body["customFields"] = []
    edited = client.put(f"/me/products/{product['id']}", json=body, headers=auth(TN)).json()
    assert [v["label"] for v in edited["variants"]] == ["S / Negro", "S / Blanco"]
    assert len(edited["options"][0]["values"]) == 1 and edited["customFields"] == []
    # Sin opciones: una sola variante por defecto
    plain = polo(options=[], customFields=[])
    plain["variants"] = [{"optionValues": [], "priceCents": 100, "active": True, "lowStockThreshold": None}]
    edited = client.put(f"/me/products/{product['id']}", json=plain, headers=auth(TN)).json()
    assert [v["label"] for v in edited["variants"]] == [""] and edited["options"] == []


def test_no_se_quita_una_variante_con_reservas(client, fresh):
    new_order(client, items=[{"variantId": MEDIANA, "quantity": 1, "customValues": {}}])
    product = client.get("/me/products/pr_da_torta-chocolate", headers=auth()).json()
    body = edit_body(product)
    body["options"][0]["values"] = [v for v in body["options"][0]["values"] if v["value"] != "Mediana"]
    body["variants"] = [v for v in body["variants"] if v["id"] != MEDIANA]
    response = client.put("/me/products/pr_da_torta-chocolate", json=body, headers=auth())
    assert response.status_code == 409 and response.json()["error"] == "variant_reserved"
    # No quedó nada a medias
    assert client.get("/me/products/pr_da_torta-chocolate", headers=auth()).json() == product


@pytest.mark.parametrize(
    ("change", "field"),
    [
        ({"name": "x"}, "name"),
        ({"images": ["a"] * 6}, "images"),
        ({"categoryId": "ct_tn_polos"}, "categoryId"),
        ({"madeToOrder": True}, "madeToOrder"),
        ({"options": [{"name": "Talla", "values": []}], "variants": []}, "options.0.values"),
        ({"variants": []}, "variants"),
        ({"customFields": [{"label": "", "required": False, "maxLength": 0}]}, "customFields.0.label"),
    ],
)
def test_producto_invalido(client, fresh, change, field):
    # Funda Lab no tiene encargos; la categoría es de otra tienda
    response = client.post("/me/products", json=polo(**change), headers=auth("fundalab"))
    assert response.status_code == 400
    assert field in response.json()["fields"]


def test_guia_de_tallas_solo_con_la_funcion_activa(client, fresh):
    body = polo(sizeGuideUrl="https://cdn.test/guia.webp")
    assert "sizeGuideUrl" in client.post("/me/products", json=body, headers=auth(DA)).json()["fields"]
    assert client.post("/me/products", json=body, headers=auth(TN)).json()["sizeGuideUrl"] == body["sizeGuideUrl"]


def test_ocultar_producto(client, fresh):
    path = "/me/products/pr_da_alfajores-x12"
    assert client.patch(path, json={"visible": False}, headers=auth()).json()["visible"] is False
    assert client.get(f"/public/stores/{DA}/products/pr_da_alfajores-x12").status_code == 404
    assert any(p["id"] == "pr_da_alfajores-x12" for p in client.get("/me/products", headers=auth()).json())
    assert client.patch(path, json={"visible": "no"}, headers=auth()).status_code == 400


def test_limite_de_productos_del_plan(client, fresh, enforced, monkeypatch):
    monkeypatch.setitem(plans.PLANS, "free", plans.Plan(7, 1, False, True, False))
    response = client.post("/me/products", json=polo(), headers=auth(DA))
    assert response.status_code == 403 and response.json()["error"] == "plan_limit"
    # Taller Norte es Pro
    assert client.post("/me/products", json=polo(), headers=auth(TN)).status_code == 201


# --- Pedidos ---


def test_recorrido_completo_de_un_pedido(client, fresh):
    start = stock(client, ALFAJORES)
    order = new_order(client)
    assert order["status"] == "new" and order["notes"] is None and order["id"]
    assert stock(client, ALFAJORES) == (start[0], start[1] + 2)

    path = f"/me/orders/{order['id']}"
    paid = client.post(f"{path}/confirm-payment", headers=auth())
    assert paid.status_code == 200 and paid.json()["status"] == "paid" and paid.json()["paidAt"]
    assert stock(client, ALFAJORES) == (start[0] - 2, start[1])

    assert client.post(f"{path}/start-preparing", headers=auth()).json()["status"] == "preparing"
    delivered = client.post(f"{path}/deliver", headers=auth()).json()
    assert delivered["status"] == "delivered" and delivered["deliveredAt"]
    assert stock(client, ALFAJORES) == (start[0] - 2, start[1])

    moves = client.get(f"/me/variants/{ALFAJORES}/movements", headers=auth()).json()
    assert [(m["type"], m["quantity"], m["orderNumber"]) for m in moves[:2]] == [
        ("sale", -2, order["number"]),
        ("reserve", -2, order["number"]),
    ]
    assert moves[0]["createdBy"] == "Ana Torres" and moves[1]["createdBy"] is None


def test_transiciones_no_permitidas(client, fresh):
    order = new_order(client)
    path = f"/me/orders/{order['id']}"
    bad = client.post(f"{path}/deliver", headers=auth())
    assert bad.status_code == 409 and bad.json()["error"] == "invalid_status"
    assert "nuevo" in bad.json()["message"]
    assert client.post(f"{path}/cancel", headers=auth()).status_code == 200
    assert client.post(f"{path}/confirm-payment", headers=auth()).status_code == 409


def test_cancelar_nuevo_libera_y_cancelar_pagado_devuelve(client, fresh):
    start = stock(client, ALFAJORES)
    nuevo = new_order(client)
    client.post(f"/me/orders/{nuevo['id']}/cancel", headers=auth())
    assert stock(client, ALFAJORES) == start
    moves = client.get(f"/me/variants/{ALFAJORES}/movements", headers=auth()).json()
    assert (moves[0]["type"], moves[0]["quantity"], moves[0]["reason"]) == ("release", 2, "cancelacion")

    pagado = new_order(client)
    client.post(f"/me/orders/{pagado['id']}/confirm-payment", headers=auth())
    assert stock(client, ALFAJORES) == (start[0] - 2, start[1])
    assert client.post(f"/me/orders/{pagado['id']}/cancel", headers=auth()).json()["cancelledAt"]
    assert stock(client, ALFAJORES) == start
    moves = client.get(f"/me/variants/{ALFAJORES}/movements", headers=auth()).json()
    assert (moves[0]["type"], moves[0]["quantity"], moves[0]["reason"]) == ("in", 2, "cancelacion")


def test_cancelar_pagado_cuya_variante_se_borro(client, fresh):
    """Error real: el pedido no se podía cancelar si el dueño ya había borrado esa variante."""
    product = client.post("/me/products", json=polo(), headers=auth(TN)).json()
    variant = product["variants"][5]
    created = client.post(
        "/public/orders",
        json={
            "storeSlug": TN,
            "items": [{"variantId": variant["id"], "quantity": 1}],
            "customer": {"name": "Ana", "phone": phone()},
            "fulfillment": {"type": "shipping", "city": "Lima", "address": "Calle 1"},
            "paymentMethod": "yape",
        },
    ).json()["order"]
    order = next(
        o for o in client.get("/me/orders", headers=auth(TN)).json() if o["publicToken"] == created["publicToken"]
    )
    client.post(f"/me/orders/{order['id']}/confirm-payment", headers=auth(TN))
    plain = polo(options=[], customFields=[])
    plain["variants"] = [{"optionValues": [], "priceCents": 100, "active": True, "lowStockThreshold": None}]
    assert client.put(f"/me/products/{product['id']}", json=plain, headers=auth(TN)).status_code == 200
    response = client.post(f"/me/orders/{order['id']}/cancel", headers=auth(TN))
    assert response.status_code == 200 and response.json()["status"] == "cancelled"


def test_nota_interna_que_el_cliente_no_ve(client, fresh):
    order = new_order(client)
    path = f"/me/orders/{order['id']}"
    assert client.patch(path, json={"notes": "  Llamar antes  "}, headers=auth()).json()["notes"] == "Llamar antes"
    assert client.get(path, headers=auth()).json()["notes"] == "Llamar antes"
    assert "notes" not in client.get(f"/public/stores/{DA}/orders/{order['publicToken']}").json()
    assert client.patch(path, json={"notes": None}, headers=auth()).json()["notes"] is None
    assert client.patch(path, json={"notes": "x" * 501}, headers=auth()).status_code == 400
    assert client.patch(path, json={}, headers=auth()).status_code == 400


def test_lista_filtra_y_busca(client, fresh):
    order = new_order(client, customer={"name": "Mária Núñez", "phone": "912000111"})
    all_orders = client.get("/me/orders", headers=auth()).json()
    assert all_orders[0]["id"] == order["id"]
    dates = [o["createdAt"] for o in all_orders]
    assert dates == sorted(dates, reverse=True)

    def search(term: str) -> list[str]:
        return [o["id"] for o in client.get("/me/orders", params={"search": term}, headers=auth()).json()]

    assert search("maria nu") == [order["id"]]
    assert search("000111") == [order["id"]]
    assert order["id"] in search(f"#{order['number']:04d}")
    assert search("nadie-se-llama-asi") == []
    statuses = {o["status"] for o in client.get("/me/orders", params={"status": "new"}, headers=auth()).json()}
    assert statuses == {"new"}
    assert client.get("/me/orders", params={"status": "perdido"}, headers=auth()).status_code == 400


# --- Vencimiento ---


def test_tarea_de_vencimiento_libera_la_reserva(client, fresh):
    start = stock(client, ALFAJORES)
    vigente = new_order(client)
    vencido = new_order(client)
    set_reservation_over(fresh, vencido["id"])

    assert expire_due_orders(unit_of_work) == 1
    assert client.get(f"/me/orders/{vencido['id']}", headers=auth()).json()["status"] == "expired"
    assert client.get(f"/me/orders/{vigente['id']}", headers=auth()).json()["status"] == "new"
    assert stock(client, ALFAJORES) == (start[0], start[1] + 2)
    moves = client.get(f"/me/variants/{ALFAJORES}/movements", headers=auth()).json()
    assert (moves[0]["type"], moves[0]["createdBy"], moves[0]["orderNumber"]) == ("release", None, vencido["number"])
    # Otra pasada no hace nada
    assert expire_due_orders(unit_of_work) == 0


def test_una_reserva_pasada_no_se_puede_confirmar(client, fresh):
    """Entre dos pasadas de la tarea, un pedido ya vencido no debe poder pagarse."""
    start = stock(client, ALFAJORES)
    order = new_order(client)
    set_reservation_over(fresh, order["id"])
    response = client.post(f"/me/orders/{order['id']}/confirm-payment", headers=auth())
    assert response.status_code == 409 and "vencido" in response.json()["message"]
    assert client.get(f"/me/orders/{order['id']}", headers=auth()).json()["status"] == "expired"
    assert stock(client, ALFAJORES) == start


# --- Stock ---


def test_ajustes_de_stock(client, fresh):
    start = stock(client, ALFAJORES)
    path = f"/me/variants/{ALFAJORES}/adjustments"
    entrada = client.post(path, json={"type": "in", "quantity": 5, "reason": "produccion"}, headers=auth())
    assert entrada.status_code == 201, entrada.json()
    result = entrada.json()
    assert result["variant"]["onHand"] == start[0] + 5 and result["variant"]["available"] == start[0] + 5 - start[1]
    movement = result["movement"]
    assert (movement["type"], movement["quantity"], movement["reason"], movement["createdBy"]) == (
        "in",
        5,
        "produccion",
        "Ana Torres",
    )
    assert movement["createdAt"].endswith("Z") and "storeId" not in movement

    assert (
        client.post(path, json={"type": "out", "quantity": 2, "reason": "merma"}, headers=auth()).json()["movement"][
            "quantity"
        ]
        == -2
    )
    fixed = client.post(path, json={"type": "adjust", "quantity": 7, "reason": "correccion"}, headers=auth()).json()
    assert fixed["variant"]["onHand"] == 7 and fixed["movement"]["quantity"] == 7 - (start[0] + 3)


def test_ajustes_rechazados(client, fresh):
    new_order(client, items=[{"variantId": MEDIANA, "quantity": 2}])
    on_hand, reserved = stock(client, MEDIANA)
    path = f"/me/variants/{MEDIANA}/adjustments"

    too_many = client.post(path, json={"type": "out", "quantity": on_hand, "reason": "merma"}, headers=auth())
    assert too_many.status_code == 409 and too_many.json()["error"] == "stock_conflict"
    assert f"Solo puedes sacar {on_hand - reserved}" in too_many.json()["message"]
    below = client.post(path, json={"type": "adjust", "quantity": reserved - 1, "reason": "x"}, headers=auth())
    assert below.status_code == 409 and "reservadas" in below.json()["message"]
    assert stock(client, MEDIANA) == (on_hand, reserved)

    bad = client.post(path, json={"type": "otro", "quantity": 0, "reason": ""}, headers=auth())
    assert bad.status_code == 400 and set(bad.json()["fields"]) == {"type", "quantity", "reason"}
    encargo = client.post(
        "/me/variants/va_da_torta-tres-leches/adjustments",
        json={"type": "in", "quantity": 1, "reason": "x"},
        headers=auth(),
    )
    assert encargo.status_code == 409 and encargo.json()["error"] == "made_to_order"


def test_historial_es_de_pro(client, fresh, enforced):
    response = client.get(f"/me/variants/{ALFAJORES}/movements", headers=auth(DA))
    assert response.status_code == 403 and response.json()["error"] == "plan_required"
    assert client.get(f"/me/variants/{POLO_L}/movements", headers=auth(TN)).status_code == 200


def test_el_historial_suma_lo_mismo_que_el_stock_despues_de_operar(client, fresh):
    """SPEC.md, sección 13, con todo tipo de operaciones por la API."""
    order = new_order(client)
    client.post(f"/me/orders/{order['id']}/confirm-payment", headers=auth())
    cancelled = new_order(client)
    client.post(f"/me/orders/{cancelled['id']}/cancel", headers=auth())
    new_order(client)
    path = f"/me/variants/{ALFAJORES}/adjustments"
    client.post(path, json={"type": "in", "quantity": 3, "reason": "produccion"}, headers=auth())
    client.post(path, json={"type": "adjust", "quantity": 12, "reason": "correccion"}, headers=auth())

    moves = client.get(f"/me/variants/{ALFAJORES}/movements", headers=auth()).json()
    on_hand = sum(m["quantity"] for m in moves if m["type"] in ("in", "out", "sale", "adjust"))
    reserved = (
        -sum(m["quantity"] for m in moves if m["type"] == "reserve")
        - sum(m["quantity"] for m in moves if m["type"] == "release")
        + sum(m["quantity"] for m in moves if m["type"] == "sale")
    )
    assert (on_hand, reserved) == stock(client, ALFAJORES)


# --- Métricas ---


def test_metricas(client, fresh):
    before = client.get("/me/stats", headers=auth()).json()
    assert set(before) == {
        "ordersToday",
        "pendingConfirmation",
        "salesWeekCents",
        "ordersWeek",
        "averageTicketCents",
        "lowStockCount",
        "topProducts",
    }
    assert before["lowStockCount"] >= 1 and len(before["topProducts"]) <= 5
    order = new_order(client)
    mid = client.get("/me/stats", headers=auth()).json()
    assert mid["ordersToday"] == before["ordersToday"] + 1
    assert mid["pendingConfirmation"] == before["pendingConfirmation"] + 1
    assert mid["salesWeekCents"] == before["salesWeekCents"]
    client.post(f"/me/orders/{order['id']}/confirm-payment", headers=auth())
    after = client.get("/me/stats", headers=auth()).json()
    assert after["pendingConfirmation"] == before["pendingConfirmation"]
    assert after["salesWeekCents"] == before["salesWeekCents"] + order["totalCents"]
    assert after["ordersWeek"] == before["ordersWeek"] + 1
    assert after["averageTicketCents"] == round(after["salesWeekCents"] / after["ordersWeek"])
    # Cada tienda ve solo lo suyo
    assert client.get("/me/stats", headers=auth(TN)).json()["topProducts"] != after["topProducts"]


# --- Aislamiento: Taller Norte intenta tocar lo de Dulces de Ana ---


def test_un_duenio_no_puede_leer_ni_cambiar_datos_de_otra_tienda(client, fresh):
    order = new_order(client)
    order_path = f"/me/orders/{order['id']}"
    product_path = "/me/products/pr_da_alfajores-x12"
    variant_path = f"/me/variants/{ALFAJORES}"
    before = (
        client.get(order_path, headers=auth()).json(),
        client.get(product_path, headers=auth()).json(),
        client.get(f"{variant_path}/movements", headers=auth()).json(),
    )
    attempts = [
        ("get", order_path, None),
        ("patch", order_path, {"notes": "hackeado"}),
        ("post", f"{order_path}/confirm-payment", None),
        ("post", f"{order_path}/start-preparing", None),
        ("post", f"{order_path}/deliver", None),
        ("post", f"{order_path}/cancel", None),
        ("get", product_path, None),
        ("put", product_path, edit_body(before[1])),
        ("patch", product_path, {"visible": False}),
        ("post", f"{variant_path}/adjustments", {"type": "out", "quantity": 1, "reason": "x"}),
        ("get", f"{variant_path}/movements", None),
    ]
    for method, path, body in attempts:
        response = client.request(method, path, json=body, headers=auth(TN))
        assert response.status_code == 404, f"{method} {path}: {response.status_code}"
        assert response.json()["error"] == "not_found"

    # Las listas solo traen lo propio
    assert all(o["id"] != order["id"] for o in client.get("/me/orders", headers=auth(TN)).json())
    assert all(p["id"].startswith("pr_tn") for p in client.get("/me/products", headers=auth(TN)).json())
    assert all(c["id"].startswith("ct_tn") for c in client.get("/me/categories", headers=auth(TN)).json())
    assert all(z["id"].startswith("zn_tn") for z in client.get("/me/zones", headers=auth(TN)).json())

    # No se puede usar nada ajeno al guardar
    zone = client.get("/me/zones", headers=auth()).json()[0]
    assert "0.id" in client.put("/me/zones", json=[zone], headers=auth(TN)).json()["fields"]
    category = client.get("/me/categories", headers=auth()).json()[0]
    assert "0.id" in client.put("/me/categories", json=[category], headers=auth(TN)).json()["fields"]
    assert (
        "categoryId"
        in client.post("/me/products", json=polo(categoryId=category["id"]), headers=auth(TN)).json()["fields"]
    )

    # Y nada cambió
    assert before == (
        client.get(order_path, headers=auth()).json(),
        client.get(product_path, headers=auth()).json(),
        client.get(f"{variant_path}/movements", headers=auth()).json(),
    )
