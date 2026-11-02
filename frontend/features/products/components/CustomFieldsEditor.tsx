"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button, Input, Switch } from "@/shared/ui";

import {
  DEFAULT_FIELD_MAX_LENGTH,
  FIELD_SUGGESTIONS,
  newKey,
  PRODUCT_LIMITS,
  type ProductDraft,
  type ProductErrors,
} from "../lib/product-form";

type CustomFieldsEditorProps = {
  draft: ProductDraft;
  errors: ProductErrors;
  onChange: (draft: ProductDraft) => void;
};

/** Campos de texto que llena el cliente al pedir (Dedicatoria, Nombre para personalizar…). Máximo 5. */
export function CustomFieldsEditor({ draft, errors, onChange }: CustomFieldsEditorProps) {
  const fields = draft.customFields;
  const setField = (index: number, change: Partial<ProductDraft["customFields"][number]>) =>
    onChange({ ...draft, customFields: fields.map((f, i) => (i === index ? { ...f, ...change } : f)) });
  const add = (label = "") =>
    onChange({
      ...draft,
      customFields: [
        ...fields,
        { key: newKey("cf"), label, required: false, maxLength: String(DEFAULT_FIELD_MAX_LENGTH) },
      ],
    });
  const used = new Set(fields.map((f) => f.label.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, index) => (
        <div key={field.key} className="flex flex-col gap-2 rounded-control border border-border p-3.5">
          <div className="grid grid-cols-[1fr_6.5rem_auto] items-start gap-2">
            <Input
              label="Nombre del campo"
              placeholder="Dedicatoria"
              maxLength={PRODUCT_LIMITS.fieldLabel}
              value={field.label}
              onChange={(e) => setField(index, { label: e.target.value })}
              error={errors[`customFields.${index}.label`]}
            />
            <Input
              label="Máx. letras"
              inputMode="numeric"
              value={field.maxLength}
              onChange={(e) => setField(index, { maxLength: e.target.value })}
              error={errors[`customFields.${index}.maxLength`]}
            />
            <Button
              iconOnly
              variant="ghost"
              aria-label={`Quitar el campo ${field.label || index + 1}`}
              className="mt-7 text-danger"
              onClick={() => onChange({ ...draft, customFields: fields.filter((_, i) => i !== index) })}
            >
              <Trash2 />
            </Button>
          </div>
          <Switch
            label="Obligatorio"
            description={field.required ? "El cliente no puede pedir sin llenarlo." : "El cliente puede dejarlo vacío."}
            checked={field.required}
            onCheckedChange={(required) => setField(index, { required })}
          />
        </div>
      ))}

      {fields.length < PRODUCT_LIMITS.customFields && (
        <div className="flex flex-wrap gap-2">
          {FIELD_SUGGESTIONS.filter((s) => !used.has(s.toLowerCase())).map((label) => (
            <Button key={label} variant="secondary" onClick={() => add(label)}>
              <Plus aria-hidden />
              {label}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => add()}>
            <Plus aria-hidden />
            Otro campo
          </Button>
        </div>
      )}
    </div>
  );
}
