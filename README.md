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

Configure `DATABASE_URL` em `.env` antes de criar a migration ou rodar o seed. O `docker-compose.yml` fornece PostgreSQL 16 local na URL padrão; Supabase também é suportado. O seed cria a PV Moda Masculina e as categorias iniciais. Veja [desenvolvimento local](docs/11-local-development.md).

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
```

## Documentação

A documentação de produto, arquitetura, banco, API, segurança, deploy e roadmap está em [`docs/`](docs/). O trabalho ativo e as issues do Milestone 0 estão em [`docs/github/issues/milestone-0.md`](docs/github/issues/milestone-0.md).

## Status

Milestone 0 — setup e documentação.
