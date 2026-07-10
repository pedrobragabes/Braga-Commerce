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
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Configure `DATABASE_URL` em `.env` antes de criar a migration ou rodar o seed. O seed cria a PV Moda Masculina e as categorias iniciais.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run db:studio
```

## Documentação

A documentação de produto, arquitetura, banco, API, segurança, deploy e roadmap está em [`docs/`](docs/). O trabalho ativo e as issues do Milestone 0 estão em [`docs/github/issues/milestone-0.md`](docs/github/issues/milestone-0.md).

## Status

Milestone 0 — setup e documentação.
