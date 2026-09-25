import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabase } from "../../../lib/database";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

async function selectStore(form: FormData) {
  "use server";
  const { data } = await (await createSupabaseServerClient()).auth.getUser();
  if (!data.user) redirect("/admin/login");
  const storeId = String(form.get("storeId") ?? "");
  const membership = await getDatabase().user.findFirst({ where: { authUserId: data.user.id, storeId, isActive: true } });
  if (!membership) redirect("/admin/selecionar-loja?erro=permissao");
  (await cookies()).set("braga-admin-store", storeId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 86400 });
  redirect("/admin");
}

export default async function SelectStorePage() {
  const { data } = await (await createSupabaseServerClient()).auth.getUser();
  if (!data.user) redirect("/admin/login");
  const memberships = await getDatabase().user.findMany({ where: { authUserId: data.user.id, isActive: true }, select: { storeId: true, store: { select: { name: true } } } });
  return <main className="admin-form-card"><h1>Escolha sua loja</h1><p>Você só pode operar lojas com vínculo autorizado.</p>
    {memberships.length ? <form action={selectStore}><label><span>Loja</span><select name="storeId">{memberships.map((membership) => <option key={membership.storeId} value={membership.storeId}>{membership.store.name}</option>)}</select></label><button className="admin-button primary">Continuar</button></form>
      : <p>Sua conta não tem vínculo de operação. Solicite acesso ao responsável.</p>}
  </main>;
}
