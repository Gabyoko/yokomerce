import { variantGrid } from "./helpers";
import type { SeedStore } from "./types";

const customOptions = [
  { name: "Modelo de celular", values: ["iPhone 15", "Samsung A54", "Redmi Note 13"] },
  { name: "Color", values: ["Negro", "Rosado"] },
];

/**
 * Accesorios de celular. Funciones: envío a provincia con precio "a coordinar" y recojo en tienda.
 * Sin zonas de delivery ni fecha de entrega. Pagos: Yape y transferencia.
 */
export const fundaLab: SeedStore = {
  idPrefix: "fl",
  ownerName: "Valeria Quispe",
  store: {
    slug: "fundalab",
    name: "Funda Lab",
    description: "Fundas, micas y accesorios para tu celular. Personalizamos con tu nombre.",
    logoUrl: null,
    coverUrl: null,
    city: "Cercado de Lima",
    whatsapp: "51934567890",
    businessHours: {
      mon: { open: "10:00", close: "20:00" },
      tue: { open: "10:00", close: "20:00" },
      wed: { open: "10:00", close: "20:00" },
      thu: { open: "10:00", close: "20:00" },
      fri: { open: "10:00", close: "20:00" },
      sat: { open: "10:00", close: "20:00" },
      sun: { open: "11:00", close: "17:00" },
    },
    paymentMethods: ["yape", "transfer"],
    paymentInstructions: "Yape al 934 567 890. Transferencia Interbank: cuenta 200-3001234567 a nombre de Valeria Quispe.",
    features: {
      deliveryDate: false,
      leadTimeDays: 0,
      madeToOrder: false,
      sizeGuide: false,
      deliveryZones: false,
      pickup: true,
      shipping: true,
    },
    pickupAddress: "Av. Garcilaso de la Vega 1348, tienda 215, Cercado de Lima",
    // Envío a provincia "a coordinar"
    shippingFeeCents: null,
    reservationHours: 24,
    plan: "free",
    planExpiresInDays: null,
  },
  zones: [],
  categories: ["Fundas", "Micas", "Cargadores y cables", "Accesorios"],
  products: [
    {
      key: "funda-transparente",
      category: "Fundas",
      name: "Funda transparente",
      description: "Funda de silicona transparente antigolpes con esquinas reforzadas.",
      options: [{ name: "Modelo de celular", values: ["iPhone 15", "iPhone 14", "Samsung A54", "Redmi Note 13"] }],
      variants: [
        { values: ["iPhone 15"], priceCents: 2500, available: 8, lowStockThreshold: 2 },
        { values: ["iPhone 14"], priceCents: 2500, available: 5, lowStockThreshold: 2 },
        { values: ["Samsung A54"], priceCents: 2500, available: 6, lowStockThreshold: 2 },
        { values: ["Redmi Note 13"], priceCents: 2500, available: 0, lowStockThreshold: 2 },
      ],
    },
    {
      key: "funda-personalizada",
      category: "Fundas",
      name: "Funda personalizada",
      description: "Funda de policarbonato con tu nombre impreso. Lista en 24 horas.",
      options: customOptions,
      customFields: [{ label: "Nombre para personalizar", required: true, maxLength: 20 }],
      variants: variantGrid(customOptions, 3900, { available: 4, lowStockThreshold: 1 }, {
        "Redmi Note 13 / Rosado": { available: 1 },
      }),
    },
    {
      key: "cargador-rapido",
      category: "Cargadores y cables",
      name: "Cargador rápido 20 W",
      description: "Cargador USB-C de 20 W compatible con iPhone y Android.",
      variants: [{ values: [], priceCents: 4900, available: 7, lowStockThreshold: 3 }],
    },
    {
      key: "mica-vidrio",
      category: "Micas",
      name: "Mica de vidrio templado",
      description: "Mica 9H que cubre toda la pantalla. Incluye kit de instalación.",
      options: [{ name: "Modelo de celular", values: ["iPhone 15", "iPhone 14", "Samsung A54"] }],
      variants: [
        { values: ["iPhone 15"], priceCents: 1500, available: 20, lowStockThreshold: 5 },
        { values: ["iPhone 14"], priceCents: 1500, available: 15, lowStockThreshold: 5 },
        { values: ["Samsung A54"], priceCents: 1500, available: 2, lowStockThreshold: 5 },
      ],
    },
    {
      key: "cable-usbc",
      category: "Cargadores y cables",
      name: "Cable USB-C trenzado",
      description: "Cable trenzado resistente de carga rápida.",
      options: [{ name: "Largo", values: ["1 m", "2 m"] }],
      variants: [
        { values: ["1 m"], priceCents: 1900, available: 12, lowStockThreshold: 3 },
        { values: ["2 m"], priceCents: 2400, available: 6, lowStockThreshold: 3 },
      ],
    },
    {
      key: "popsocket",
      category: "Accesorios",
      name: "Soporte para celular",
      description: "Soporte adhesivo plegable que también sirve de parante.",
      options: [{ name: "Color", values: ["Negro", "Lila", "Celeste"] }],
      variants: [
        { values: ["Negro"], priceCents: 1200, available: 9, lowStockThreshold: 2 },
        { values: ["Lila"], priceCents: 1200, available: 4, lowStockThreshold: 2 },
        { values: ["Celeste"], priceCents: 1200, available: 0, lowStockThreshold: 2 },
      ],
    },
    {
      key: "audifonos",
      category: "Accesorios",
      name: "Audífonos inalámbricos",
      description: "Audífonos bluetooth con estuche de carga. Hasta 20 horas de batería.",
      variants: [{ values: [], priceCents: 8900, available: 3, lowStockThreshold: 2 }],
    },
  ],
  firstOrderNumber: 1,
  orders: [
    {
      hoursAgo: 160,
      status: "delivered",
      customer: { name: "Óscar Huerta", phone: "947 552 018" },
      fulfillment: { type: "pickup" },
      deliverAfterHours: 4,
      paymentMethod: "yape",
      items: [{ product: "cargador-rapido", quantity: 1 }],
    },
    {
      hoursAgo: 140,
      status: "delivered",
      customer: { name: "Camila Torres", phone: "971 830 245" },
      fulfillment: { type: "shipping", city: "Cusco", address: "Av. de la Cultura 1020", reference: "Agencia Shalom" },
      deliverAfterHours: 72,
      paymentMethod: "transfer",
      items: [
        { product: "funda-personalizada", variant: ["iPhone 15", "Negro"], quantity: 1, customValues: { "Nombre para personalizar": "Camila" } },
        { product: "mica-vidrio", variant: ["iPhone 15"], quantity: 1 },
      ],
    },
    {
      hoursAgo: 120,
      status: "expired",
      customer: { name: "Piero Lozano", phone: "985 210 367" },
      fulfillment: { type: "pickup" },
      paymentMethod: "yape",
      items: [{ product: "audifonos", quantity: 1 }],
    },
    {
      hoursAgo: 100,
      status: "cancelled",
      cancelledFrom: "new",
      customer: { name: "Rocío Vargas", phone: "916 774 302" },
      fulfillment: { type: "shipping", city: "Chiclayo", address: "Calle Elías Aguirre 560" },
      paymentMethod: "transfer",
      items: [{ product: "popsocket", variant: ["Lila"], quantity: 2 }],
    },
    {
      hoursAgo: 70,
      status: "delivered",
      customer: { name: "Héctor Palomino", phone: "990 128 664" },
      fulfillment: { type: "pickup" },
      deliverAfterHours: 3,
      paymentMethod: "yape",
      items: [
        { product: "funda-transparente", variant: ["iPhone 14"], quantity: 1 },
        { product: "cable-usbc", variant: ["1 m"], quantity: 1 },
      ],
    },
    {
      hoursAgo: 28,
      status: "preparing",
      customer: { name: "Sofía Ríos", phone: "938 446 125" },
      fulfillment: { type: "shipping", city: "Huancayo", address: "Jr. Real 845", reference: "Agencia Marvisur" },
      paymentMethod: "transfer",
      items: [
        { product: "funda-personalizada", variant: ["Samsung A54", "Rosado"], quantity: 2, customValues: { "Nombre para personalizar": "Sofía" } },
      ],
      notes: "Coordinar costo del envío antes de despachar.",
    },
    {
      hoursAgo: 10,
      status: "paid",
      customer: { name: "Manuel Aguilar", phone: "964 803 571" },
      fulfillment: { type: "pickup" },
      paymentMethod: "yape",
      items: [{ product: "mica-vidrio", variant: ["Samsung A54"], quantity: 1 }],
    },
    {
      hoursAgo: 2,
      status: "new",
      customer: { name: "Natalia Benites", phone: "923 905 418" },
      fulfillment: { type: "shipping", city: "Arequipa", address: "Av. Ejército 708", reference: "Agencia Olva" },
      paymentMethod: "transfer",
      items: [
        { product: "funda-transparente", variant: ["iPhone 15"], quantity: 1 },
        { product: "cargador-rapido", quantity: 1 },
      ],
    },
  ],
  adjustments: [{ product: "popsocket", variant: ["Celeste"], type: "out", quantity: 1, reason: "merma", hoursAgo: 40 }],
};
