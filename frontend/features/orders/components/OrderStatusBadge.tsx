import { ORDER_STATUS_LABELS } from "@/shared/lib/orders";
import type { OrderStatus } from "@/shared/types";
import { Badge, type BadgeTone } from "@/shared/ui";

const TONES: Record<OrderStatus, BadgeTone> = {
  new: "warning",
  paid: "success",
  preparing: "primary",
  delivered: "neutral",
  cancelled: "danger",
  expired: "neutral",
};

export function OrderStatusBadge({ status, size = "sm" }: { status: OrderStatus; size?: "sm" | "md" }) {
  return (
    <Badge tone={TONES[status]} size={size} dot={status === "new"}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}
