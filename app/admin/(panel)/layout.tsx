import type { ReactNode } from "react";
import { requireAdminSession } from "../../../lib/admin-auth";
import { AdminShell } from "../components/admin-shell";
import "../admin.css";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession("dashboard:read");
  return <AdminShell session={session}>{children}</AdminShell>;
}
