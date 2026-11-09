"""Fotos (SPEC.md, sección 12) y límites de los planes en el servidor (sección 10)."""

import io
import subprocess
import sys

import httpx
import pytest
from sqlalchemy import text

from app.modules.catalog.images import MAX_BYTES, SupabaseStorage, detect_image, save_image
from tests.integration.test_panel import DA, TN, auth, new_order

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 64
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'


def upload(client, data: bytes, name: str = "foto.webp", content_type: str = "image/webp", slug: str = DA):
    return client.post("/me/uploads", files={"file": (name, data, content_type)}, headers=auth(slug))


def store_id(engine, slug: str) -> str:
    with engine.connect() as connection:
        return connection.execute(text("select id from stores where slug = :s"), {"s": slug}).scalar_one()


@pytest.mark.parametrize(("data", "extension"), [(PNG, "png"), (JPG, "jpg"), (WEBP, "webp")])
def test_sube_fotos_en_la_carpeta_de_su_tienda(client, fresh, data, extension):
    response = upload(client, data)
    assert response.status_code == 201, response.json()
    url = response.json()["url"]
    assert f"/uploads/stores/{store_id(fresh, DA)}/" in url and url.endswith(f".{extension}")
    # La foto queda disponible en esa URL
    served = client.get(url.replace("http://localhost:8000", ""))
    assert served.status_code == 200 and served.content == data


def test_cada_foto_tiene_su_propio_nombre(client, fresh):
    assert upload(client, PNG).json()["url"] != upload(client, PNG).json()["url"]


@pytest.mark.parametrize(
    ("data", "name", "content_type"),
    [
        (SVG, "foto.svg", "image/svg+xml"),
        (SVG, "foto.png", "image/png"),  # disfrazado: el tipo se reconoce por el contenido
        (b"<html>hola</html>", "foto.webp", "image/webp"),
        (b"GIF89a" + b"\x00" * 20, "foto.gif", "image/gif"),
    ],
)
def test_rechaza_lo_que_no_es_jpg_png_ni_webp(client, fresh, data, name, content_type):
    response = upload(client, data, name, content_type)
    assert response.status_code == 400
    assert response.json()["fields"] == {"file": "Debe ser una foto JPG, PNG o WebP."}


def test_maximo_5_mb_y_archivo_obligatorio(client, fresh):
    big = upload(client, PNG + b"\x00" * MAX_BYTES)
    assert big.status_code == 400 and big.json()["fields"] == {"file": "Máximo 5 MB."}
    assert upload(client, b"").status_code == 400
    missing = client.post("/me/uploads", headers=auth())
    assert missing.status_code == 400 and missing.json()["fields"] == {"file": "Adjunta una imagen."}


def test_sin_sesion_no_se_sube_nada(client, fresh):
    response = client.post("/me/uploads", files={"file": ("foto.png", PNG, "image/png")})
    assert response.status_code == 401


def test_cada_tienda_sube_a_su_carpeta(client, fresh):
    assert f"/stores/{store_id(fresh, TN)}/" in upload(client, PNG, slug=TN).json()["url"]


def test_firma_de_cada_formato():
    assert detect_image(PNG).extension == "png"
    assert detect_image(JPG).extension == "jpg"
    assert detect_image(WEBP).extension == "webp"
    assert detect_image(b"RIFF\x00\x00\x00\x00WAVE") is None
    assert detect_image(SVG) is None


def test_supabase_storage_sube_al_bucket_con_la_clave_del_servidor():
    """Se prueba la llamada a Supabase sin red: se revisa exactamente qué se le envía."""
    sent: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(200, json={"Key": "imagenes/x"})

    storage = SupabaseStorage(
        "https://proyecto.supabase.co/",
        "clave-servicio",
        "imagenes",
        httpx.Client(transport=httpx.MockTransport(handler)),
    )
    url = save_image(storage, "st_1", io.BytesIO(PNG))
    [request] = sent
    assert request.method == "POST"
    assert str(request.url).startswith("https://proyecto.supabase.co/storage/v1/object/imagenes/stores/st_1/")
    assert request.headers["authorization"] == "Bearer clave-servicio"
    assert request.headers["content-type"] == "image/png" and request.headers["x-upsert"] == "false"
    assert request.content == PNG
    assert url.startswith("https://proyecto.supabase.co/storage/v1/object/public/imagenes/stores/st_1/")
    assert url.endswith(".png")


def test_si_supabase_falla_responde_503():
    failing = httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(500)))
    storage = SupabaseStorage("https://proyecto.supabase.co", "clave", "imagenes", failing)
    with pytest.raises(Exception) as error:
        save_image(storage, "st_1", io.BytesIO(PNG))
    assert getattr(error.value, "code", None) == "storage_unavailable"


# --- Planes ---


def test_plan_gratis_solo_ve_las_metricas_de_hoy(client, fresh, enforced):
    order = new_order(client)
    client.post(f"/me/orders/{order['id']}/confirm-payment", headers=auth())
    free = client.get("/me/stats", headers=auth(DA)).json()
    assert free["ordersToday"] >= 1 and free["pendingConfirmation"] >= 0
    assert (free["salesWeekCents"], free["ordersWeek"], free["averageTicketCents"], free["topProducts"]) == (
        0,
        0,
        0,
        [],
    )
    pro = client.get("/me/stats", headers=auth(TN)).json()
    assert pro["salesWeekCents"] > 0 and pro["topProducts"]


def test_en_la_beta_todos_ven_todo(client, fresh):
    stats = client.get("/me/stats", headers=auth(DA)).json()
    assert stats["salesWeekCents"] > 0 and stats["topProducts"]


def run_set_plan(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "set_plan.py", *args], capture_output=True, text=True, encoding="utf-8", check=False
    )


def test_set_plan_activa_y_quita_el_pro(client, fresh, enforced):
    done = run_set_plan(DA, "pro", "--dias", "30")
    assert done.returncode == 0, done.stderr
    store = client.get("/me/store", headers=auth(DA)).json()
    assert store["plan"] == "pro" and store["planExpiresAt"] is not None
    assert client.get("/me/variants/va_da_alfajores-x12/movements", headers=auth(DA)).status_code == 200

    assert run_set_plan(DA, "free").returncode == 0
    store = client.get("/me/store", headers=auth(DA)).json()
    assert store["plan"] == "free" and store["planExpiresAt"] is None
    assert client.get("/me/variants/va_da_alfajores-x12/movements", headers=auth(DA)).status_code == 403

    assert run_set_plan("no-existe", "pro").returncode != 0
    assert run_set_plan(DA, "free", "--dias", "3").returncode != 0


def test_la_configuracion_no_es_parte_de_la_api(client):
    """Error real de B6: la configuración aparecía como un dato que el cliente podía mandar al subir fotos."""
    spec = client.get("/openapi.json").json()
    assert "Settings" not in spec["components"]["schemas"]
    text_spec = str(spec).lower()
    for secret in ("auth_dev_secret", "database_url", "supabase_service_key", "uploads_dir"):
        assert secret not in text_spec
    upload = spec["paths"]["/me/uploads"]["post"]
    assert set(str(upload).split("'")) & {"settings"} == set()
