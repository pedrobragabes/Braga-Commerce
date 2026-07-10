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

`migrate dev` é o fluxo local de criação de migrations; `migrate deploy` aplica migrations versionadas em staging ou produção.

## Situação da migration inicial

A migration `20260710142000_init` foi gerada a partir do schema e está versionada. Ela ainda precisa ser aplicada a uma instância PostgreSQL real antes de fechar a issue #2.
