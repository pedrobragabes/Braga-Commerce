# Braga Commerce

Loja virtual low cost para pequenos comércios locais. Projeto piloto: **PV Moda Masculina**.

## Stack

- Next.js + TypeScript + App Router
- PostgreSQL + Prisma ORM
- Supabase (banco, autenticação e storage em produção)
- Mercado Pago Checkout Pro
- Tailwind CSS + Zod

## MVP

Catálogo, categorias, variações, estoque simples, carrinho, checkout, pedido, Mercado Pago com webhook, painel administrativo e upload de imagens. Marketplace, multi-tenant completo, ERP, cupons complexos e frete avançado não fazem parte do MVP.

## Rodando localmente

```bash
npm install
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Configure `DATABASE_URL` em `.env` antes de criar a migration ou rodar o seed. O `docker-compose.yml` fornece PostgreSQL 16 local na URL padrão; Supabase também é suportado. O seed cria a PV Moda Masculina com seis categorias, seis produtos e variações de tamanho/cor. Veja [desenvolvimento local](docs/11-local-development.md).

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run db:up
npm run db:migrate
npm run db:migrate:deploy
npm run db:studio
npm run admin:bootstrap
npm run admin:smoke:setup
npm run admin:smoke:verify
npm run admin:smoke:cleanup
npm run storage:setup
npm run storage:smoke
npm run images:smoke:setup
npm run images:smoke:verify
npm run images:smoke:cleanup
```

## Documentação

A documentação de produto, arquitetura, banco, API, segurança, deploy e roadmap
está em [`docs/`](docs/). O formato obrigatório de milestones, issues, tarefas,
evidências e publicação está em [`docs/12-delivery-workflow.md`](docs/12-delivery-workflow.md).

## Status

Milestones 0, 1, 2, 4 e 5 concluídos. M3 aguarda credenciais sandbox.
