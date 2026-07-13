# Contratos de API

## `POST /api/cart/quote` (Milestone 2)

Recebe apenas `{ storeSlug, items: [{ productId, variantId?, quantity }] }`. O
servidor relê produtos, variações, preços e estoque e devolve linhas cotadas,
subtotal e eventuais indisponibilidades. Preços enviados pelo cliente não são
aceitos pelo contrato.

## `POST /api/orders` (Milestone 2)

Recebe os mesmos itens, dados mínimos do cliente, `deliveryMethod`, endereço
quando necessário e observações opcionais. Zod valida o payload; o servidor
recota tudo e persiste `Customer`, `Order` com status `PENDING` e snapshots em
`OrderItem`. Retorna `{ orderId, status, totalCents }`.

Erros esperados: `400` para entrada inválida, `404` para loja inexistente,
`409` para item/variação/estoque ou método de entrega indisponível e `500` para
falha não tratada.

## `POST /api/checkout/mercadopago` (Milestone 3)

Recebe `{ items: [{ productId, variantId?, quantity }], customer, deliveryMethod }`. O servidor valida Zod, busca preços e estoque, calcula os valores, cria pedido e preferência. Retorna `{ orderId, checkoutUrl }`. Erros esperados: `400` input inválido, `409` estoque insuficiente, `401/403` ação proibida quando aplicável e `502` provedor indisponível.

## `POST /api/webhooks/mercadopago` (Milestone 3)

Recebe notificação, valida assinatura/origem quando aplicável, consulta o pagamento no Mercado Pago e atualiza o pedido uma única vez. Retorna `200` para evento processado ou já aplicado; registra e monitora evento sem pedido correspondente.

## `POST /api/upload` (Milestone 5)

Exige admin autenticado. Aceita apenas JPG, PNG e WebP dentro do limite definido; retorna `{ url }`. Rejeita SVG, MIME inválido e tamanho excedido com `400`.
