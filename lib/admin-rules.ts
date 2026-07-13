import type { FulfillmentStatus, UserRole } from "../generated/prisma/client";
import type { AdminPermission } from "./admin-auth";
import { can } from "./admin-auth";

const fulfillmentTransitions: Record<FulfillmentStatus, ReadonlySet<FulfillmentStatus>> = {
  NOT_FULFILLED: new Set(["PREPARING", "CANCELLED"]),
  PREPARING: new Set(["READY_FOR_PICKUP", "SHIPPED", "CANCELLED"]),
  READY_FOR_PICKUP: new Set(["DELIVERED", "CANCELLED"]),
  SHIPPED: new Set(["DELIVERED", "CANCELLED"]),
  DELIVERED: new Set(),
  CANCELLED: new Set(),
};

export function canTransitionFulfillment(
  current: FulfillmentStatus,
  next: FulfillmentStatus,
) {
  return current === next || fulfillmentTransitions[current].has(next);
}

export function allowedFulfillmentTargets(current: FulfillmentStatus) {
  return [current, ...fulfillmentTransitions[current]];
}

export function visibleAdminSections(role: UserRole) {
  const sections: Array<{ href: string; label: string; permission: AdminPermission }> = [
    { href: "/admin", label: "Visão geral", permission: "dashboard:read" },
    { href: "/admin/produtos", label: "Produtos", permission: "catalog:read" },
    { href: "/admin/categorias", label: "Categorias", permission: "catalog:read" },
    { href: "/admin/pedidos", label: "Pedidos", permission: "orders:read" },
    { href: "/admin/configuracoes", label: "Configurações", permission: "settings:write" },
  ];
  return sections.filter((section) => can(role, section.permission));
}

export function slugifyAdminValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseAdminMoney(value: string) {
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
