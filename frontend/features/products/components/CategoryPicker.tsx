"use client";

import { useState } from "react";

import { ApiError } from "@/shared/api/client";
import type { Category } from "@/shared/types";
import { Button, Input, Select, useToast } from "@/shared/ui";

import { saveCategories } from "../api";

const NEW = "__nueva__";

type CategoryPickerProps = {
  categories: Category[];
  value: string | null;
  onChange: (categoryId: string | null) => void;
  onCategoriesChange: (categories: Category[]) => void;
  error?: string;
};

/** Elegir categoría o crear una nueva sin salir del formulario. */
export function CategoryPicker({ categories, value, onChange, onCategoriesChange, error }: CategoryPickerProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Escribe el nombre de la categoría.");
      return;
    }
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      onChange(existing.id);
      setCreating(false);
      setName("");
      return;
    }
    setSaving(true);
    try {
      // La lista se guarda completa (SPEC.md, sección 5)
      const next = await saveCategories([...categories.map(({ id, name: n }) => ({ id, name: n })), { name: trimmed }]);
      onCategoriesChange(next);
      onChange(next.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())?.id ?? null);
      setCreating(false);
      setName("");
    } catch (e) {
      toast({ tone: "error", title: "No pudimos crear la categoría", description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Categoría"
        optional
        value={creating ? NEW : (value ?? "")}
        onChange={(e) => {
          if (e.target.value === NEW) {
            setCreating(true);
          } else {
            setCreating(false);
            onChange(e.target.value || null);
          }
        }}
        error={error}
      >
        <option value="">Sin categoría</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW}>+ Nueva categoría…</option>
      </Select>
      {creating && (
        <div className="flex flex-wrap items-start gap-2">
          <Input
            label="Nombre de la nueva categoría"
            maxLength={40}
            placeholder="Ej. Polos"
            wrapperClassName="min-w-48 flex-1"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
            error={nameError}
          />
          <Button className="mt-7" onClick={create} loading={saving}>
            Crear
          </Button>
          <Button variant="ghost" className="mt-7" onClick={() => setCreating(false)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
