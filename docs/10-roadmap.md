# Roadmap

| Milestone | Resultado | Estado em 14/07/2026 |
| --- | --- | --- |
| M0 — Fundação | Supabase, schema, seed e verificações | Concluído |
| M1 — Storefront público | Home, catálogo, categoria e produto | Concluído |
| M2 — Carrinho e checkout | Carrinho persistente e pedido pendente | Concluído |
| M3 — Mercado Pago | Checkout Pro, retorno, webhook e sandbox | Em execução |
| M4 — Admin MVP | Login do lojista, produtos, estoque e pedidos | Concluído |
| M5 — Upload e imagens | Storage e imagens seguras | Concluído |
| M6 — Deploy beta | Domínio, operação e pedido ponta a ponta | Em execução |
| M7 — Pós-MVP controlado | Melhorias comerciais avaliadas após o beta | Em execução |

## Sequência

Cada milestone só começa quando a base necessária está estável. Ideias que não
pertencem à fase ativa entram no M7 sem interromper a entrega corrente.

Multi-loja automático, Bling, automação de WhatsApp, tema editável, animações e
polimento visual profundo são avaliados depois do fluxo comercial completo do
piloto. A issue de tema não cria um page builder.

## Revisão local de 25/09/2026

A decisão atual inclui a oferta opcional de loja virtual na entrega do ecossistema;
o adiamento genérico acima é histórico. A reconciliação do M8 e a integridade
comercial foram retomadas sem merge automático. Veja `20-customer-account.md`,
`05-payment-flow.md` e `08-testing.md` para decisões e evidências locais.
Milestones e gates externos permanecem abertos até seus aceites completos;
os resultados de julho não certificam a release atual.

## Ponto de interrupção — atualização documental de 25/09/2026

Resolução de estoque REQUIRES_REVIEW e limpeza durável de mídia têm prova local (69 integrações/82 unitários). A última fatia de TLS/contas Mercado Pago por loja foi interrompida após 24 testes focados; faltam regressão completa, schema/build e revisão dessa fatia. Veja `23-tenant-payment-and-database-tls.md`. Código novo permanece no checkout, sem release/merge. O checkpoint conjunto publicado no repositório ComércioBES registra retomada e gates; milestones continuam com aceites próprios.
