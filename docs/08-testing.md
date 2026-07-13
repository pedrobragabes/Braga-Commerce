# Testes

## Pirâmide

- Unitários: dinheiro, slug, validações Zod e regras de transição de pedido.
- Integração: Prisma, criação de pedido, cálculo server-side e processamento idempotente de webhook.
- E2E: catálogo → carrinho → checkout → Mercado Pago sandbox → admin.

## Checklist manual antes do deploy

- Produto simples e com variação exibem preço e indisponibilidade corretamente.
- Alteração de quantidade e revalidação bloqueiam estoque insuficiente.
- Total enviado pelo cliente é ignorado e recalculado.
- Pagamento aprovado atualiza o pedido uma vez; notificação repetida não duplica nada.
- Admin sem sessão não acessa `/admin`; uploads inválidos são rejeitados.
- Layout funciona em celular e metadata/404/robots/sitemap estão presentes.

## Evidência do Milestone 3

Sem credenciais de teste, os testes locais cobrem configuração, seleção segura
da URL, assinatura HMAC, mapeamento e proteção contra transições antigas. O item
de sandbox só pode ser fechado após um pagamento real de teste produzir uma
preferência, retorno e `PaymentEvent` no banco.
