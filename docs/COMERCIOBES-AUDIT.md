# Referência para o MVP ComércioBES — 24/09/2026

O ComércioBES é o produto público de descoberta; o Braga Commerce permanece responsável por transações. Não houve merge entre repositórios ou compartilhamento de banco/autenticação.

Nesta branch `Codex/comerciobes-reference-audit`, as mudanças são atualização de dependências/lockfile, overrides transitivos, arquivos regenerados pelo Next e fixture de assinatura Mercado Pago compatível com timestamp em segundos. Nenhuma regra de pagamento foi afrouxada.

Validação local: 52 testes passaram; lint, typecheck e build passaram. Storefront iniciado na porta 4318 com PostgreSQL local separado. `npm audit` reportou zero vulnerabilidades. Supabase Auth/Storage, pagamentos, e-mail e jobs externos não foram homologados ponta a ponta nem houve deploy/push.

Referências aproveitadas pelo BES: operador/papel atual consultado no servidor (`lib/admin-auth.ts`), imagens relacionadas (`lib/storage/*`), migrations e constraints, validação antes da persistência e jobs duráveis. Componentes React, Store/User, Category de produtos e checkout não foram copiados.

Achados para a evolução do Braga:

- Configurar `DATABASE_SSL_CA`: o fallback do pooler em `lib/database-url.ts` usa TLS sem validar cadeia.
- Reavaliar exclusão em `lib/storage/product-images.ts`: storage é removido antes de a transação DB confirmar; uma falha posterior pode deixar referência quebrada.
- Rever Customer global por telefone não verificado em `lib/orders.ts` antes de expandir isolamento entre lojas.
- Manter homologação externa de Auth/Storage/Mercado Pago/SMTP/jobs como pendência explícita; testes unitários não substituem essa evidência.

Relatório completo, comparações de entidades, evidências e rollout estão no checkout irmão: `Comercio_BES/docs/AUDITORIA-COMPARATIVA-MVP.md` e `Comercio_BES/docs/DEPLOY-MVP.md`.
