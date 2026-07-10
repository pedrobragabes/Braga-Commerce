# Arquitetura

## Decisão

O primeiro deploy é **single-tenant** para PV Moda Masculina. A tabela `Store` existe desde o começo para permitir evolução futura, mas toda execução assume uma única loja configurada. Não há subdomínios, cobrança, isolamento por tenant ou temas neste MVP.

## Diagrama textual

```text
Cliente -> Next.js storefront -> API/Server Actions -> Prisma -> PostgreSQL
                                  |                 -> Supabase Storage (M7)
                                  -> Mercado Pago Checkout Pro (M5)
Mercado Pago -> webhook HTTP POST -> Next.js API -> Prisma -> pedido atualizado
Admin -> Next.js /admin -> ações autorizadas -> Prisma/Storage
```

## Fluxos

- Compra: catálogo → carrinho → checkout → cálculo server-side → pedido pendente → preferência Mercado Pago → webhook → pedido pago.
- Admin: login → autorização por role → produtos, categorias, estoque e pedidos.

## Responsabilidades

`app` expõe páginas e rotas; `components` contém UI; `lib` reúne regras e integrações; `prisma` define persistência; banco guarda preços em centavos e snapshots do pedido.
