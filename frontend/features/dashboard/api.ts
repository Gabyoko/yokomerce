import { apiFetch } from "@/shared/api/client";
import type { DashboardStats } from "@/shared/types";

/** GET /me/stats */
export function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>("/me/stats");
}
