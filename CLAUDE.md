# Yokomerce

App web responsive para que pequeños negocios en Perú (de cualquier rubro) tengan un catálogo con link propio y reciban pedidos ordenados por WhatsApp. No es una app móvil nativa: es una sola web que se usa desde el navegador del celular o de la computadora.

## Repositorio

```
yokomerce/
├── CLAUDE.md        # este archivo: reglas generales
├── SPEC.md          # especificación completa (contrato, reglas, etapas)
├── design/          # diseño de referencia de las pantallas
├── frontend/        # Next.js + TypeScript  → ver frontend/CLAUDE.md
└── backend/         # FastAPI + Python      → ver backend/CLAUDE.md
```

Lee solo la sección de `SPEC.md` que necesite la tarea actual.

## Fases

1. **Fase F:** frontend completo contra una API de prueba que vive dentro de Next.js.
2. **Fase B:** backend real en FastAPI que implementa exactamente el mismo contrato.
3. **Fase C:** se conecta cambiando `NEXT_PUBLIC_API_URL` y la autenticación de `apiFetch`.

Fase actual: **F**. No crees nada en `backend/` hasta que se pida la fase B.

## El contrato manda

- El contrato entre front y back está en `SPEC.md`, secciones 4 (tipos) y 5 (endpoints).
- Los tipos de `frontend/shared/types/` y los esquemas de `backend/app/modules/*/` deben coincidir campo por campo.
- Front y back usan los mismos nombres de contexto: las features del front (`orders`, `inventory`, `catalog`, `products`, `store-settings`, `plans`, `dashboard`) corresponden a los módulos del back (`ordering`, `inventory`, `catalog`, `stores`, `subscriptions`, `reporting`). Ver `SPEC.md`, sección 5.
- No cambies el contrato sin avisar. Si una tarea lo necesita, propón el cambio y actualiza `SPEC.md`.
- JSON en `camelCase`, dinero en céntimos enteros, fechas ISO, errores `{ error, message }`.

## Cómo trabajar

- Trabaja solo en la etapa o tarea que se pida. No toques otras partes sin avisar.
- Antes de una tarea grande, propone un plan corto y espera confirmación.
- Lee solo los archivos necesarios.
- Al terminar, explica en pocas líneas qué cambiaste y cómo probarlo.
- No instales dependencias nuevas sin decir para qué sirven.
- Nunca pongas claves ni secretos en el código. Van en archivos `.env` que no se suben a Git, documentados en `.env.example`.

## Reglas del producto

- La app es para cualquier tipo de negocio. Nunca escribas lógica fija de un rubro (nada de "si es pastelería..."). Todo se controla con opciones de producto, campos extra y funciones activables de cada tienda (`SPEC.md`, sección 3).
- Si una función de la tienda está desactivada, no aparece en ninguna pantalla y la API la rechaza.
- El cliente nunca crea cuenta. Solo el dueño del negocio inicia sesión.
- No hay pagos dentro de la app. El cliente paga directo al negocio.
- Precios, totales y stock los decide siempre la API, nunca el navegador.

## Textos y formatos

- Interfaz en español peruano, tono cercano. Trata al usuario de "tú".
- Moneda: `S/ 1,240.00` (formato `es-PE`, PEN).
- Zona horaria: `America/Lima`.
- Celulares peruanos: 9 dígitos que empiezan con 9. En WhatsApp, con prefijo `51`.
