# Contratos de API

## `POST /api/checkout/mercadopago` (Milestone 5)

Recebe `{ items: [{ productId, variantId?, quantity }], customer, deliveryMethod }`. O servidor valida Zod, busca preços e estoque, calcula os valores, cria pedido e preferência. Retorna `{ orderId, checkoutUrl }`. Erros esperados: `400` input inválido, `409` estoque insuficiente, `401/403` ação proibida quando aplicável e `502` provedor indisponível.

## `POST /api/webhooks/mercadopago` (Milestone 5)

Recebe notificação, valida assinatura/origem quando aplicável, consulta o pagamento no Mercado Pago e atualiza o pedido uma única vez. Retorna `200` para evento processado ou já aplicado; registra e monitora evento sem pedido correspondente.

## `POST /api/upload` (Milestone 7)

Exige admin autenticado. Aceita apenas JPG, PNG e WebP dentro do limite definido; retorna `{ url }`. Rejeita SVG, MIME inválido e tamanho excedido com `400`.
