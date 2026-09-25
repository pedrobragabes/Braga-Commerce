# Consolidação WIP em main — 25/09/2026

Por instrução explícita de Pedro, este checkpoint reúne código, migrations, frontend e documentação atuais em main, mesmo com homologação incompleta. Substitui o estado "código apenas local" do checkpoint anterior. Publicação de código não libera produção nem encerra milestones.

## Verificação antes da publicação

- ComércioBES: 346 testes/35 suítes de API, lint, build e frontend:check aprovados; web 69 testes, lint, TypeScript e build aprovados. Banco exclusivamente local/isolado.
- Braga: 86 integrações PostgreSQL e 89 unitários aprovados; lint, TypeScript e build aprovados. A migration 070000 e a fatia de contas de pagamento agora estão no consolidado local; homologação do provedor segue pendente.
- As primeiras tentativas encontraram PostgreSQL local parado; o runtime foi retomado e os checks repetidos. Rodar unitários com BRAGA_TEST_DATABASE_URL ativada disparou integrações paralelas e interferência entre fixtures; a verificação final usa test:integration serial e npm test sem essa variável.
- O resultado atual não substitui CI remoto, sandbox Mercado Pago, SMTP externo, piloto ou revisão completa no navegador. O runner Jest ainda usa forceExit e registra aviso pg.

## Git e operação

Uma branch permanente: main. Inventário/recuperação em [arquivo de branches](ARQUIVO-BRANCHES-2026-09-25.md). Credenciais, configurações locais, dados de runtime, uploads e node_modules não entram no commit. Os bancos dos dois produtos permanecem separados; nenhuma migração remota foi executada.

O deploy automático Git da Vercel no Braga fica desativado por git.deploymentEnabled=false, pois o script de build produtivo aplica migrations. Reativação exige uma release deliberada com backup e homologação. A nova etapa agendada de limpeza de mídia exige STORAGE_CLEANUP_ENABLED=true após o endpoint estar implantado; tarefas existentes não são ampliadas automaticamente por este checkpoint.

## Situação funcional e próxima fatia

A jornada BES conta→comércio→foto/horário→consentimento→aprovação→perfil foi exercitada antes da consolidação. A prévia local protegida foi reiniciada. Ainda falta terminar promoções/métricas e os estados negativos dos painéis, implantar o convite assistido após autorização e fazer a conferência integral mobile/acessibilidade. Login WhatsApp/SMS segue futuro.

O objetivo imediato é uma apresentação local confiável do ComércioBES. Lançamento público e loja paga integral dependem de preparação/homologação própria; não há promessa de conclusão em uma data apenas porque os testes passaram.
