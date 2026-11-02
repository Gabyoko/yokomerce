"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/shared/api/client";
import { formatOrderNumber } from "@/shared/lib/orders";
import type { Order } from "@/shared/types";
import { useToast } from "@/shared/ui";

import { cancelOrder, confirmPayment, markDelivered, startPreparing } from "../api";
import type { OrderAction } from "../lib/order-flow";

const RUN: Record<OrderAction | "cancel", (id: string) => Promise<Order>> = {
  confirm: confirmPayment,
  prepare: startPreparing,
  deliver: markDelivered,
  cancel: cancelOrder,
};

const DONE: Record<OrderAction | "cancel", string> = {
  confirm: "Pago confirmado",
  prepare: "Pedido en preparación",
  deliver: "Pedido entregado",
  cancel: "Pedido cancelado",
};

/**
 * Cambia el estado de un pedido. La API aplica las reglas de stock; luego se vuelven
 * a pedir los datos con router.refresh() (no se recalcula nada en el navegador).
 */
export function useOrderAction() {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function run(order: Pick<Order, "id" | "number">, action: OrderAction | "cancel"): Promise<boolean> {
    setPendingId(order.id);
    try {
      await RUN[action](order.id);
      toast({ tone: "success", title: `${DONE[action]} · ${formatOrderNumber(order.number)}` });
      router.refresh();
      return true;
    } catch (error) {
      toast({
        tone: "error",
        title: "No pudimos cambiar el pedido",
        description: error instanceof ApiError ? error.message : "Revisa tu conexión e inténtalo otra vez.",
      });
      router.refresh();
      return false;
    } finally {
      setPendingId(null);
    }
  }

  return { run, pendingId };
}
