"use client";

import { useState } from "react";

import { Button, Input, Modal, Select, Switch, useToast } from "@/shared/ui";

export function SwitchDemo() {
  const [delivery, setDelivery] = useState(true);

  return (
    <div className="flex flex-col divide-y divide-border">
      <Switch
        label="Delivery"
        description={delivery ? "Tus clientes pueden pedir con delivery." : "Solo recojo en tienda."}
        checked={delivery}
        onCheckedChange={setDelivery}
      />
      <Switch label="Pedidos por encargo" defaultChecked={false} />
      <Switch label="Función del plan Pro" description="Mejora tu plan para activarla." disabled />
    </div>
  );
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Abrir modal
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajustar stock"
        description="Polo básico · Talla M · Negro"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setOpen(false)}>Guardar</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Cantidad" type="number" inputMode="numeric" defaultValue={12} />
          <Select label="Motivo" defaultValue="" placeholder="Elige un motivo">
            <option value="restock">Llegó mercadería</option>
            <option value="correction">Corrección de conteo</option>
            <option value="damaged">Producto dañado</option>
          </Select>
        </div>
      </Modal>
    </>
  );
}

export function ToastDemo() {
  const { toast } = useToast();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        onClick={() => toast({ title: "Pedido marcado como listo", tone: "success" })}
      >
        Éxito
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            title: "No se pudo guardar",
            description: "Revisa tu conexión e inténtalo otra vez.",
            tone: "error",
          })
        }
      >
        Error
      </Button>
      <Button variant="secondary" onClick={() => toast({ title: "Copiamos el link de tu tienda" })}>
        Información
      </Button>
    </div>
  );
}
