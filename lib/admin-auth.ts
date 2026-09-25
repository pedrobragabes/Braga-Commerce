import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { UserRole } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { createSupabaseServerClient } from "./supabase/server";

export type AdminPermission =
  | "dashboard:read"
  | "catalog:read"
  | "catalog:write"
  | "images:write"
  | "inventory:write"
  | "orders:read"
  | "orders:write"
  | "settings:write";

const rolePermissions: Record<UserRole, ReadonlySet<AdminPermission>> = {
  OWNER: new Set([
    "dashboard:read", "catalog:read", "catalog:write", "images:write", "inventory:write",
    "orders:read", "orders:write", "settings:write",
  ]),
  ADMIN: new Set([
    "dashboard:read", "catalog:read", "catalog:write", "images:write", "inventory:write",
    "orders:read", "orders:write", "settings:write",
  ]),
  STAFF: new Set([
    "dashboard:read", "catalog:read", "inventory:write", "orders:read", "orders:write",
  ]),
};

export type AdminSession = {
  authUserId: string;
  userId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeDomain?: string | null;
  name: string;
  email: string;
  role: UserRole;
};

export function can(role: UserRole, permission: AdminPermission) {
  return rolePermissions[role].has(permission);
}

async function resolveOperator(authUser: SupabaseUser): Promise<AdminSession | null> {
  const database = getDatabase();
  const operators = await database.user.findMany({
    where: {
      isActive: true,
      authUserId: authUser.id,
    },
    select: {
      id: true,
      authUserId: true,
      storeId: true,
      name: true,
      email: true,
      role: true,
      store: { select: { name: true, slug: true, domain: true, isActive: true } },
    },
  });

  const selectedStore = operators.length > 1 ? (await cookies()).get("braga-admin-store")?.value : null;
  const operator = operators.length === 1 ? operators[0] : operators.find((candidate) => candidate.storeId === selectedStore);
  if (!operator) return null;

  return {
    authUserId: authUser.id,
    userId: operator.id,
    storeId: operator.storeId,
    storeName: operator.store.name,
    storeSlug: operator.store.slug,
    storeDomain: operator.store.domain,
    name: operator.name,
    email: operator.email,
    role: operator.role,
  };
}

export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return resolveOperator(data.user);
});

export async function requireAdminSession(permission?: AdminPermission) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/selecionar-loja");
  if (permission && !can(session.role, permission)) redirect("/admin?forbidden=1");
  return session;
}

export async function requireAdminAction(permission: AdminPermission) {
  const session = await getAdminSession();
  if (!session) throw new Error("AUTH_REQUIRED");
  if (!can(session.role, permission)) throw new Error("FORBIDDEN");
  return session;
}

export async function resolveSignedInOperator(authUser: SupabaseUser) {
  return resolveOperator(authUser);
}
