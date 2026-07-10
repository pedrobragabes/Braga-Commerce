# Issues — Milestone 0: Setup e documentação

## #1 Criar repositório Braga Commerce

- **Labels:** `type: chore`, `area: infra`, `priority: p0`, `scope: mvp`
- **Objetivo:** Inicializar repositório, `.gitignore` e convenções.
- **Aceite:** repositório privado, branch principal protegida e README visível.

## #2 Criar estrutura Next.js com TypeScript

- **Labels:** `type: chore`, `area: storefront`, `priority: p0`, `scope: mvp`
- **Objetivo:** App Router, TypeScript estrito e scripts locais.
- **Aceite:** `npm run dev`, `typecheck`, `lint` e `build` passam.
- **Dependências:** #1.

## #3 Configurar ESLint, Prettier e aliases

- **Labels:** `type: chore`, `area: infra`, `priority: p1`, `scope: mvp`
- **Objetivo:** Padronizar código e imports `@/`.
- **Aceite:** lint funciona e formato é reproduzível.
- **Dependências:** #2.

## #4 Configurar Tailwind CSS

- **Labels:** `type: chore`, `area: ui`, `priority: p1`, `scope: mvp`
- **Objetivo:** Preparar tokens e pipeline de estilos sem criar storefront final.
- **Aceite:** CSS é processado na página de setup.
- **Dependências:** #2.

## #5 Criar README inicial

- **Labels:** `type: docs`, `priority: p1`, `scope: mvp`
- **Objetivo:** Registrar stack, escopo e execução local.
- **Aceite:** instruções de instalação e scripts estão atuais.

## #6 Criar documentação base

- **Labels:** `type: docs`, `priority: p0`, `scope: mvp`
- **Objetivo:** Criar os documentos 00–10 e regras anti-feature creep.
- **Aceite:** produto, arquitetura, banco, API, pagamento, segurança, deploy, testes, GitHub e roadmap estão documentados.

## #7 Criar `.env.example`

- **Labels:** `type: security`, `area: infra`, `priority: p0`, `scope: mvp`
- **Objetivo:** Catalogar variáveis sem valores secretos.
- **Aceite:** clone novo sabe quais variáveis precisa configurar.

## #8 Configurar Prisma

- **Labels:** `type: feature`, `area: database`, `priority: p0`, `scope: mvp`
- **Objetivo:** Prisma 7, `prisma.config.ts`, schema PostgreSQL e client gerado.
- **Aceite:** `prisma generate` e migration funcionam com banco configurado.
- **Dependências:** #2, #7.

## #9 Configurar banco Supabase

- **Labels:** `type: infra`, `area: database`, `priority: p0`, `status: blocked`, `scope: mvp`
- **Objetivo:** Criar projeto, obter string segura e definir backup.
- **Aceite:** `DATABASE_URL` real conecta e migration é aplicada.
- **Dependências:** #8. Requer acesso à conta Supabase.

## #10 Criar seed inicial da PV Moda

- **Labels:** `type: feature`, `area: database`, `priority: p1`, `scope: mvp`
- **Objetivo:** Criar loja e categorias iniciais idempotentes.
- **Aceite:** seed repetido não duplica dados.
- **Dependências:** #8, #9.
