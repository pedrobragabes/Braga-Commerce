import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { getCustomerSession } from "../../lib/customer-auth";
import { getDatabase } from "../../lib/database";
import { ApplicationForm } from "./form";
import "../admin/admin.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Solicitar loja virtual", robots: { index: false, follow: false } };

export default async function RequestStorePage() {
  const identity = await getCustomerSession();
  const database = getDatabase();
  const plans = await database.plan.findMany({ where: { isPublished: true }, select: { id: true, name: true, version: true, conditions: true }, orderBy: { createdAt: "desc" } });
  const requests = identity ? await database.storeApplication.findMany({ where: { requesterAuthUserId: identity.authUserId }, orderBy: { createdAt: "desc" }, take: 20 }) : [];
  return <main className="admin-content"><h1>Sua loja virtual</h1><p>Solicite uma loja com catálogo e operação de pedidos. A contratação é assistida; a presença gratuita no ComércioBES continua independente.</p>
    {identity ? <ApplicationForm requestKey={randomUUID()} plans={plans} /> : <p><Link href="/entrar?next=/solicitar-loja">Entre com sua conta</Link> ou <Link href="/cadastro?next=/solicitar-loja">crie uma conta</Link> para solicitar.</p>}
    {requests.map((request) => <section className="admin-form-card" key={request.id}><h2>{request.storeName}</h2><p>{request.status === "PROVISIONED" ? "Loja criada. A ativação depende da vigência combinada." : request.status === "REJECTED" ? "Solicitação não aprovada." : "Aguardando análise."}</p>
      {request.status === "REJECTED" && request.decisionReason ? <p>{request.decisionReason}</p> : null}
      {request.status === "REQUESTED" && !request.planId ? <ApplicationForm requestKey={request.requestKey} applicationId={request.id} plans={plans} /> : null}
      {request.status === "PROVISIONED" ? <Link href="/admin/selecionar-loja">Abrir painel da loja</Link> : null}
    </section>)}
  </main>;
}
