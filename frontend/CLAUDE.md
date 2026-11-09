# Frontend · Next.js

Lee también el `CLAUDE.md` de la raíz. La arquitectura del frontend está en `SPEC.md`, sección 2 ("Arquitectura del frontend: por features").

## Stack

- Next.js (App Router) + TypeScript estricto
- Tailwind CSS con tokens de color propios
- Zod para validar formularios
- `lucide-react` para iconos
- Vitest (lógica y utilidades) y Playwright (flujos y responsive)

## Arquitectura: por features

El front no usa DDD; las reglas de negocio están en el backend. Se organiza por funcionalidad:

- `app/`: solo rutas. Cada página es delgada y arma componentes de las features.
- `features/<nombre>/`: todo lo de una funcionalidad junto: `components/`, `hooks/`, `api.ts`, `schemas.ts`, `lib/` e `index.ts`.
- `shared/`: lo común: `ui/` (componentes base), `api/client.ts` (`apiFetch`), `lib/` (utilidades) y `types/` (el contrato).
- `mocks/` y `app/api/mock/`: la API de prueba de la fase F.
- Sesión: Supabase Auth en `shared/lib/supabase/` (cliente del navegador y del servidor), `features/auth/api.ts` (ingresar, registrarse, salir) y `proxy.ts` (renueva la sesión y protege `/panel`). Sin `NEXT_PUBLIC_SUPABASE_URL` se usa la sesión de prueba.

## Reglas de dependencia (obligatorias)

1. Una feature importa otra solo a través de su `index.ts`, nunca sus archivos internos.
2. `shared/` no importa nada de `features/` ni de `app/`.
3. Nada fuera de `mocks/` y `app/api/mock/` importa de `mocks/`.
4. Solo `shared/api/client.ts` hace `fetch` a la API. Las funciones de cada `features/*/api.ts` usan `apiFetch`.
5. Los tipos de `shared/types/` son el contrato. No los cambies sin avisar.

## Otras reglas

- La lógica simulada (stock, totales, estados) vive solo en `mocks/`. Es un backend falso que se eliminará en la fase C, y debe responder exactamente como el real: `camelCase`, céntimos, fechas ISO y errores `{ error, message }`.
- Componentes de servidor por defecto (catálogo, detalle, listas). Componentes de cliente (`"use client"`) solo donde haya interacción: carrito, selectores, formularios, modales.
- Después de una acción que cambia datos, refresca con `router.refresh()` o vuelve a pedir los datos; no recalcules números en el estado local.
- El carrito vive en `localStorage` (dentro de try/catch) con un hook de `features/cart`, y guarda solo `variantId`, `quantity` y `customValues`.
- Las utilidades puras tienen pruebas con Vitest.

## Responsive

- Pensado primero para celular: diseña para 390 px y adapta hasta 1440 px.
- Cada pantalla con datos tiene estados de carga, vacío y error.

## Estilo visual

- Fondo `#FBF7F2`, superficies `#FFFFFF`, bordes `#EADFD3`
- Texto `#2A211C`, texto secundario `#6E625A`
- Principal (terracota) `#C2491F`, hover `#9E3A17`, fondo suave `#FBE7DD`
- WhatsApp y acciones de envío: verde `#1F7A4D`, fondo suave `#E2F3E8`
- Advertencia (stock bajo, nuevo): texto `#7A4A00`, fondo `#FFF0D4`
- Error (agotado, cancelar): texto `#A1281C`, fondo `#FBE5E2`
- Títulos: Bricolage Grotesque (600 y 700). Texto: Figtree (400 a 700). Cargar con `next/font/google`.
- Colores como tokens en la configuración de Tailwind; no repitas códigos hexadecimales en componentes.
- Bordes redondeados (12 a 20 px en tarjetas), botones de al menos 44 px de alto, sin emojis.
- Contraste mínimo 4.5:1. Usa `<button>`, `<a>`, `<label>` reales.

## Comandos (dentro de `frontend/`)

- `npm run dev` (o `npm run dev -- -H 0.0.0.0` para probar desde el celular en la misma red)
- `npm run lint`, `npm run typecheck`, `npm test` antes de dar una tarea por terminada
- `npx playwright test`
- `npm run contract` regenera `shared/types/generated.ts` desde `backend/openapi.json` (antes: `python -m uv run python export_openapi.py` en `backend/`). `npm run typecheck` falla si front y back dejan de coincidir (`shared/types/contract.check.ts`).
