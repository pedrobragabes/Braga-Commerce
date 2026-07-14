# Braga Commerce

E-commerce enxuto para pequenos comércios locais, com a **PV Moda Masculina**
como loja piloto. A aplicação reúne vitrine, carrinho, checkout sem cadastro,
pagamento via Mercado Pago e um painel operacional protegido por funções e loja.

> Estado atual: beta publicado e protegido por senha. O código do MVP está
> funcional, mas o go-live comercial ainda depende de domínio, backup
> restaurável, credenciais Sandbox do Mercado Pago, aprovação jurídica e
> configuração do remetente de e-mail.

## O que já existe

- Vitrine responsiva com categorias, produtos, variações e carrinho persistente.
- Cotação e checkout validados no servidor; preço e disponibilidade nunca são
  aceitos do navegador.
- Reserva atômica de estoque por 30 minutos, expiração e liberação automática.
- Pedido, preferência Mercado Pago, webhook assinado e transições idempotentes.
- Painel com autenticação Supabase, RBAC, catálogo, estoque, pedidos, relatórios
  e CSV protegido contra fórmulas.
- Upload JPG, PNG e WebP com validação de conteúdo, tamanho e propriedade da loja.
- Rate limiting persistente, health check, logs estruturados sem PII e monitor de
  disponibilidade.
- Outbox de e-mail com tentativas, recuperação de processamento interrompido e
  idempotência no provedor.
- Páginas preliminares de privacidade e trocas, ainda sujeitas à aprovação.

Não fazem parte do MVP atual: marketplace, multi-loja completo, ERP, cupom,
frete nacional automatizado e emissão fiscal. O escopo detalhado está em
[`docs/01-mvp-scope.md`](docs/01-mvp-scope.md).

## Stack e arquitetura

- Next.js 16, React 19, TypeScript e App Router.
- PostgreSQL com Prisma ORM.
- Supabase para banco, autenticação administrativa e Storage.
- Mercado Pago Checkout Pro.
- Zod para contratos de entrada; Vitest e ESLint para qualidade.
- Vercel para build e hospedagem; GitHub Actions para qualidade e operação.

O código separa aplicação (`app/`), regras de domínio e integrações (`lib/`),
experiência da loja (`storefront/`), banco (`prisma/`), automações (`scripts/`)
e testes (`tests/`). Decisões e fluxos estão em
[`docs/02-architecture.md`](docs/02-architecture.md).

## Requisitos

- Node.js 20.19 ou superior e npm.
- Docker, caso use o PostgreSQL local incluído.
- Contas Supabase, Vercel e Mercado Pago apenas para integrações hospedadas.

## Início rápido

