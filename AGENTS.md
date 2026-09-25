# Regras de entrega do Braga Commerce

Toda implementação de milestone deve seguir `docs/12-delivery-workflow.md`.

Regras obrigatórias:

1. Ler o milestone e todas as issues antes de alterar código.
2. Executar as issues em ordem de dependência e manter um plano verificável.
3. Separar identidade visual, componentes, domínio, persistência e integrações.
4. Não confiar em preço, estoque, pagamento ou permissão vindos do cliente.
5. Rodar testes, lint, typecheck e build antes de publicar.
6. Fazer smoke test local/integração e, após o deploy, smoke test de produção.
7. Fechar uma issue apenas com os critérios de aceite comprovados em comentário.
8. Fechar o milestone apenas quando não houver issue obrigatória aberta.
9. Manter bloqueios externos abertos e dizer exatamente qual credencial ou ação falta.
10. Nunca registrar secrets, payloads sensíveis ou dados pessoais em código e logs.

A estratégia de branch, commit e push deve respeitar a autorização dada pelo usuário
na tarefa atual; este arquivo não concede autorização permanente para publicar.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Checkpoint autorizado em main — 25/09/2026

Pedro autorizou explicitamente consolidar este WIP em main e remover branches temporárias após preservação. Essa autorização é desta execução; não libera produção, migrations remotas nem fechamento sem aceite. Inventário: docs/ARQUIVO-BRANCHES-2026-09-25.md. Estado: docs/CONSOLIDACAO-MAIN-2026-09-25.md.
