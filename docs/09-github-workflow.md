# Workflow GitHub

## Branches e PRs

Use `main` protegida e branches curtas (`feat/...`, `fix/...`, `chore/...`). PR pequena, com descrição do teste manual, sem misturar banco, interface e pagamento quando não forem inseparáveis.

## Labels

Tipos: `type: feature`, `bug`, `chore`, `docs`, `security`, `refactor`, `test`, `infra`.

Áreas: `area: storefront`, `admin`, `database`, `payments`, `auth`, `storage`, `ui`, `deployment`.

Prioridades: `priority: p0` a `p3`. Estados: `status: blocked`, `ready`, `in-progress`, `review`. Escopo: `scope: mvp`, `post-mvp`, `future`.

## Definition of Done

Código, typecheck, lint, teste manual, fluxo principal preservado e documentação/variáveis atualizadas quando aplicável. Para pagamentos: sandbox, pedido, preferência, webhook e idempotência verificados.

## Kanban

Backlog → Ready → In Progress → Review → Testing → Done/Blocked. Máximo de duas issues em progresso.
