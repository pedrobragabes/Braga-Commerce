import { redirect } from "next/navigation";
import { getCustomerSession } from "./customer-auth";
import { getDatabase } from "./database";

export async function requirePlatformSession() {
  const identity = await getCustomerSession();
  if (!identity) redirect("/entrar?next=/platform");
  const operator = await getDatabase().platformOperator.findFirst({ where: { authUserId: identity.authUserId, isActive: true } });
  if (!operator) redirect("/solicitar-loja?acesso=negado");
  return identity;
}
