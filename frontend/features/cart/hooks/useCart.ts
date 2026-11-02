"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  addToCart,
  cartCount,
  cartStorageKey,
  type CartItem,
  parseCart,
  removeLine,
  setQuantity as setLineQuantity,
} from "../lib/cart";
import { BRAND } from "@/shared/lib/brand";

const CHANGE_EVENT = `${BRAND.storagePrefix}:carrito`;
const EMPTY: CartItem[] = [];

/** Si localStorage no se puede usar (modo privado, bloqueado), el carrito vive en memoria mientras la página esté abierta. */
const memory = new Map<string, string>();

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function writeRaw(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// useSyncExternalStore necesita el mismo arreglo mientras el texto guardado no cambie
const parsed = new Map<string, { raw: string | null; items: CartItem[] }>();

function snapshot(key: string): CartItem[] {
  const raw = readRaw(key);
  const cached = parsed.get(key);
  if (cached && cached.raw === raw) return cached.items;
  const items = parseCart(raw);
  parsed.set(key, { raw, items });
  return items;
}

const noopSubscribe = () => () => {};

function subscribe(onChange: () => void) {
  // "storage" avisa de cambios hechos en otras pestañas
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Carrito de una tienda, guardado en localStorage.
 * En el servidor y en el primer render del navegador está vacío; luego se llena con lo guardado.
 * `ready` es false hasta ese momento, para mostrar "cargando" en vez de "carrito vacío".
 */
export function useCart(slug: string) {
  const key = cartStorageKey(slug);
  const items = useSyncExternalStore(
    subscribe,
    () => snapshot(key),
    () => EMPTY,
  );

  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const update = useCallback(
    (change: (current: CartItem[]) => CartItem[]) => writeRaw(key, JSON.stringify(change(snapshot(key)))),
    [key],
  );

  return {
    items,
    ready,
    count: cartCount(items),
    add: useCallback((item: CartItem) => update((current) => addToCart(current, item)), [update]),
    setQuantity: useCallback((index: number, quantity: number) => update((current) => setLineQuantity(current, index, quantity)), [update]),
    remove: useCallback((index: number) => update((current) => removeLine(current, index)), [update]),
    replace: useCallback((next: CartItem[]) => update(() => next), [update]),
    clear: useCallback(() => update(() => []), [update]),
  };
}
