import { Boxes, Check, ChevronDown, LayoutGrid, MapPin, MessageCircle, TrendingUp, Wallet, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { PLAN_FEATURES, PRO_PRICE_CENTS } from "@/features/plans";
import { BRAND } from "@/shared/lib/brand";
import { formatSoles } from "@/shared/lib/money";
import { buttonStyles } from "@/shared/ui";

/*
 * Landing para negocios (design/Landing.dc.html). Es estática: no pide datos a la API.
 * Los textos describen solo lo que la app hace de verdad (SPEC.md manda sobre el diseño).
 */

const SECTION = "mx-auto w-full max-w-6xl px-5 sm:px-6";
const H2 = "font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl";

function Logo() {
  return (
    <Link href="/" className="font-display text-[26px] font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-primary">
      {BRAND.logo}
      <span className="text-primary">.</span>
    </Link>
  );
}

function CtaPrimary({ children = "Crear mi tienda gratis", className }: { children?: ReactNode; className?: string }) {
  return (
    <Link href="/registro" className={buttonStyles({ size: "lg", className: `rounded-[16px] px-6 text-[17px] ${className ?? ""}` })}>
      {children}
    </Link>
  );
}

/** Celular de muestra con un catálogo y el mensaje que llega por WhatsApp. */
function HeroMockup() {
  const products = [
    ["Torta de chocolate", "S/ 45", "bg-primary-soft"],
    ["Cheesecake", "S/ 55", "bg-warning-soft"],
    ["Alfajores x12", "S/ 18", "bg-border"],
    ["Brownies x6", "S/ 20", "bg-whatsapp-soft"],
  ];
  return (
    <div aria-hidden className="relative flex justify-center py-5 select-none">
      <div className="w-[300px] rounded-[36px] bg-ink p-2.5 shadow-xl">
        <div className="overflow-hidden rounded-[28px] bg-bg">
          <div className="h-[72px] bg-primary-soft" />
          <div className="-mt-6 px-4 pb-4">
            <span className="flex size-12 items-center justify-center rounded-[14px] border-[3px] border-bg bg-primary text-[17px] font-bold text-white">
              DA
            </span>
            <p className="mt-2 font-display text-[19px] font-bold">Dulces de Ana</p>
            <p className="mt-0.5 mb-3 text-xs text-ink-muted">Tortas y postres caseros · Surco</p>
            <div className="grid grid-cols-2 gap-2">
              {products.map(([name, price, color]) => (
                <div key={name} className="rounded-[14px] border border-border bg-surface p-1.5">
                  <div className={`aspect-square rounded-[10px] ${color}`} />
                  <p className="mx-0.5 mt-1.5 text-xs font-semibold">{name}</p>
                  <p className="mx-0.5 my-0.5 text-[13px] font-bold">{price}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex h-11 items-center justify-between rounded-[14px] bg-ink px-3.5 text-[13px] font-bold text-white">
              <span>Ver carrito · 3</span>
              <span>S/ 108</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-0 bottom-10 hidden w-[230px] rounded-[18px] border border-border bg-surface p-3.5 shadow-lg sm:block">
        <p className="mb-2 text-xs font-bold text-whatsapp">Nuevo mensaje en WhatsApp</p>
        <p className="rounded-[14px_4px_14px_14px] bg-whatsapp-soft px-3 py-2.5 text-xs leading-normal text-ink">
          <span className="font-bold">Nuevo pedido #0042</span>
          <br />2 × Torta de chocolate
          <br />1 × Alfajores x12
          <br />
          Total: S/ 116.00 · Yape
        </p>
      </div>
    </div>
  );
}

const BEFORE = [
  "Mandas fotos una por una a cada cliente",
  "Respondes “¿cuánto cuesta?” todo el día",
  "Anotas pedidos en un cuaderno",
  "Vendes algo que ya no tenías",
];
const AFTER = [
  "Un link con todo tu catálogo y precios",
  "El cliente arma su pedido solo",
  "Cada pedido llega ordenado y queda guardado",
  "El stock se descuenta solo y te avisa cuando falta",
];

const STEPS = [
  ["Sube tus productos", "Desde tu celular: fotos, nombre y precio. Si tienen tallas, colores o sabores, también."],
  ["Comparte tu link", "En tu estado, tu bio de Instagram o TikTok, o cuando alguien te pregunte qué tienes."],
  ["Recibe pedidos ordenados", "Te llegan por WhatsApp con todo el detalle, y los gestionas desde tu panel."],
];

const FEATURES: { icon: typeof LayoutGrid; title: string; text: string }[] = [
  { icon: LayoutGrid, title: "Catálogo con tu link", text: "Categorías, opciones como talla, color o sabor, y productos por encargo." },
  { icon: MessageCircle, title: "Pedidos directo a WhatsApp", text: "Sigues hablando con tus clientes como siempre, pero sin escribir todo a mano." },
  { icon: Boxes, title: "Control de stock", text: "Se reserva al recibir el pedido, se descuenta al confirmar el pago y te avisa cuando queda poco." },
  { icon: MapPin, title: "Delivery, recojo o envío", text: "Un precio por distrito, recojo en tienda o envíos a provincia. Activas solo lo que usas." },
  { icon: Wallet, title: "Yape, Plin, efectivo o transferencia", text: "Tu cliente elige cómo paga y tú cobras directo, sin comisiones." },
  { icon: TrendingUp, title: "Tus ventas en números", text: "Pedidos del día, ventas de la semana y lo que más se vende." },
];

const FAQ = [
  ["¿Mis clientes tienen que descargar algo?", "No. Abren tu link desde el celular y piden. Tampoco necesitan crear una cuenta."],
  ["¿Cobran comisión por cada venta?", "No. El pago va directo de tu cliente a ti, por Yape, Plin, efectivo o transferencia."],
  ["¿Necesito WhatsApp Business?", "No. Funciona con el WhatsApp normal o el Business, el que ya uses."],
  ["¿Sirve para mi rubro?", "Sí. Tú creas las opciones de cada producto (talla, color, sabor, modelo…) y activas solo las funciones que necesitas."],
  ["¿Puedo usarlo desde la computadora?", "Sí. El panel funciona en el celular y en la computadora, con la misma cuenta."],
];

export function Landing() {
  const proPrice = PRO_PRICE_CENTS === null ? "Por anunciar" : `${formatSoles(PRO_PRICE_CENTS, { trimZeroDecimals: true })} al mes`;

  return (
    <div className="flex flex-col">
      <header className={`${SECTION} flex flex-wrap items-center gap-4 py-5`}>
        <div className="flex-1">
          <Logo />
        </div>
        <nav aria-label="Secciones" className="hidden gap-6 text-[15px] font-semibold md:flex">
          <a href="#como-funciona" className="hover:text-primary">Cómo funciona</a>
          <a href="#precios" className="hover:text-primary">Precios</a>
          <a href="#preguntas" className="hover:text-primary">Preguntas</a>
        </nav>
        <Link href="/ingresar" className="text-[15px] font-semibold hover:text-primary">
          Ingresar
        </Link>
        {/* El botón ya es inline-flex: se oculta con un envoltorio para que las clases no choquen */}
        <span className="hidden sm:block">
          <Link href="/registro" className={buttonStyles({ variant: "dark" })}>
            Crear mi tienda gratis
          </Link>
        </span>
      </header>

      <main>
        <section className={`${SECTION} flex flex-col items-center gap-10 pt-8 pb-16 lg:flex-row lg:gap-14 lg:pt-12 lg:pb-20`}>
          <div className="flex flex-1 flex-col gap-5">
            <span className="self-start rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-hover">
              Para negocios que venden por WhatsApp
            </span>
            <h1 className="font-display text-[40px] leading-[1.02] font-bold tracking-tight sm:text-6xl">
              Tu catálogo y tus pedidos, por fin en orden.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-muted sm:text-[19px]">
              Comparte un link con tus productos. Tus clientes arman su pedido solos y te llega por WhatsApp, con total,
              dirección y método de pago. Sin apps, sin comisiones.
            </p>
            <div className="flex flex-wrap gap-3">
              <CtaPrimary />
              <Link
                href={`/${BRAND.demoStoreSlug}`}
                className={buttonStyles({ variant: "secondary", size: "lg", className: "rounded-[16px] px-6 text-[17px]" })}
              >
                Ver tienda de ejemplo
              </Link>
            </div>
            <p className="text-sm text-ink-muted">Lista en 10 minutos · Yape, Plin, efectivo o transferencia</p>
          </div>
          <div className="w-full max-w-md flex-1">
            <HeroMockup />
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className={`${SECTION} flex flex-col gap-8 py-16 lg:flex-row lg:py-20`}>
            <h2 className={`${H2} lg:w-80 lg:shrink-0`}>Vender por WhatsApp no debería ser un caos</h2>
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[20px] bg-bg p-5.5">
                <h3 className="mb-3 font-bold text-ink-muted">Hoy</h3>
                <ul className="flex flex-col gap-2.5 text-[15px] leading-snug">
                  {BEFORE.map((t) => (
                    <li key={t} className="flex gap-2">
                      <X aria-hidden size={18} className="mt-0.5 shrink-0 text-danger" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[20px] bg-primary-soft p-5.5">
                <h3 className="mb-3 font-bold text-primary-hover">Con {BRAND.name}</h3>
                <ul className="flex flex-col gap-2.5 text-[15px] leading-snug">
                  {AFTER.map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check aria-hidden size={18} className="mt-0.5 shrink-0 text-whatsapp" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className={`${SECTION} scroll-mt-6 py-16 lg:py-20`}>
          <h2 className={H2}>Así funciona</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary font-display text-lg font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-2 text-lg font-bold">{title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-border bg-surface">
          <div className={`${SECTION} py-16 lg:py-20`}>
            <h2 className={H2}>Todo lo que tu negocio necesita</h2>
            <ul className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                    <Icon aria-hidden size={22} />
                  </span>
                  <span>
                    <span className="block font-bold">{title}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-ink-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="precios" className={`${SECTION} scroll-mt-6 py-16 lg:py-20`}>
          <h2 className={H2}>Empieza gratis. Crece cuando vendas más.</h2>
          <p className="mt-2 text-[17px] text-ink-muted">Sin comisiones por venta en ningún plan. Durante la beta, todo es gratis.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:max-w-4xl">
            <div className="flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-6">
              <div>
                <h3 className="text-lg font-bold">Gratis</h3>
                <p className="font-display text-4xl font-bold">S/ 0</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2.5 text-[15px]">
                {PLAN_FEATURES.free.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check aria-hidden size={18} className="mt-0.5 shrink-0 text-whatsapp" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/registro" className={buttonStyles({ variant: "secondary", size: "lg", fullWidth: true })}>
                Empezar gratis
              </Link>
            </div>
            <div className="flex flex-col gap-4 rounded-[20px] border-2 border-primary bg-surface p-6">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold">
                  Pro <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">Más completo</span>
                </h3>
                <p className="font-display text-4xl font-bold">{proPrice}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2.5 text-[15px]">
                {PLAN_FEATURES.pro.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check aria-hidden size={18} className="mt-0.5 shrink-0 text-whatsapp" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/registro" className={buttonStyles({ size: "lg", fullWidth: true })}>
                Probar gratis en la beta
              </Link>
            </div>
          </div>
        </section>

        <section id="preguntas" className="scroll-mt-6 border-y border-border bg-surface">
          <div className={`${SECTION} py-16 lg:py-20`}>
            <h2 className={H2}>Preguntas frecuentes</h2>
            <div className="mt-8 flex max-w-3xl flex-col divide-y divide-border">
              {FAQ.map(([question, answer]) => (
                <details key={question} className="group py-1">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                    {question}
                    <ChevronDown aria-hidden size={20} className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="pb-4 text-[15px] leading-relaxed text-ink-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={`${SECTION} py-16 text-center lg:py-24`}>
          <h2 className={H2}>Tu primera venta ordenada, hoy mismo.</h2>
          <p className="mt-3 text-[17px] text-ink-muted">Crea tu tienda en 10 minutos. Es gratis.</p>
          <CtaPrimary className="mt-7" />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className={`${SECTION} flex flex-wrap items-center justify-between gap-4 py-8 text-sm text-ink-muted`}>
          <Logo />
          <span>Hecho en Lima</span>
        </div>
      </footer>
    </div>
  );
}
