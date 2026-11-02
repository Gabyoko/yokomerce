import type { Metadata } from "next";
import { Suspense } from "react";

import { NewOrdersBadge } from "@/features/orders";
import { MyPlanCard } from "@/features/plans";
import { MyDevStoreSwitcher, MyStoreCard } from "@/features/store-settings";
import { PanelCardSkeleton, PanelShell } from "@/shared/ui/layout";
import { pageTitle } from "@/shared/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Panel"),
  robots: { index: false },
};

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <PanelShell
      storeCard={
        <Suspense fallback={<PanelCardSkeleton />}>
          <MyStoreCard />
        </Suspense>
      }
      planCard={
        <Suspense fallback={<PanelCardSkeleton className="h-28" />}>
          <MyPlanCard />
        </Suspense>
      }
      ordersBadge={{
        sidebar: (
          <Suspense>
            <NewOrdersBadge variant="sidebar" />
          </Suspense>
        ),
        bottom: (
          <Suspense>
            <NewOrdersBadge variant="bottom" />
          </Suspense>
        ),
      }}
      sidebarFooter={
        <Suspense>
          <MyDevStoreSwitcher />
        </Suspense>
      }
    >
      {children}
    </PanelShell>
  );
}
