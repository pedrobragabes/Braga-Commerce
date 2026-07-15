import type { Metadata } from "next";
import { AuthCard, AuthMessage } from "../../../storefront/account/auth-card";
import { requireCustomerSession } from "../../../lib/customer-auth";
import { updateCustomerPassword } from "../auth-actions";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  await requireCustomerSession();
  const { erro } = await searchParams;
  return (
    <AuthCard eyebrow="Segurança" title="Escolha uma nova senha." description="Use uma senha diferente das anteriores e que você não reutiliza em outros serviços.">
      {erro ? <AuthMessage>As senhas precisam ser iguais e ter ao menos 8 caracteres.</AuthMessage> : null}
      <form action={updateCustomerPassword} className="account-form">
        <label className="field"><span>Nova senha</span><input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
        <label className="field"><span>Confirmar nova senha</span><input autoComplete="new-password" minLength={8} name="confirmation" required type="password" /></label>
        <button className="primary-button full" type="submit">Salvar nova senha</button>
      </form>
    </AuthCard>
  );
}
