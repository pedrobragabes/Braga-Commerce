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
| M8 — Conta do cliente | E-mail/senha, recuperação, Google e histórico protegido | Em execução |
| M8.1 — Ações manuais da conta | Credenciais, consentimentos, links e revisão visual do proprietário | Aguardando ações manuais |

## Sequência

Cada milestone só começa quando a base necessária está estável. Ideias que não
pertencem à fase ativa entram no M7 sem interromper a entrega corrente.

O M8 contém implementação, testes e deploys automatizáveis. O M8.1 contém
somente ações que exigem acesso do proprietário, segredo externo, clique em
e-mail/consentimento ou julgamento visual; suas issues desbloqueiam os smokes
de Preview e Production sem misturar trabalho manual com código.

Multi-loja automático, Bling, automação de WhatsApp, tema editável, animações e
polimento visual profundo são avaliados depois do fluxo comercial completo do
piloto. A issue de tema não cria um page builder.
