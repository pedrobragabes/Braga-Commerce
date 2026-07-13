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
