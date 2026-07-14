# Arquitetura

## Decisão

O primeiro deploy é **single-store** para a PV Moda Masculina. A tabela `Store` e o
escopo por `storeId` deixam o banco preparado para expansão, mas não existe
provisionamento automático de tenants, cobrança por loja ou resolução por
subdomínio neste MVP.

## Storefront customizável

A vitrine é dividida em quatro camadas para evitar misturar identidade visual com
regra de negócio:

```text
storefront/config     -> marca, textos e tokens visuais do cliente
storefront/components -> blocos públicos reutilizáveis
storefront/data.ts    -> consultas e mapeamento do catálogo
app/(storefront)      -> composição das rotas públicas
lib                   -> conexão e integrações compartilhadas
```

Uma nova implantação pode copiar a configuração da PV Moda e substituir cores,
textos e conteúdo editorial. Componentes e consultas continuam os mesmos. A
customização atual é feita por configuração versionada; os campos de cor
persistidos ainda não são consumidos pelo storefront. O contrato de overrides
seguros e blocos fixos está em `docs/19-store-theme-contract.md`.

## Diagrama textual

```text
Cliente -> Next.js storefront -> Prisma -> PostgreSQL/Supabase
                               -> Supabase Storage (M5)
                               -> Mercado Pago Checkout Pro (M3)
Mercado Pago -> webhook HTTP POST -> Next.js API -> Prisma -> pedido atualizado
Admin -> Next.js /admin -> ações autorizadas -> Prisma/Storage
```

## Autenticação

O checkout público do M2 funciona como convidado: nome, telefone, e-mail
opcional e endereço são snapshots do pedido, sem senha ou conta obrigatória.
Isso reduz atrito e mantém `Customer` preparado para uma associação futura.

O login do lojista entra no M4 para proteger produtos, estoque e pedidos. Uma
conta opcional de consumidor, com histórico de compras, permanece no M7 e pode
vincular pedidos anteriores por um processo verificado de e-mail ou telefone.

No M4, o login do operador usa Supabase Auth e cookies SSR. A identidade externa
é vinculada a `User.authUserId`; role e `storeId` continuam autoritativos no
Prisma. `proxy.ts` renova a sessão, mas cada página e Server Action revalida
identidade, operador ativo, loja ativa e permissão. Veja `13-admin-mvp.md`.

## Responsabilidades

`app` compõe páginas e rotas; `storefront/components` contém a UI pública;
`storefront/config` concentra o que muda por cliente; `lib` reúne banco e
integrações; `prisma` define persistência. Valores monetários permanecem em
centavos e pedidos guardam snapshots dos itens.
