"use client";

import { Ruler } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/shared/ui";

/** Abre la guía de tallas del producto en el modal. */
export function SizeGuideButton({ url, productName }: { url: string; productName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="-ml-2 flex h-11 cursor-pointer items-center gap-2 self-start rounded-control px-2 text-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Ruler aria-hidden size={18} />
        Ver guía de tallas
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Guía de tallas" description={productName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Guía de tallas de ${productName}`} className="w-full rounded-field border border-border" />
      </Modal>
    </>
  );
}
