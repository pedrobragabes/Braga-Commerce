import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthMessage } from "../../../storefront/account/auth-card";
import { loginWithGoogle, registerCustomer } from "../auth-actions";

export const metadata: Metadata = { title: "Criar conta", robots: { index: false, follow: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <AuthCard eyebrow="Novo por aqui" title="Sua história com a PV começa aqui." description="Crie uma conta para acompanhar seus pedidos. Você continua livre para comprar como convidado."
      aside={<p>Já tem conta? <Link href="/entrar">Entrar agora</Link></p>}>
      {erro ? <AuthMessage>{erro === "limite" ? "Muitas tentativas. Aguarde alguns minutos." : erro === "protecao" ? "A proteção de acesso está indisponível." : "Revise os dados e tente novamente."}</AuthMessage> : null}
      <form action={registerCustomer} className="account-form">
        <label className="field"><span>Nome</span><input autoComplete="name" minLength={2} name="name" required /></label>
        <label className="field"><span>E-mail</span><input autoComplete="email" name="email" required type="email" /></label>
        <label className="field"><span>Senha <small>mínimo de 8 caracteres</small></span><input autoComplete="new-password" minLength={8} name="password" required type="password" /></label>
        <label className="field"><span>Confirmar senha</span><input autoComplete="new-password" minLength={8} name="confirmation" required type="password" /></label>
        <button className="primary-button full" type="submit">Criar minha conta</button>
      </form>
      <div className="account-divider"><span>ou</span></div>
      <form action={loginWithGoogle}><button className="google-button" type="submit"><span>G</span> Cadastrar com Google</button></form>
    </AuthCard>
  );
}
