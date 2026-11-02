import { variantGrid } from "./helpers";
import type { SeedStore } from "./types";

const SIZE_GUIDE = "/mock/guia-de-tallas.svg";

const poloOptions = [
  { name: "Color", values: ["Negro", "Blanco", "Verde oliva"] },
  { name: "Talla", values: ["S", "M", "L", "XL"] },
];

const joggerOptions = [
  { name: "Color", values: ["Negro", "Gris"] },
  { name: "Talla", values: ["S", "M", "L"] },
];

/**
 * Ropa urbana en Lima Norte. Funciones: guía de tallas, zonas de delivery y envío a provincia
 * con precio fijo. Sin fecha de entrega. Pagos: Yape, Plin y transferencia. Plan Pro.
 */
export const tallerNorte: SeedStore = {
  idPrefix: "tn",
  ownerName: "Kevin Huamán",
  store: {
    slug: "tallernorte",
    name: "Taller Norte",
    description: "Ropa urbana hecha en Lima. Envíos a todo el Perú.",
    logoUrl: null,
    coverUrl: null,
    city: "Los Olivos",
    whatsapp: "51923456789",
    businessHours: {
      mon: { open: "10:00", close: "19:00" },
      tue: { open: "10:00", close: "19:00" },
      wed: { open: "10:00", close: "19:00" },
      thu: { open: "10:00", close: "19:00" },
      fri: { open: "10:00", close: "19:00" },
      sat: { open: "10:00", close: "16:00" },
      sun: null,
    },
    paymentMethods: ["yape", "plin", "transfer"],
    paymentInstructions: "Yape o Plin al 923 456 789. Transferencia BCP: cuenta 191-12345678-0-12 a nombre de Kevin Huamán.",
    features: {
      deliveryDate: false,
      leadTimeDays: 0,
      madeToOrder: false,
      sizeGuide: true,
      deliveryZones: true,
      pickup: false,
      shipping: true,
    },
    pickupAddress: null,
    shippingFeeCents: 1500,
    reservationHours: 48,
    plan: "pro",
    planExpiresInDays: 60,
  },
  zones: [
    { name: "Los Olivos", priceCents: 800 },
    { name: "San Martín de Porres", priceCents: 1000 },
    { name: "Comas", priceCents: 1000 },
    { name: "Independencia", priceCents: 800, active: false },
  ],
  categories: ["Polos", "Casacas y polerones", "Pantalones", "Accesorios"],
  products: [
    {
      key: "polo-oversize",
      category: "Polos",
      name: "Polo oversize",
      description: "Polo de algodón pima 30/1, corte amplio y cuello reforzado.",
      sizeGuideUrl: SIZE_GUIDE,
      options: poloOptions,
      // 12 combinaciones, 3 agotadas
      variants: variantGrid(
        poloOptions,
        4500,
        { available: 6, lowStockThreshold: 2 },
        {
          "Negro / M": { available: 0 },
          "Blanco / XL": { available: 0 },
          "Verde oliva / S": { available: 0 },
          "Negro / L": { available: 2 },
          "Verde oliva / XL": { available: 1 },
        },
      ),
    },
    {
      key: "casaca-denim",
      category: "Casacas y polerones",
      name: "Casaca denim",
      description: "Casaca de jean grueso con forro de franela.",
      sizeGuideUrl: SIZE_GUIDE,
      options: [{ name: "Talla", values: ["S", "M", "L", "XL"] }],
      variants: [
        { values: ["S"], priceCents: 12900, available: 3, lowStockThreshold: 1 },
        { values: ["M"], priceCents: 12900, available: 5, lowStockThreshold: 1 },
        { values: ["L"], priceCents: 12900, available: 4, lowStockThreshold: 1 },
        { values: ["XL"], priceCents: 13900, available: 2, lowStockThreshold: 1 },
      ],
    },
    {
      key: "jogger",
      category: "Pantalones",
      name: "Jogger",
      description: "Jogger de french terry con bolsillos laterales y puño en la basta.",
      sizeGuideUrl: SIZE_GUIDE,
      options: joggerOptions,
      variants: variantGrid(
        joggerOptions,
        6900,
        { available: 5, lowStockThreshold: 2 },
        // Combinación que el dueño desactivó: no se vende
        { "Gris / L": { available: 0, active: false } },
      ),
    },
    {
      key: "hoodie",
      category: "Casacas y polerones",
      name: "Polerón con capucha",
      description: "Polerón de felpa con capucha y bolsillo canguro.",
      sizeGuideUrl: SIZE_GUIDE,
      options: [{ name: "Talla", values: ["M", "L", "XL"] }],
      variants: [
        { values: ["M"], priceCents: 8900, available: 6, lowStockThreshold: 2 },
        { values: ["L"], priceCents: 8900, available: 4, lowStockThreshold: 2 },
        { values: ["XL"], priceCents: 8900, available: 2, lowStockThreshold: 2 },
      ],
    },
    {
      key: "gorra",
      category: "Accesorios",
      name: "Gorra bordada",
      description: "Gorra de drill con logo bordado y correa regulable. Talla única.",
      variants: [{ values: [], priceCents: 3500, available: 10, lowStockThreshold: 3 }],
    },
    {
      key: "short-cargo",
      category: "Pantalones",
      name: "Short cargo",
      description: "Short de drill con bolsillos cargo. Temporada de verano.",
      sizeGuideUrl: SIZE_GUIDE,
      // Oculto: el dueño aún no lo publica
      visible: false,
      options: [{ name: "Talla", values: ["28", "30", "32", "34"] }],
      variants: variantGrid([{ name: "Talla", values: ["28", "30", "32", "34"] }], 5500, { available: 4 }),
    },
  ],
  firstOrderNumber: 15,
  orders: [
    {
      hoursAgo: 165,
      status: "delivered",
      customer: { name: "Andrea Villanueva", phone: "952 118 774" },
      fulfillment: { type: "shipping", city: "Arequipa", address: "Calle Mercaderes 410", reference: "Agencia Shalom de Av. Ejército" },
      deliverAfterHours: 72,
      paymentMethod: "transfer",
      items: [{ product: "polo-oversize", variant: ["Negro", "M"], quantity: 2 }],
    },
    {
      hoursAgo: 140,
      status: "delivered",
      customer: { name: "Luis Chávez", phone: "981 445 220" },
      fulfillment: { type: "delivery", zone: "Los Olivos", address: "Av. Antúnez de Mayolo 880", reference: "Cerca al Mega Plaza" },
      deliverAfterHours: 24,
      paymentMethod: "yape",
      items: [
        { product: "polo-oversize", variant: ["Blanco", "L"], quantity: 1 },
        { product: "gorra", quantity: 1 },
      ],
    },
    {
      hoursAgo: 120,
      status: "cancelled",
      cancelledFrom: "paid",
      paidAfterMinutes: 20,
      customer: { name: "Jesús Ramírez", phone: "937 602 315" },
      fulfillment: { type: "delivery", zone: "San Martín de Porres", address: "Jr. Los Cedros 155" },
      paymentMethod: "plin",
      items: [{ product: "casaca-denim", variant: ["M"], quantity: 1 }],
      notes: "Pidió cambio de talla, se le devolvió el dinero.",
    },
    {
      hoursAgo: 96,
      status: "expired",
      customer: { name: "Milagros Ccahuana", phone: "965 330 841" },
      fulfillment: { type: "delivery", zone: "Comas", address: "Av. Túpac Amaru 3450" },
      paymentMethod: "yape",
      items: [{ product: "jogger", variant: ["Negro", "M"], quantity: 1 }],
    },
    {
      hoursAgo: 72,
      status: "delivered",
      customer: { name: "Bruno Castillo", phone: "974 991 006" },
      fulfillment: { type: "shipping", city: "Trujillo", address: "Av. España 1290", reference: "Agencia Olva" },
      deliverAfterHours: 60,
      paymentMethod: "transfer",
      items: [{ product: "hoodie", variant: ["L"], quantity: 1 }],
    },
    {
      hoursAgo: 30,
      status: "preparing",
      customer: { name: "Daniela Flores", phone: "958 274 113" },
      fulfillment: { type: "shipping", city: "Piura", address: "Calle Lima 735", reference: "Agencia Shalom" },
      paymentMethod: "transfer",
      items: [{ product: "polo-oversize", variant: ["Verde oliva", "M"], quantity: 3 }],
    },
    {
      hoursAgo: 20,
      status: "paid",
      customer: { name: "Kevin Sánchez", phone: "926 448 509" },
      fulfillment: { type: "delivery", zone: "Los Olivos", address: "Calle Las Turquesas 312" },
      paymentMethod: "yape",
      items: [
        { product: "jogger", variant: ["Gris", "S"], quantity: 1 },
        { product: "gorra", quantity: 1 },
      ],
      notes: "Dejar en portería si no está.",
    },
    {
      hoursAgo: 6,
      status: "new",
      customer: { name: "Alejandra Paz", phone: "989 663 271" },
      fulfillment: { type: "delivery", zone: "San Martín de Porres", address: "Av. Universitaria 5220", reference: "Frente a la UNI" },
      paymentMethod: "plin",
      items: [{ product: "casaca-denim", variant: ["L"], quantity: 1 }],
    },
    {
      hoursAgo: 1,
      status: "new",
      customer: { name: "Sebastián Mendoza", phone: "912 057 884" },
      fulfillment: { type: "delivery", zone: "Los Olivos", address: "Jr. Río Huallaga 140" },
      paymentMethod: "yape",
      items: [{ product: "polo-oversize", variant: ["Negro", "L"], quantity: 1 }],
    },
  ],
  adjustments: [
    { product: "polo-oversize", variant: ["Blanco", "S"], type: "out", quantity: 2, reason: "feria", hoursAgo: 100 },
    { product: "gorra", type: "in", quantity: 5, reason: "produccion", hoursAgo: 48 },
  ],
};
