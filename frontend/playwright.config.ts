import { defineConfig, devices } from "@playwright/test";

/*
 * Pruebas en navegador (SPEC.md, sección 13): compra completa en las tres tiendas y capturas
 * de todas las pantallas, en celular (390 px) y computadora (1440 px).
 * Usan el servidor de `npm run dev` en el puerto 3000; si no está corriendo, lo inician.
 */
const BASE_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/e2e/.resultados",
  // Las pruebas comparten la API de prueba en memoria: una a la vez
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "celular",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    {
      name: "computadora",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
