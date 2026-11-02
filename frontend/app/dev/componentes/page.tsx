import { ImageIcon, MapPin, Plus, Search, Send } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Badge, Button, buttonStyles, Card, Input, Select, Skeleton, Textarea } from "@/shared/ui";

import { ModalDemo, SwitchDemo, ToastDemo } from "./demos";
import { BRAND, pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Componentes"),
  robots: { index: false },
};

const colors = [
  { name: "bg", className: "bg-bg" },
  { name: "surface", className: "bg-surface" },
  { name: "border", className: "bg-border" },
  { name: "border-strong", className: "bg-border-strong" },
  { name: "ink", className: "bg-ink" },
  { name: "ink-muted", className: "bg-ink-muted" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-hover", className: "bg-primary-hover" },
  { name: "primary-soft", className: "bg-primary-soft" },
  { name: "whatsapp", className: "bg-whatsapp" },
  { name: "whatsapp-soft", className: "bg-whatsapp-soft" },
  { name: "warning", className: "bg-warning" },
  { name: "warning-soft", className: "bg-warning-soft" },
  { name: "danger", className: "bg-danger" },
  { name: "danger-soft", className: "bg-danger-soft" },
];

/** Catálogo de componentes base. Solo existe en desarrollo. */
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Componentes</h1>
        <p className="text-ink-muted">Base visual de {BRAND.name}. Revisa esta página a 390 y 1440 px.</p>
      </header>

      <Section title="Colores">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {colors.map((color) => (
            <div key={color.name} className="flex flex-col gap-1.5">
              <div className={`h-12 rounded-field border border-border ${color.className}`} />
              <code className="text-xs text-ink-muted">{color.name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía">
        <div className="flex flex-col gap-2">
          <p className="font-display text-[26px] font-bold tracking-tight">Bricolage 700 · Título de tienda</p>
          <p className="font-display text-[19px] font-semibold">Bricolage 600 · Título de sección</p>
          <p className="text-[15px]">Figtree 400 · Texto normal para descripciones y formularios.</p>
          <p className="text-[15px] font-semibold">Figtree 600 · Nombres de producto y etiquetas</p>
          <p className="text-[22px] font-bold">S/ 1,240.00</p>
          <p className="text-[13px] text-ink-muted">Figtree 400 · Texto secundario</p>
        </div>
      </Section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Button">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button>Principal</Button>
              <Button variant="secondary">Secundario</Button>
              <Button variant="dark">Oscuro</Button>
              <Button variant="whatsapp">
                <Send aria-hidden />
                WhatsApp
              </Button>
              <Button variant="danger">Cancelar pedido</Button>
              <Button variant="ghost">Fantasma</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button iconOnly aria-label="Agregar al carrito">
                <Plus aria-hidden />
              </Button>
              <Button variant="secondary" iconOnly aria-label="Buscar">
                <Search aria-hidden />
              </Button>
              <Button loading>Guardando</Button>
              <Button disabled>Deshabilitado</Button>
              <Link href="/dev/componentes" className={buttonStyles({ variant: "secondary" })}>
                Enlace como botón
              </Link>
            </div>
            <Button size="lg" fullWidth>
              Agregar · S/ 90.00
            </Button>
            <Button size="lg" variant="whatsapp" fullWidth>
              <Send aria-hidden />
              Enviar pedido por WhatsApp
            </Button>
          </div>
        </Section>

        <Section title="Badge">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">Quedan 2</Badge>
              <Badge tone="primary">En tu carrito</Badge>
              <Badge tone="danger">Agotado</Badge>
              <Badge tone="success">Entregado</Badge>
              <Badge tone="dark">Por encargo</Badge>
              <Badge>Nuevo</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge size="md" tone="success" dot>
                Abierto hasta 8 p. m.
              </Badge>
              <Badge size="md">
                <MapPin aria-hidden />
                Delivery desde S/ 8
              </Badge>
              <Badge size="md" tone="warning" dot>
                Nuevo pedido
              </Badge>
            </div>
          </div>
        </Section>

        <Section title="Input, Select y Textarea">
          <div className="flex flex-col gap-5">
            <Input label="Buscar productos" hideLabel icon={<Search />} type="search" placeholder="Buscar productos…" />
            <Input label="Nombre" placeholder="¿A nombre de quién va el pedido?" autoComplete="name" />
            <Input
              label="Nota para el pedido"
              optional
              hint="Máximo 30 letras."
              defaultValue="Sin cebolla, por favor"
              maxLength={30}
            />
            <Input
              label="Celular"
              type="tel"
              inputMode="numeric"
              defaultValue="98765"
              error="Escribe los 9 dígitos de tu celular."
            />
            <Input label="Slug de la tienda" defaultValue="mi-tienda" disabled />
            <Select label="Zona de entrega" placeholder="Elige tu zona" defaultValue="">
              <option value="surco">Surco · S/ 8.00</option>
              <option value="miraflores">Miraflores · S/ 10.00</option>
              <option value="san-borja">San Borja · S/ 8.00</option>
            </Select>
            <Select label="Método de pago" error="Elige cómo vas a pagar." defaultValue="">
              <option value="" disabled>
                Elige un método
              </option>
              <option value="yape">Yape</option>
              <option value="cash">Efectivo</option>
            </Select>
            <Textarea label="Dirección y referencia" optional placeholder="Calle, número y una referencia" />
          </div>
        </Section>

        <div className="flex flex-col gap-10">
          <Section title="Switch">
            <Card>
              <SwitchDemo />
            </Card>
          </Section>

          <Section title="Modal y Toast">
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">
                El modal sale desde abajo en el celular y centrado en la computadora.
              </p>
              <ModalDemo />
              <ToastDemo />
            </div>
          </Section>
        </div>
      </div>

      <Section title="Card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ProductCardExample name="Polo básico" detail="Tallas S a XL" price="S/ 45" badge={<Badge tone="warning">Quedan 2</Badge>} />
          <ProductCardExample name="Gorra bordada" detail="Talla única" price="S/ 35" badge={<Badge tone="primary">En tu carrito</Badge>} />
          <ProductCardExample name="Casaca impermeable" detail="Vuelve mañana" price="S/ 120" soldOut />
          <Card padding="md" className="col-span-2 flex flex-col gap-1 sm:col-span-1 lg:col-span-2">
            <h3 className="text-lg font-bold">Tarjeta simple</h3>
            <p className="text-sm text-ink-muted">Card con padding=&quot;md&quot; para el panel: resúmenes, métricas y formularios.</p>
          </Card>
        </div>
      </Section>

      <Section title="Skeleton">
        <div aria-busy="true" aria-label="Cargando productos" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3].map((n) => (
            <Card key={n} padding="sm" className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full" />
              <div className="flex flex-col gap-1.5 px-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center justify-between px-1 pb-1">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="size-11 rounded-control" />
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-border pb-2 text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Solo para comparar con design/Main.dc.html. La tarjeta real va en features/catalog (F3). */
function ProductCardExample({
  name,
  detail,
  price,
  badge,
  soldOut = false,
}: {
  name: string;
  detail: string;
  price: string;
  badge?: ReactNode;
  soldOut?: boolean;
}) {
  return (
    <Card padding="sm" className="flex flex-col gap-2">
      <div
        className={`relative flex aspect-square items-center justify-center rounded-field ${
          soldOut ? "bg-bg text-ink-muted" : "bg-primary-soft text-primary-hover"
        }`}
      >
        <ImageIcon aria-hidden size={28} strokeWidth={1.6} />
        <div className="absolute top-2 left-2">{soldOut ? <Badge tone="danger">Agotado</Badge> : badge}</div>
      </div>
      <div className="px-1">
        <p className={`text-[15px] leading-tight font-semibold ${soldOut ? "text-ink-muted" : ""}`}>{name}</p>
        <p className="mt-0.5 text-[13px] text-ink-muted">{detail}</p>
      </div>
      <div className="flex items-center justify-between px-1 pb-1">
        <span className={`text-base font-bold ${soldOut ? "text-ink-muted" : ""}`}>{price}</span>
        {soldOut ? (
          <Button variant="secondary">Avisarme</Button>
        ) : (
          <Button iconOnly aria-label={`Agregar ${name}`}>
            <Plus aria-hidden />
          </Button>
        )}
      </div>
    </Card>
  );
}
