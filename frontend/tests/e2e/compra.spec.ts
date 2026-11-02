import { expect, type Page, test } from "@playwright/test";

import { loginAs, randomPhone, resetApi } from "./helpers";

/*
 * Compra completa en las tres tiendas (SPEC.md, sección 13), en celular y computadora:
 * producto → carrito → checkout → pedido listo con WhatsApp → el pedido aparece en el panel.
 */

type StoreCase = {
  slug: string;
  name: string;
  productId: string;
  productName: string;
  /** Elige opciones y llena campos extra en el detalle del producto. */
  choose: (page: Page) => Promise<void>;
  fulfillment: string;
  /** Datos extra de la entrega elegida. */
  delivery?: (page: Page) => Promise<void>;
  payment: string;
  /** La tienda usa fecha de entrega. */
  date: boolean;
};

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });

/** Las opciones del checkout son tarjetas con un radio oculto: se toca la tarjeta, como lo haría una persona. */
const choice = (page: Page, name: string | RegExp) =>
  page.locator("label").filter({ has: page.getByRole("radio", { name, exact: typeof name === "string" }) });

const STORES: StoreCase[] = [
  {
    slug: "dulcesdeana",
    name: "Dulces de Ana",
    productId: "pr_da_torta-chocolate",
    productName: "Torta de chocolate",
    choose: async (page) => {
      await radio(page, "Mediana").click();
      await page.getByLabel(/Dedicatoria/).fill("Feliz cumpleaños, Lucía");
    },
    fulfillment: "Recojo en tienda",
    payment: "Yape",
    date: true,
  },
  {
    slug: "tallernorte",
    name: "Taller Norte",
    productId: "pr_tn_polo-oversize",
    productName: "Polo oversize",
    choose: async (page) => {
      await radio(page, "Negro").click();
      await radio(page, "L").click();
    },
    fulfillment: "Envío a provincia",
    delivery: async (page) => {
      await page.getByLabel("Ciudad").fill("Arequipa");
      await page.getByLabel("Dirección").fill("Calle Mercaderes 120");
    },
    payment: "Plin",
    date: false,
  },
  {
    slug: "fundalab",
    name: "Funda Lab",
    productId: "pr_fl_funda-personalizada",
    productName: "Funda personalizada",
    choose: async (page) => {
      await radio(page, "iPhone 15").click();
      await radio(page, "Negro").click();
      await page.getByLabel("Nombre para personalizar").fill("Camila");
    },
    fulfillment: "Recojo en tienda",
    payment: "Yape",
    date: false,
  },
];

test.beforeAll(async ({ request }) => {
  await resetApi(request);
});

for (const store of STORES) {
  test(`compra completa en ${store.name}`, async ({ page, context }, testInfo) => {
    const customer = `Cliente ${testInfo.project.name} ${store.slug}`;

    // Catálogo
    await page.goto(`/${store.slug}`);
    await expect(page.getByRole("heading", { name: store.name, level: 1 })).toBeVisible();

    // Producto: opciones, campos extra y agregar
    await page.goto(`/${store.slug}/p/${store.productId}`);
    await expect(page.getByRole("heading", { name: store.productName })).toBeVisible();
    await store.choose(page);
    await page.getByRole("button", { name: /^Agregar · / }).click();

    // Carrito
    await page.goto(`/${store.slug}/carrito`);
    await expect(page.getByRole("link", { name: store.productName }).first()).toBeVisible();
    await page.getByRole("link", { name: /Continuar/ }).click();

    // Checkout
    await expect(page.getByRole("heading", { name: "Tus datos" })).toBeVisible();
    await page.getByLabel("Nombre").fill(customer);
    await page.getByLabel("Celular").fill(randomPhone());
    await choice(page, new RegExp(store.fulfillment)).click();
    await store.delivery?.(page);
    if (store.date) {
      await page.getByRole("group", { name: "¿Para cuándo?" }).locator("label").first().click();
    }
    await choice(page, store.payment).click();
    await page.getByRole("button", { name: "Enviar pedido por WhatsApp" }).click();

    // Pedido listo
    await expect(page.getByRole("heading", { name: "Tu pedido está listo" })).toBeVisible();
    await expect(page.getByText(`Nuevo pedido #`).first()).toBeVisible();
    const whatsapp = page.getByRole("link", { name: "Abrir WhatsApp y enviar" });
    await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/51\d{9}\?text=Nuevo%20pedido/);

    // El carrito quedó vacío
    await page.goto(`/${store.slug}/carrito`);
    await expect(page.getByRole("heading", { name: "Tu carrito está vacío" })).toBeVisible();

    // Panel del negocio: el pedido aparece y se puede confirmar el pago
    await loginAs(context, store.slug);
    await page.goto("/panel");
    await page.locator("li, tr").filter({ hasText: customer, visible: true }).getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: /^Pedido #\d{4}$/ })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar pago" }).click();
    await expect(page.getByRole("button", { name: "Empezar a preparar" })).toBeVisible();
  });
}
