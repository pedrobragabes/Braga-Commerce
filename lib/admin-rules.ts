import type { DeliveryMethod, FulfillmentStatus, InventoryStatus, PaymentStatus, UserRole } from "../generated/prisma/client";
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

export function canTransitionFulfillment(current: FulfillmentStatus, next: FulfillmentStatus) {
  return current === next || fulfillmentTransitions[current].has(next);
}

export function allowedFulfillmentTargets(current: FulfillmentStatus) {
  return [current, ...fulfillmentTransitions[current]];
}

type OrderOperationState = {
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  inventoryStatus: InventoryStatus;
  deliveryMethod: DeliveryMethod;
};

export function canOperateOrder(order: OrderOperationState, next: FulfillmentStatus) {
  if (!canTransitionFulfillment(order.fulfillmentStatus, next)) return false;
  if (next === order.fulfillmentStatus) return true;
  if (order.inventoryStatus === "REQUIRES_REVIEW") return false;
  if (next === "CANCELLED") return true;
  if (order.paymentStatus !== "PAID" || order.inventoryStatus !== "COMMITTED") return false;
  if (next === "READY_FOR_PICKUP" && order.deliveryMethod !== "LOCAL_PICKUP") return false;
  if (next === "SHIPPED" && order.deliveryMethod === "LOCAL_PICKUP") return false;
  return true;
}

export function allowedOrderFulfillmentTargets(order: OrderOperationState) {
  return allowedFulfillmentTargets(order.fulfillmentStatus).filter((next) => canOperateOrder(order, next));
}

export function visibleAdminSections(role: UserRole) {
  const sections: Array<{ href: string; label: string; permission: AdminPermission }> = [
    { href: "/admin", label: "Visão geral", permission: "dashboard:read" },
    { href: "/admin/produtos", label: "Produtos", permission: "catalog:read" },
    { href: "/admin/categorias", label: "Categorias", permission: "catalog:read" },
    { href: "/admin/pedidos", label: "Pedidos", permission: "orders:read" },
    { href: "/admin/relatorios", label: "Relatórios", permission: "orders:read" },
    { href: "/admin/configuracoes", label: "Configurações", permission: "settings:write" },
    { href: "/admin/tema", label: "Apresentação", permission: "settings:write" },
    { href: "/admin/integracoes", label: "Integrações", permission: "settings:write" },
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
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) && cents <= 2_147_483_647 ? cents : null;
}

export function parseAdminInteger(value: string, minimum = 0) {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= 2_147_483_647
    ? parsed
    : null;
}

export function parseAdminColor(value: string) {
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

export function parseAdminState(value: string) {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}
