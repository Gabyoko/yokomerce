"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError } from "@/shared/api/client";
import type { Category } from "@/shared/types";
import { Button, Input, Modal, useToast } from "@/shared/ui";

import { saveCategories } from "../api";
import { newKey } from "../lib/product-form";

type Row = { key: string; id?: string; name: string };

const toRows = (categories: Category[]): Row[] => categories.map((c) => ({ key: c.id, id: c.id, name: c.name }));

/** Crear, renombrar, ordenar y borrar categorías. La lista se guarda completa (SPEC.md, sección 5). */
export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => toRows(categories));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openModal() {
    setRows(toRows(categories));
    setErrors({});
    setOpen(true);
  }

  function move(index: number, delta: number) {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    if (!row) return;
    next.splice(index + delta, 0, row);
    setRows(next);
  }

  async function save() {
    const found: Record<string, string> = {};
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      const name = row.name.trim().toLowerCase();
      if (!name) found[`${i}.name`] = "Escribe el nombre.";
      else if (seen.has(name)) found[`${i}.name`] = "Está repetida.";
      seen.add(name);
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await saveCategories(rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), name: r.name.trim() })));
      toast({ tone: "success", title: "Guardamos las categorías" });
      setOpen(false);
      router.refresh();
    } catch (e) {
      const fields = e instanceof ApiError ? e.body.fields : null;
      if (typeof fields === "object" && fields !== null) setErrors(fields as Record<string, string>);
      toast({ tone: "error", title: "No pudimos guardar", description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={openModal}>
        Categorías
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Categorías"
        description="Ordenan tu catálogo. Si borras una, sus productos quedan sin categoría."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {rows.map((row, index) => (
            <li key={row.key} className="flex items-start gap-1">
              <Input
                label={`Categoría ${index + 1}`}
                hideLabel
                maxLength={40}
                wrapperClassName="flex-1"
                value={row.name}
                onChange={(e) => setRows(rows.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))}
                error={errors[`${index}.name`]}
              />
              <Button iconOnly variant="ghost" aria-label={`Subir ${row.name}`} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button
                iconOnly
                variant="ghost"
                aria-label={`Bajar ${row.name}`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                iconOnly
                variant="ghost"
                aria-label={`Borrar ${row.name}`}
                className="text-danger"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="text-sm text-ink-muted">Aún no tienes categorías.</p>}
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => setRows([...rows, { key: newKey("ca"), name: "" }])}
        >
          <Plus aria-hidden />
          Agregar categoría
        </Button>
      </Modal>
    </>
  );
}
