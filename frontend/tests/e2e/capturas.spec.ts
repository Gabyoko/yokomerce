import { expect, type Page, test } from "@playwright/test";

import { createPickupOrder, loginAs, resetApi, simpleProduct } from "./helpers";

/*
 * Capturas de todas las pantallas en 390 y 1440 px (SPEC.md, sección 11, F8).
 * Se guardan en tests/e2e/capturas/<celular|computadora>/ para revisarlas a ojo.
 * Cada pantalla también comprueba que cargó sin errores en la consola.
 */

const STORE = "dulcesdeana";

type Screen = {
  name: string;
  path: string;
  /** Texto que confirma que la pantalla terminó de cargar. */
  ready: string | RegExp;
  /** Algo que hacer antes de la captura (abrir un modal, etc.). */
  before?: (page: Page) => Promise<void>;
};

let orderToken = "";
let orderId = "";
let productId = "";
let cart = "";

test.beforeAll(async ({ request }) => {
  await resetApi(request);
  const { product, variant } = await simpleProduct(request, STORE);
  productId = product.id;
  cart = JSON.stringify([{ variantId: variant.id, quantity: 2, customValues: {} }]);
  const order = await createPickupOrder(request, STORE, variant.id);
  orderToken = order.publicToken;
  const orders = (await (await request.get("/api/mock/me/orders", { headers: { "X-Mock-Store": STORE } })).json()) as {
    id: string;
    publicToken: string;
  }[];
  orderId = orders.find((o) => o.publicToken === orderToken)?.id ?? "";
});

const screens = (): Screen[] => [
  { name: "01-landing", path: "/", ready: "Tu catálogo y tus pedidos, por fin en orden." },
  { name: "02-registro", path: "/registro", ready: "Empecemos" },
  { name: "03-ingresar", path: "/ingresar", ready: "Ingresa a tu tienda" },
  { name: "04-catalogo", path: `/${STORE}`, ready: "Dulces de Ana" },
  { name: "05-producto", path: `/${STORE}/p/pr_da_torta-chocolate`, ready: "Torta de chocolate" },
  { name: "06-carrito", path: `/${STORE}/carrito`, ready: "Continuar" },
  { name: "07-checkout", path: `/${STORE}/checkout`, ready: "¿Cómo vas a pagar?" },
  { name: "08-pedido-listo", path: `/${STORE}/pedido/${orderToken}`, ready: "Tu pedido está listo" },
  { name: "09-panel-pedidos", path: "/panel", ready: "Pedidos hoy" },
  { name: "10-detalle-pedido", path: `/panel/pedidos/${orderId}`, ready: "Stock reservado para este pedido" },
  { name: "11-productos", path: "/panel/productos", ready: "Productos e inventario" },
  {
    name: "12-ajuste-stock",
    path: "/panel/productos",
    ready: "Productos e inventario",
    before: async (page) => {
      // Celular: botón en cada tarjeta. Computadora: se elige una fila y se ajusta desde el panel lateral.
      const button = page.getByRole("button", { name: /^(Ajustar stock|Reponer)$/ }).filter({ visible: true });
      if (await button.count()) {
        await button.first().click();
      } else {
        await page.getByRole("button", { name: /^Ver stock de / }).filter({ visible: true }).first().click();
        await page.getByRole("button", { name: "+ Entrada" }).click();
      }
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  {
    name: "13-inventario-panel",
    path: "/panel/productos",
    ready: "Productos e inventario",
    before: async (page) => {
      const row = page.getByRole("button", { name: /^Ver stock de / }).filter({ visible: true }).first();
      if (await row.count()) {
        await row.click();
        await expect(page.getByText("Historial de movimientos")).toBeVisible();
      }
    },
  },
  { name: "14-nuevo-producto", path: "/panel/productos/nuevo", ready: "Nuevo producto" },
  { name: "15-editar-producto", path: `/panel/productos/${productId}`, ready: "Precio y stock" },
  { name: "16-configuracion", path: "/panel/configuracion", ready: "Horario de atención" },
  { name: "17-plan", path: "/panel/plan", ready: "Tu plan" },
];

test("capturas de todas las pantallas", async ({ page, context }, testInfo) => {
  test.setTimeout(180_000);
  await loginAs(context, STORE);
  // El carrito vive en el navegador: se carga antes de abrir las páginas
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key!)) window.localStorage.setItem(key!, value!);
    },
    [`yokomerce:carrito:${STORE}`, cart],
  );

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  for (const screen of screens()) {
    await test.step(screen.name, async () => {
      await page.goto(screen.path);
      await expect(page.getByText(screen.ready).filter({ visible: true }).first()).toBeVisible();
      await screen.before?.(page);
      await page.waitForLoadState("networkidle");
      await page.screenshot({
        path: `tests/e2e/capturas/${testInfo.project.name}/${screen.name}.png`,
        fullPage: !screen.before,
      });
    });
  }

  expect(errors, `Errores en la consola:\n${errors.join("\n")}`).toEqual([]);
});