```powershell
npm install
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

No macOS/Linux, substitua `Copy-Item` por `cp`. A URL padrão do
`docker-compose.yml` aponta para PostgreSQL 16 local. O seed cria a PV Moda com
categorias, produtos e variações de demonstração. Instruções completas:
[`docs/11-local-development.md`](docs/11-local-development.md).

## Variáveis de ambiente

Use `.env.example` como inventário; arquivos `.env*` reais não devem ser
versionados.

| Grupo        | Variáveis                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Aplicação    | `NEXT_PUBLIC_APP_URL`, `APP_ENV`                                                                                      |
| Banco        | `DATABASE_URL`; `DATABASE_SSL_CA` para validar a CA e o hostname em conexões Supabase                                 |
| Supabase     | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`                              |
| Mercado Pago | `MERCADO_PAGO_ENV`, `MERCADO_PAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET` |
| Proteções    | `RATE_LIMIT_SECRET`, `JOB_SECRET`, `SITE_ACCESS_PASSWORD`, `SITE_ACCESS_SECRET`                                       |
| E-mail       | `EMAIL_DRIVER`, `EMAIL_FROM`, `RESEND_API_KEY`                                                                        |
| Storage      | `STORAGE_BUCKET`                                                                                                      |
| Bootstrap    | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_ROLE`                                                           |

Somente variáveis prefixadas por `NEXT_PUBLIC_` podem chegar ao navegador.
Secrets devem existir apenas no ambiente do servidor. Em produção, use valores
aleatórios longos e diferentes entre ambientes.

Para validação TLS completa no Supabase, baixe o certificado do projeto em
**Database Settings > SSL Configuration**, salve o PEM em
`DATABASE_SSL_CA` e use uma conexão com TLS. Sem essa variável, o pooler continua
criptografado, mas a cadeia do servidor não é validada pelo processo Node; isso
deve ser resolvido antes de remover o gate beta.

## Qualidade e segurança

Antes de publicar qualquer alteração:

```powershell
npm audit --audit-level=moderate
npm test
npm run lint
npm run typecheck
npm run build
```

O workflow `Quality gate` executa esses controles em pull requests e pushes para
`main`. Dependabot monitora npm e GitHub Actions; ações externas são fixadas por
SHA e scripts de instalação npm são permitidos por pacote e versão.

Garantias importantes:

- preço, frete, estoque, pagamento e permissão são recalculados no servidor;
- reservas usam updates condicionais dentro de transação;
- webhooks são autenticados antes do parse e o pagamento é consultado no provedor;
- IDs de loja são aplicados nas operações administrativas;
- buckets de rate limit armazenam somente HMAC, não o endereço de rede;
- logs aceitam uma lista restrita de campos, removem controles e limitam tamanho;
- o acesso beta usa cookie `HttpOnly`, `Secure` em produção e token HMAC com
  expiração máxima de 12 horas;
- o banco aplica constraints para valores monetários, estoque e totais de pedido.

Nenhuma auditoria torna software “100% seguro”. Os riscos residuais e o checklist
de produção permanecem documentados em
[`docs/06-security-checklist.md`](docs/06-security-checklist.md) e
[`docs/16-m6-deploy-beta.md`](docs/16-m6-deploy-beta.md).

## Scripts úteis

| Comando                                            | Uso                        |
| -------------------------------------------------- | -------------------------- |
| `npm run dev` / `npm run build` / `npm start`      | Desenvolvimento e execução |
| `npm test` / `npm run lint` / `npm run typecheck`  | Portas de qualidade        |
| `npm run db:migrate` / `npm run db:migrate:deploy` | Migrations local/produção  |
| `npm run db:seed` / `npm run db:studio`            | Dados iniciais e inspeção  |
| `npm run admin:bootstrap` / `npm run admin:remove` | Operador inicial           |
| `npm run storage:setup` / `npm run storage:smoke`  | Bucket de imagens          |
| `npm run admin:smoke:*` / `npm run images:smoke:*` | Smokes operacionais M4/M5  |

Scripts de smoke podem criar dados temporários. Sempre execute o comando
`cleanup` correspondente e nunca use credenciais reais na linha de comando ou
em logs compartilhados.

## Deploy e operação

Production usa `npm run vercel-build`, que aplica migrations somente quando
`VERCEL_ENV=production`. Preview e Development têm banco não produtivo separado.
O health check público é `/api/health`.

Automações existentes:

- `Quality gate`: audit, testes, lint, typecheck e build.
- `Availability monitor`: health check a cada 30 minutos.
- `Expire pending orders`: libera reservas e processa o outbox.
- `Encrypted database backup`: dump diário cifrado, pendente de secrets e teste
  de restauração.

O procedimento de deploy, rollback, smoke e go-live está em
[`docs/16-m6-deploy-beta.md`](docs/16-m6-deploy-beta.md).

## Situação dos milestones

- M0, M1, M2, M4 e M5: concluídos.
- M3: implementação pronta; aceite bloqueado por credenciais Sandbox e testes do
  Mercado Pago.
- M6: beta publicado; domínio, restauração de backup e pedido ponta a ponta ainda
  estão abertos.
- M7: melhorias pós-MVP e decisões comerciais em andamento.

As issues do GitHub são a fonte de verdade para aceite. Uma issue só deve ser
fechada com critérios comprovados em comentário, conforme
[`docs/12-delivery-workflow.md`](docs/12-delivery-workflow.md).

## Documentação

- Produto e escopo: [`docs/00-product-vision.md`](docs/00-product-vision.md) e
  [`docs/01-mvp-scope.md`](docs/01-mvp-scope.md).
- Arquitetura, banco e APIs: [`docs/02-architecture.md`](docs/02-architecture.md),
  [`docs/03-database.md`](docs/03-database.md) e
  [`docs/04-api-contracts.md`](docs/04-api-contracts.md).
- Pagamentos e segurança: [`docs/05-payment-flow.md`](docs/05-payment-flow.md) e
  [`docs/06-security-checklist.md`](docs/06-security-checklist.md).
- Testes e entrega: [`docs/08-testing.md`](docs/08-testing.md) e
  [`docs/12-delivery-workflow.md`](docs/12-delivery-workflow.md).
- Operação beta e pós-MVP: [`docs/16-m6-deploy-beta.md`](docs/16-m6-deploy-beta.md)
  e [`docs/17-m7-plan.md`](docs/17-m7-plan.md).
