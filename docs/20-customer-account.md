# M8 — Conta do cliente

## Escopo

O consumidor pode criar conta e entrar com e-mail/senha ou Google, recuperar a
senha, sair e consultar em `/minha-conta` os pedidos feitos na PV Moda com o mesmo
e-mail verificado. O checkout convidado continua disponível.

Supabase Auth é a fonte da identidade. O navegador nunca escolhe `authUserId`,
`storeId` nem quais pedidos pode ler. A página protegida chama `auth.getUser()` no
servidor e filtra os pedidos pela loja e pelo e-mail normalizado da identidade.
Novos checkouts autenticados ignoram o e-mail enviado pelo formulário e usam o
e-mail da sessão.

## Rotas

- `/entrar`: e-mail/senha e Google.
- `/cadastro`: conta com confirmação de e-mail.
- `/recuperar-senha`: solicitação sem revelar se a conta existe.
- `/redefinir-senha`: atualização apenas com sessão de recuperação válida.
- `/auth/callback`: troca o código PKCE por sessão e aceita somente retorno interno.
- `/minha-conta`: perfil básico, logout e histórico da loja.

## Configuração manual do Google

1. No Google Cloud, criar/configurar a tela de consentimento OAuth e um cliente
   Web. Não registrar secret no repositório.
2. Adicionar como Authorized redirect URI a URL exibida pelo Supabase, no formato
   `https://PROJECT_REF.supabase.co/auth/v1/callback`.
3. Em Supabase > Authentication > Providers > Google, habilitar o provider e
   cadastrar Client ID e Client Secret.
4. Em Supabase > Authentication > URL Configuration, definir a URL pública da
   loja como Site URL e liberar por ambiente:
   - `http://localhost:3000/auth/callback`
   - URL de Preview usada no teste
   - `https://DOMINIO_FINAL/auth/callback`
5. Em Authentication > Email Templates/SMTP, revisar remetente, confirmação e
   recuperação antes do go-live. O SMTP padrão é adequado apenas para teste.

## Validação

- Cadastro envia confirmação e não revela conta existente.
- Login inválido é genérico e limitado por IP/conta.
- Callback externo ou `next=https://...` não causa open redirect.
- Recuperação permite definir uma nova senha e invalida o fluxo expirado.
- Google cria sessão sem token em logs ou URLs da aplicação.
- Conta A não vê pedido de outro e-mail ou outra loja.
- Checkout convidado permanece funcional.

## E-mail transacional no Development

Os pedidos com e-mail geram `ORDER_CREATED` na `EmailOutbox`. O route handler
agenda uma tentativa logo depois de responder, e o job de e-mails mantém as
retentativas. Para o Gmail de desenvolvimento, use `EMAIL_DRIVER=smtp`,
`SMTP_HOST=smtp.gmail.com`, porta `465`, TLS e uma senha de app em `SMTP_PASS`.
Nunca use a senha normal da conta nem registre a senha de app no repositório.
