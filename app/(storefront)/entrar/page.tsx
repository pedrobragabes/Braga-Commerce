import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, AuthMessage } from "../../../storefront/account/auth-card";
import { loginCustomer, loginWithGoogle } from "../auth-actions";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };

const errors: Record<string, string> = {
  dados: "Revise o e-mail e a senha.",
  credenciais: "E-mail ou senha incorretos.",
  limite: "Muitas tentativas. Aguarde alguns minutos.",
  protecao: "A proteção de acesso está indisponível. Tente novamente.",
  google: "Não foi possível iniciar o acesso com Google.",
  callback: "O link de acesso expirou ou não pôde ser confirmado.",
  sessao: "Sua sessão expirou. Entre novamente.",
};
const statuses: Record<string, string> = {
  "confirme-email": "Enviamos um link para confirmar seu e-mail antes do primeiro acesso.",
  "recuperacao-enviada": "Se o e-mail estiver cadastrado, você receberá o link de recuperação.",
  saiu: "Você saiu da sua conta.",
};

export default async function CustomerLoginPage({ searchParams }: {
  searchParams: Promise<{ erro?: string; status?: string; next?: string }>;
}) {
  const query = await searchParams;
  return (
    <AuthCard eyebrow="Sua área" title="Que bom ter você de volta." description="Entre para acompanhar pedidos e manter suas compras reunidas em um só lugar."
      aside={<p>Ainda não tem conta? <Link href="/cadastro">Criar minha conta</Link></p>}>
      {query.erro && errors[query.erro] ? <AuthMessage>{errors[query.erro]}</AuthMessage> : null}
      {query.status && statuses[query.status] ? <AuthMessage kind="success">{statuses[query.status]}</AuthMessage> : null}
      <form action={loginCustomer} className="account-form">
        <input name="next" type="hidden" value={query.next ?? "/minha-conta"} />
        <label className="field"><span>E-mail</span><input autoComplete="email" name="email" required type="email" /></label>
        <label className="field"><span>Senha</span><input autoComplete="current-password" minLength={8} name="password" required type="password" /></label>
        <div className="account-form-meta"><Link href="/recuperar-senha">Esqueci minha senha</Link></div>
        <button className="primary-button full" type="submit">Entrar na minha conta</button>
      </form>
      <div className="account-divider"><span>ou</span></div>
      <form action={loginWithGoogle}><button className="google-button" type="submit"><span>G</span> Continuar com Google</button></form>
    </AuthCard>
  );
}
