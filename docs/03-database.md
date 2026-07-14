# Banco de dados

## Entidades

`Store` é a raiz; possui `StoreSettings`, `User`, `Category`, `Product` e `Order`. Produto possui imagens e variações. Pedido pertence a cliente, armazena endereço e valores como snapshot e possui itens.

## Enums

`UserRole`, `OrderStatus`, `PaymentStatus`, `FulfillmentStatus`, `DeliveryMethod`,
`InventoryStatus`, `EmailType` e `EmailStatus` eliminam estados textuais inválidos.

## Integridade

- Valores monetários são inteiros em centavos.
- `Store.slug` e `storeId + slug` são únicos.
- Imagens e variações são apagadas com o produto; pedidos conservam os snapshots de item.
- O total é calculado no servidor a partir de produtos e variações ativos.
- `User.authUserId` vincula Supabase Auth ao operador e `storeId` limita toda operação administrativa.
- Produto simples usa `Product.stockQuantity`; produto com grade usa o estoque de cada `ProductVariant`.
- Novos pedidos baixam estoque em transação e registram reserva, expiração, confirmação ou liberação. `paidAt`, `cancelledAt` e `refundedAt` preservam as datas do ciclo comercial.
- `RateLimitBucket` guarda somente chaves HMAC e janelas de abuso; `EmailOutbox` guarda eventos e tentativas, sem duplicar payload pessoal.
- A observação do cliente (`notes`) e a nota interna (`internalNote`) são campos distintos.

## Migrations

Após configurar PostgreSQL, use `npm run db:migrate -- --name init`. Nunca altere manualmente uma migration aplicada em produção; crie uma nova migration e faça backup antes do deploy.
