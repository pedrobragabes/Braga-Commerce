# Desenvolvimento local

## PostgreSQL local

O projeto inclui PostgreSQL 16 para desenvolvimento via Docker Compose. A URL padrão da `.env.example` já aponta para esse serviço.

O Docker Desktop precisa ter suporte a virtualização ativo. Se ele informar que a virtualização não foi detectada, use uma máquina com virtualização habilitada ou configure uma instância Supabase; o Compose não conseguirá iniciar nesse computador.

```powershell
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Verifique a disponibilidade do banco com `npm run db:logs`. Para desligar o container sem apagar os dados, use `npm run db:down`.

## Supabase

Supabase pode substituir o banco local. Copie a connection string PostgreSQL do projeto Supabase para `DATABASE_URL` no `.env` e execute:

```powershell
npm run db:migrate:deploy
npm run db:seed
```

Se o ambiente foi configurado na Vercel, use sempre as variáveis de
`Development`; nunca copie as de Production para a máquina local. Para executar
um comando sem gravar secrets em arquivo:

```powershell
npx vercel env run --environment=development -- npx prisma migrate status
npx vercel env run --environment=development -- npm run dev
```

Se for necessário materializar as variáveis, `npx vercel env pull
--environment=development` cria um `.env.local` ignorado pelo Git. O Prisma e o
seed reconhecem `DATABASE_POSTGRES_PRISMA_URL` e
`DATABASE_POSTGRES_URL_NON_POOLING`.

`migrate dev` é o fluxo local de criação de migrations; `migrate deploy` aplica migrations versionadas em staging ou produção.

## Painel administrativo

Depois das migrations e do seed, configure um operador com as variáveis
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` e `ADMIN_ROLE` e execute
`npm run admin:bootstrap`. Veja `docs/13-admin-mvp.md`.
