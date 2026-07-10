# Banco de dados

## Entidades

`Store` é a raiz; possui `StoreSettings`, `User`, `Category`, `Product` e `Order`. Produto possui imagens e variações. Pedido pertence a cliente, armazena endereço e valores como snapshot e possui itens.

## Enums

`UserRole`, `OrderStatus`, `PaymentStatus`, `FulfillmentStatus` e `DeliveryMethod` eliminam estados textuais inválidos.

## Integridade

- Valores monetários são inteiros em centavos.
- `Store.slug` e `storeId + slug` são únicos.
- Imagens e variações são apagadas com o produto; pedidos conservam os snapshots de item.
- O total é calculado no servidor a partir de produtos e variações ativos.

## Migrations

Após configurar PostgreSQL, use `npm run db:migrate -- --name init`. Nunca altere manualmente uma migration aplicada em produção; crie uma nova migration e faça backup antes do deploy.
