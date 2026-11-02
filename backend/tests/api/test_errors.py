"""Todos los errores salen como { error, message } con el código HTTP de SPEC.md, sección 5."""

from pydantic import BaseModel

from app.shared.errors import Conflict, InvalidTransition, LimitReached, NotFound, OutOfStock, ValidationFailed
from app.shared.schemas import CamelModel


class Customer(CamelModel):
    full_name: str
    phone: str


class OrderIn(BaseModel):
    customer: Customer
    quantity: int


def add_routes(app):
    @app.get("/prueba/no-existe")
    def not_found():
        raise NotFound("No encontramos este pedido.")

    @app.post("/prueba/transicion")
    def transition():
        raise InvalidTransition("Este pedido ya fue entregado.")

    @app.post("/prueba/stock")
    def stock():
        raise OutOfStock("No alcanza el stock.", items=[{"variantId": "va_1", "available": 0}])

    @app.post("/prueba/conflicto")
    def conflict():
        raise Conflict("Tiene unidades reservadas.", code="variant_reserved")

    @app.post("/prueba/plan")
    def plan():
        raise LimitReached("Tu plan permite hasta 20 productos.")

    @app.post("/prueba/validacion")
    def validation():
        raise ValidationFailed("Revisa los datos del pedido.", fields={"customer.phone": "Celular inválido."})

    @app.post("/prueba/entrada")
    def body(order: OrderIn):
        return {"ok": True}

    @app.get("/prueba/explota")
    def boom():
        raise RuntimeError("algo interno")


def test_errores_de_dominio(app, client):
    add_routes(app)
    cases = [
        ("get", "/prueba/no-existe", 404, "not_found"),
        ("post", "/prueba/transicion", 409, "invalid_status"),
        ("post", "/prueba/stock", 409, "out_of_stock"),
        ("post", "/prueba/conflicto", 409, "variant_reserved"),
        ("post", "/prueba/plan", 403, "plan_limit"),
        ("post", "/prueba/validacion", 400, "validation"),
    ]
    for method, path, status, code in cases:
        response = getattr(client, method)(path)
        assert response.status_code == status, path
        body = response.json()
        assert body["error"] == code
        assert isinstance(body["message"], str) and body["message"]


def test_datos_extra_del_error(app, client):
    add_routes(app)
    assert client.post("/prueba/stock").json()["items"] == [{"variantId": "va_1", "available": 0}]
    assert client.post("/prueba/validacion").json()["fields"] == {"customer.phone": "Celular inválido."}


def test_validacion_de_entrada_con_claves_camel_case(app, client):
    add_routes(app)
    response = client.post("/prueba/entrada", json={"customer": {"fullName": "Ana"}, "quantity": "muchos"})
    assert response.status_code == 400
    body = response.json()
    assert body["error"] == "validation"
    assert set(body["fields"]) == {"customer.phone", "quantity"}


def test_ruta_inexistente_y_error_inesperado(app, client):
    add_routes(app)
    missing = client.get("/no-hay-nada")
    assert missing.status_code == 404
    assert missing.json() == {"error": "not_found", "message": "No encontramos lo que buscas."}
    boom = client.get("/prueba/explota")
    assert boom.status_code == 500
    assert boom.json()["error"] == "internal"


def test_camel_model_acepta_ambos_nombres():
    customer = Customer(full_name="Ana", phone="987654321")
    assert customer.model_dump(by_alias=True) == {"fullName": "Ana", "phone": "987654321"}
    assert Customer.model_validate({"fullName": "Ana", "phone": "1"}).full_name == "Ana"
