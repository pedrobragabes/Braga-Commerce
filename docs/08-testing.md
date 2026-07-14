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

## Evidência do Milestone 4

- Unitário: matriz OWNER/ADMIN/STAFF, transições de fulfillment, slug e dinheiro.
- Integração: operador temporário no Supabase Auth vinculado a uma loja, login,
  isolamento por `storeId` e CRUD com limpeza posterior.
- Visual: dashboard, tabela, formulários e pedido em desktop/mobile.
- Produção: smoke autenticado com os três papéis, duas lojas, produto simples e
  com variação, categoria, pedido, configurações e limpeza comprovada.

O fixture pode ser repetido com `admin:smoke:setup`, `admin:smoke:verify` e
`admin:smoke:cleanup`. Identidades e senha são fornecidas somente por variáveis
locais e nunca são impressas pelo script.

## Evidência do Milestone 5

- Unitário: roles de imagem, bucket seguro, JPG/PNG/WebP, SVG, MIME forjado e
  limite de 4 MiB.
- Integração: migration de `storagePath`, bucket idempotente, escrita anônima
  bloqueada, leitura pública e limpeza do objeto técnico.
- E2E: upload autenticado, ordem persistida, imagem principal no storefront,
  remoção de referência/objeto e bloqueio de STAFF.
