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
textos e conteúdo editorial. Componentes e consultas continuam os mesmos. Um
editor de temas no painel permanece pós-MVP; a customização atual é feita por
configuração versionada.

## Diagrama textual

```text
Cliente -> Next.js storefront -> Prisma -> PostgreSQL/Supabase
                               -> Supabase Storage (M5)
                               -> Mercado Pago Checkout Pro (M3)
Mercado Pago -> webhook HTTP POST -> Next.js API -> Prisma -> pedido atualizado
Admin -> Next.js /admin -> ações autorizadas -> Prisma/Storage
```

## Responsabilidades

`app` compõe páginas e rotas; `storefront/components` contém a UI pública;
`storefront/config` concentra o que muda por cliente; `lib` reúne banco e
integrações; `prisma` define persistência. Valores monetários permanecem em
centavos e pedidos guardam snapshots dos itens.
