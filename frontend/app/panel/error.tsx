"use client";

import { WifiOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/shared/ui";

export default function PanelError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <WifiOff aria-hidden size={36} className="text-ink-muted" />
      <h1 className="text-2xl font-bold">No pudimos cargar esta sección</h1>
      <p className="max-w-sm text-ink-muted">Revisa tu conexión a internet e inténtalo otra vez.</p>
      <Button variant="secondary" onClick={() => retry()}>
        Intentar de nuevo
      </Button>
    </div>
  );
}
