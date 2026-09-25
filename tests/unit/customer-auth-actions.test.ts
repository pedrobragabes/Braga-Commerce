vi.mock("../../lib/store-context", () => ({ getStoreRequestOrigin: async () => "https://store.example.test" }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signUp: vi.fn(), resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn(),
}));
const rateLimit = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: provider }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.42' }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("../../lib/rate-limit", async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/rate-limit')>(), checkRateLimitIdentifier: rateLimit,
}));

import { loginCustomer, registerCustomer, requestPasswordReset, updateCustomerPassword, loginWithGoogle, logoutCustomer } from "../../app/(storefront)/auth-actions";
import { GET as callback } from "../../app/auth/callback/route";

const originalUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalGoogle = process.env.AUTH_GOOGLE_ENABLED;
beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ allowed: true });
  process.env.NEXT_PUBLIC_APP_URL = 'https://store.example.test';
  delete process.env.AUTH_GOOGLE_ENABLED;
});
afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = originalUrl;
  if (originalGoogle === undefined) delete process.env.AUTH_GOOGLE_ENABLED; else process.env.AUTH_GOOGLE_ENABLED = originalGoogle;
});
function form(values: Record<string, string>) { const result = new FormData(); Object.entries(values).forEach(([key, value]) => result.set(key, value)); return result; }
const verified = { id: 'auth-account-a', email: 'account@example.test', email_confirmed_at: '2026-09-25T00:00:00Z', user_metadata: {} };

describe('customer authentication actions', () => {
  it('preserva espaços da senha e retorna ao checkout após login verificado', async () => {
    provider.signInWithPassword.mockResolvedValue({ error: null, data: { user: verified } });
    await expect(loginCustomer(form({ email: ' ACCOUNT@example.test ', password: ' senha com espaço ', next: '/checkout' })))
      .rejects.toThrow('REDIRECT:/checkout');
    expect(provider.signInWithPassword).toHaveBeenCalledWith({ email: 'account@example.test', password: ' senha com espaço ' });
  });
  it('não autentica e-mail não confirmado e mantém destino seguro ao falhar', async () => {
    provider.signInWithPassword.mockResolvedValue({ error: null, data: { user: { ...verified, email_confirmed_at: null } } });
    await expect(loginCustomer(form({ email: verified.email, password: 'password123', next: '/checkout' })))
      .rejects.toThrow('REDIRECT:/entrar?erro=credenciais&next=%2Fcheckout');
  });
  it('cadastro envia confirmação sem truncar senha e não expõe sessão não verificada', async () => {
    provider.signUp.mockResolvedValue({ error: null, data: { session: null, user: { ...verified, email_confirmed_at: null } } });
    await expect(registerCustomer(form({ name: 'Conta sintética', email: verified.email, password: ' passphrase123 ', confirmation: ' passphrase123 ' })))
      .rejects.toThrow('REDIRECT:/entrar?status=confirme-email');
    expect(provider.signUp).toHaveBeenCalledWith(expect.objectContaining({ password: ' passphrase123 ', options: expect.objectContaining({ emailRedirectTo: 'https://store.example.test/auth/callback?next=/minha-conta' }) }));
  });
  it('proteção indisponível impede chamar o provedor', async () => {
    rateLimit.mockRejectedValue(new Error('database unavailable'));
    await expect(loginCustomer(form({ email: verified.email, password: 'password123', next: '/checkout' })))
      .rejects.toThrow('REDIRECT:/entrar?erro=protecao&next=%2Fcheckout');
    expect(provider.signInWithPassword).not.toHaveBeenCalled();
  });
  it('recuperação responde igual para conta desconhecida e erro do provedor', async () => {
    provider.resetPasswordForEmail.mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error('account does not exist'));
    for (let index = 0; index < 2; index += 1) {
      await expect(requestPasswordReset(form({ email: verified.email }))).rejects.toThrow('REDIRECT:/entrar?status=recuperacao-enviada');
    }
  });
  it('alteração de senha exige sessão verificada', async () => {
    provider.getUser.mockResolvedValue({ data: { user: null } });
    await expect(updateCustomerPassword(form({ password: 'password123', confirmation: 'password123' })))
      .rejects.toThrow('REDIRECT:/entrar?erro=sessao');
    expect(provider.updateUser).not.toHaveBeenCalled();
    provider.getUser.mockResolvedValue({ data: { user: verified } });
    provider.updateUser.mockResolvedValue({ error: null });
    await expect(updateCustomerPassword(form({ password: ' new password ', confirmation: ' new password ' })))
      .rejects.toThrow('REDIRECT:/minha-conta?status=senha-alterada');
    expect(provider.updateUser).toHaveBeenCalledWith({ password: ' new password ' });
  });
  it('Google desativado não invoca provider; logout termina a sessão', async () => {
    await expect(loginWithGoogle()).rejects.toThrow('REDIRECT:/entrar?erro=google');
    expect(provider.signInWithOAuth).not.toHaveBeenCalled();
    provider.signOut.mockResolvedValue({ error: null });
    await expect(logoutCustomer()).rejects.toThrow('REDIRECT:/entrar?status=saiu');
    expect(provider.signOut).toHaveBeenCalledOnce();
  });
  it('callback troca código PKCE e recusa destino externo sem devolver o código', async () => {
    provider.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await callback(new Request('https://store.example.test/auth/callback?code=synthetic-code&next=https://evil.example'));
    expect(response.headers.get('location')).toBe('https://store.example.test/minha-conta');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(provider.exchangeCodeForSession).toHaveBeenCalledWith('synthetic-code');
  });
  it('callback expirado ou indisponível falha com mensagem genérica', async () => {
    provider.exchangeCodeForSession.mockRejectedValue(new Error('secret payload'));
    const response = await callback(new Request('https://store.example.test/auth/callback?code=expired'));
    expect(response.headers.get('location')).toBe('https://store.example.test/entrar?erro=callback');
  });
});
