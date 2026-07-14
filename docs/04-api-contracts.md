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

## `POST /api/payments/mercadopago/preference` (Milestone 3)

Recebe somente `{ orderId }`. O servidor relê o pedido e seus snapshots, cria ou
reaproveita a preferência e salva `mercadoPagoPreferenceId`. Retorna
`{ preferenceId, checkoutUrl, environment }`. O navegador nunca informa o valor
ao provedor. Erros esperados: `400` para entrada inválida, `404` para pedido
inexistente, `409` para pedido já pago ou reembolsado, `503` quando a integração
não foi configurada e `502` para falha do provedor.

## `GET /api/orders/:id/status` (Milestone 3)

Devolve apenas `{ orderId, status, paymentStatus, updatedAt }`. A tela de retorno
usa esse contrato para consultar a confirmação processada pelo webhook; nenhum
dado pessoal ou item do pedido é exposto.

## `POST /api/webhooks/mercadopago` (Milestone 3)

Recebe notificação, exige `data.id`, valida a assinatura HMAC com o SDK oficial,
consulta o pagamento no Mercado Pago e só então atualiza o pedido. Cada estado do
pagamento gera uma chave única em `PaymentEvent`; repetição retorna sucesso sem
reaplicar a transição. Divergência de valor e pedido ausente ficam registradas
sem alterar o pedido.

## `POST /api/upload` (Milestone 5)

Exige operador autenticado com `images:write`. Recebe `multipart/form-data` com
`productId`, `file` e `alt` opcional. O servidor valida `storeId`, tamanho máximo
de 4 MiB, MIME e assinatura binária; gera o caminho do objeto e retorna
`{ url, image }` somente depois de Storage e banco concluírem.

Erros esperados: `400` para arquivo ausente, vazio, grande, SVG, tipo inválido ou
MIME forjado; `401` sem sessão; `403` sem role; `404` quando o produto não pertence
à loja; `502` se o Storage não concluir o upload. Nenhum erro inclui detalhe do
provedor, caminho privado ou credencial.

## Mutações administrativas (Milestone 4)

O MVP usa Server Actions para produtos, categorias, variações, pedidos e
configurações. Toda action valida Zod/valores, sessão Supabase, operador Prisma,
role e `storeId`. IDs enviados pelo formulário não concedem acesso a registros
de outra loja. Estado de pagamento não é editável pelo painel operacional.
