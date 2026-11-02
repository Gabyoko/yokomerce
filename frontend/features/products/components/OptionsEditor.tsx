"use client";

import { Lightbulb, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Button, Input } from "@/shared/ui";

import {
  addOption,
  addOptionValues,
  OPTION_SUGGESTIONS,
  PRODUCT_LIMITS,
  type ProductDraft,
  type ProductErrors,
  removeOption,
  removeOptionValue,
  renameOption,
} from "../lib/product-form";

type OptionsEditorProps = {
  draft: ProductDraft;
  errors: ProductErrors;
  onChange: (draft: ProductDraft) => void;
  /** Ayuda para quien dijo en el registro que sus productos tienen variantes. */
  showHelp: boolean;
};

/** Opciones del producto (Talla, Color, Sabor… o la que el dueño quiera). Máximo 3. */
export function OptionsEditor({ draft, errors, onChange, showHelp }: OptionsEditorProps) {
  const used = new Set(draft.options.map((o) => o.name.trim().toLowerCase()));
  const suggestions = OPTION_SUGGESTIONS.filter((s) => !used.has(s.name.toLowerCase()));
  const canAdd = draft.options.length < PRODUCT_LIMITS.options;

  return (
    <div className="flex flex-col gap-4">
      {showHelp && draft.options.length === 0 && (
        <div className="flex gap-3 rounded-control bg-primary-soft p-3.5 text-sm">
          <Lightbulb aria-hidden size={20} className="mt-0.5 shrink-0 text-primary" />
          <p>
            Si vendes el mismo producto en varias tallas, colores o tamaños, agrega una opción. Armamos todas las
            combinaciones y a cada una le pones su precio y su stock.
          </p>
        </div>
      )}

      {draft.options.map((option, index) => (
        <OptionRow key={option.key} draft={draft} index={index} errors={errors} onChange={onChange} />
      ))}
      {errors.options && (
        <p data-error className="text-[13px] font-medium text-danger">
          {errors.options}
        </p>
      )}

      {canAdd && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-muted">{draft.options.length === 0 ? "Agregar una opción" : "Agregar otra opción"}</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s.name} variant="secondary" onClick={() => onChange(addOption(draft, s.name))}>
                <Plus aria-hidden />
                {s.name}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => onChange(addOption(draft))}>
              <Plus aria-hidden />
              Otra
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  draft,
  index,
  errors,
  onChange,
}: {
  draft: ProductDraft;
  index: number;
  errors: ProductErrors;
  onChange: (draft: ProductDraft) => void;
}) {
  const [text, setText] = useState("");
  const option = draft.options[index]!;
  const suggestion = OPTION_SUGGESTIONS.find((s) => s.name.toLowerCase() === option.name.trim().toLowerCase());
  const pending = suggestion?.values.filter((v) => !option.values.some((ov) => ov.value.toLowerCase() === v.toLowerCase())) ?? [];

  function addText() {
    if (!text.trim()) return;
    onChange(addOptionValues(draft, index, text));
    setText("");
  }

  return (
    <div className="flex flex-col gap-3 rounded-control border border-border p-3.5">
      <div className="flex items-start gap-2">
        <Input
          label="Nombre de la opción"
          placeholder="Talla, Color, Sabor…"
          maxLength={PRODUCT_LIMITS.optionName}
          wrapperClassName="flex-1"
          value={option.name}
          onChange={(e) => onChange(renameOption(draft, index, e.target.value))}
          error={errors[`options.${index}.name`]}
        />
        <Button
          iconOnly
          variant="ghost"
          aria-label={`Quitar la opción ${option.name || index + 1}`}
          className="mt-7 text-danger"
          onClick={() => onChange(removeOption(draft, index))}
        >
          <Trash2 />
        </Button>
      </div>

      {option.values.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`Valores de ${option.name || "la opción"}`}>
          {option.values.map((value, valueIndex) => (
            <li key={value.value} className="flex items-center gap-1 rounded-full border border-border bg-bg py-1 pr-1 pl-3 text-sm font-semibold">
              {value.value}
              <button
                type="button"
                aria-label={`Quitar ${value.value}`}
                onClick={() => onChange(removeOptionValue(draft, index, valueIndex))}
                className="relative flex size-7 cursor-pointer items-center justify-center rounded-full text-ink-muted after:absolute after:-inset-2 after:content-[''] hover:bg-border hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
              >
                <X aria-hidden size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-start gap-2">
        <Input
          label="Agregar valores"
          hideLabel
          placeholder={suggestion?.values.length ? `Ej. ${suggestion.values.slice(0, 3).join(", ")}` : "Escribe y presiona Enter (puedes separar con comas)"}
          maxLength={200}
          wrapperClassName="flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addText();
            }
          }}
          error={errors[`options.${index}.values`]}
        />
        <Button variant="secondary" onClick={addText} disabled={!text.trim()}>
          Agregar
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] text-ink-muted">Sugerencias:</span>
          {pending.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(addOptionValues(draft, index, value))}
              className="min-h-11 cursor-pointer rounded-full border border-dashed border-border-strong px-3 text-[13px] font-semibold text-ink-muted hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              + {value}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
