import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthMessage } from "../../../storefront/account/auth-card";
import { requestPasswordReset } from "../auth-actions";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false, follow: false } };

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <AuthCard eyebrow="Recuperação" title="Vamos abrir a porta de novo." description="Informe seu e-mail. Se houver uma conta, enviaremos um link seguro para criar outra senha."
      aside={<p>Lembrou a senha? <Link href="/entrar">Voltar ao login</Link></p>}>
      {erro ? <AuthMessage>{erro === "limite" ? "Muitas tentativas. Aguarde alguns minutos." : "Informe um e-mail válido."}</AuthMessage> : null}
      <form action={requestPasswordReset} className="account-form">
        <label className="field"><span>E-mail da conta</span><input autoComplete="email" name="email" required type="email" /></label>
        <button className="primary-button full" type="submit">Enviar link de recuperação</button>
      </form>
    </AuthCard>
  );
}
