import { Suspense } from "react";

import { StoreBranding } from "@/features/catalog";
import { StoreShell } from "@/shared/ui/layout";

export default function StoreLayout({ children, params }: LayoutProps<"/[slug]">) {
  return (
    <StoreShell
      footer={
        <Suspense>
          <StoreBranding params={params} />
        </Suspense>
      }
    >
      {children}
    </StoreShell>
  );
}
