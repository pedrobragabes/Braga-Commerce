# Ponte com ComércioBES

> Estado reconciliado em 02/10/2026: o [ADR vigente BES](https://github.com/pedrobragabes/comercio-bes/blob/738994596fe04954ff1aa26ff61afbd7585ef913/docs/adr/0005-current-architecture-and-governance.md) distingue guia gratuito, contratação assistida e fases posteriores. O consumidor v2 foi publicado inativo no BES PR #41; o [produtor v2](DIRECTORY-CATALOG-V2-2026-10-02.md) permanece no PR Braga #116 em rascunho. Consentimento real, homologação externa, operação de chaves e publicação Braga têm gates próprios. A ordem e os limites originais abaixo são históricos; não adiam a implementação técnica já aprovada nem autorizam checkout no BES.

> Atualização de 25/09/2026: o prompt mestre atual inclui loja paga assistida e
> isolamento entre lojas. O adiamento genérico deste documento é histórico.
> O contrato read-only implementado e sua prova HTTP estão em
> `22-directory-bridge-v1.md`; tema/provisionamento em `21-assisted-store-lifecycle.md`.

## Decisão

O **Braga Commerce** é a referência do módulo de loja online reutilizável. Ele não será fundido ao ComércioBES neste momento.

O **ComércioBES** continuará evoluindo primeiro como diretório/vitrine de comércios locais. Quando uma loja precisar de catálogo avançado e venda online, ela poderá usar o padrão de storefront e os contratos deste repositório.

## Responsabilidades

| Produto | Responsabilidade atual |
| --- | --- |
| ComércioBES | Descoberta local, perfil público, WhatsApp, fotos, endereço e geração de leads. |
| Braga Commerce | Referência de catálogo, carrinho, checkout, pagamentos e operação de uma loja. |

## Ordem de evolução

1. ComércioBES publica o diretório com a **PV Moda Masculina** como loja piloto.
2. O perfil da PV Moda valida conteúdo e navegação sem checkout.
3. ComércioBES ganha um storefront de catálogo apenas quando a vitrine estiver estável.
4. Checkout e Mercado Pago entram somente no piloto pago, reaproveitando as regras do Braga Commerce.

## Limites atuais

Não implementar agora subdomínios, multi-tenant completo, planos recorrentes, catálogo com checkout ou integração de pagamentos neste repositório. A primeira entrega é a vitrine pública da PV Moda Masculina.
