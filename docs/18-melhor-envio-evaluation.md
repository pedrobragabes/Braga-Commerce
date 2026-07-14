# Avaliação da integração Melhor Envio

## Decisão

**Aprovada com escopo de cotação apenas.** A #44 deve consultar fretes no servidor,
exibir preço/prazo e recalcular a opção escolhida ao criar o pedido. Retirada e
entrega local continuam disponíveis quando o provedor estiver indisponível.

Compra, geração, impressão e rastreamento de etiquetas não entram na primeira
versão. Essas etapas exigem operação fiscal, dados completos de remetente e
destinatário, declaração de conteúdo ou nota fiscal, pagamento da etiqueta e
tratamento assíncrono adicional.

## Custo e contrato

- A API pública não cobra taxa de integração nem mensalidade. O custo ocorre na
  contratação de cada envio/etiqueta, conforme transportadora, serviço, dimensões,
  peso, origem, destino, seguro e adicionais.
- A plataforma retém parte da diferença negociada com as transportadoras; o valor
  exibido ao lojista já reflete esse modelo comercial.
- Seguro deve usar o valor real declarado. Divergência entre seguro, nota fiscal
  ou declaração de conteúdo pode comprometer indenização.
- Uma integração própria não é automaticamente uma parceria verificada; o suporte
  do Melhor Envio não revisa o código da plataforma.

Fontes oficiais:

- [Introdução e custo da API](https://docs.melhorenvio.com.br/reference/introducao-api-melhor-envio)
- [Modelo de preços](https://centraldeajuda.melhorenvio.com.br/hc/pt-br/articles/31220761778580-Como-o-Melhor-Envio-consegue-oferecer-pre%C3%A7os-menores-que-os-de-balc%C3%A3o)
- [Valor segurado](https://centraldeajuda.melhorenvio.com.br/hc/pt-br/articles/31220417305492-O-que-%C3%A9-Valor-Segurado)

## Contrato técnico proposto para a #44

### Provedor

- Sandbox: `https://sandbox.melhorenvio.com.br`.
- Produção: `https://melhorenvio.com.br`.
- Cotação: `POST /api/v2/me/shipment/calculate`.
- Headers obrigatórios: `Authorization: Bearer`, `Accept: application/json`,
  `Content-Type: application/json` e `User-Agent` com aplicação/e-mail de suporte.
- Usar `custom_price` e `custom_delivery_time`, pois eles incluem customizações da
  conta integrada.

### Entrada interna

```text
storeId
destinationZipCode
items[]: productId, variantId?, quantity
```

O servidor busca e valida:

- CEP de origem e configuração da loja;
- peso e dimensões persistidos de cada produto;
- quantidade, estoque e valor segurado real;
- ambiente e credencial do provedor.

O cliente nunca envia preço de produto, preço final do frete, peso, dimensões ou
serviço considerado confiável.

### Resposta interna

```text
quotes[]: provider, serviceId, serviceName, priceCents,
          deliveryDays, companyName
fallback: LOCAL_PICKUP | LOCAL_DELIVERY
expiresAt
```

Erros por transportadora devem ser filtrados sem derrubar as demais opções. Se
nenhuma cotação externa for válida, a API retorna fallback operacional explícito,
sem inventar preço ou prazo.

Fonte oficial do endpoint:
[Cálculo de fretes](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos).

## Autenticação e secrets

- OAuth2 com aplicativo criado na Área Dev.
- Access token dura 30 dias; refresh token dura 45 dias.
- Solicitar somente os scopes necessários.
- Client secret, access token e refresh token ficam exclusivamente no servidor.
- Para a loja piloto, a #44 pode começar com credenciais Sandbox em variáveis de
  Preview. Antes de Production, deve existir renovação automática ou procedimento
  operacional comprovado; token vencido não pode bloquear retirada local.
- Em cenário multi-loja, tokens passam a ser persistidos cifrados por loja; nunca
  em `StoreSettings` como texto aberto.

Fontes oficiais:

- [Autenticação OAuth2](https://docs.melhorenvio.com.br/docs/autenticacao-1)
- [Solicitação e renovação de token](https://docs.melhorenvio.com.br/reference/solicitacao-do-token)

## Dados ausentes no Braga Commerce

A #44 precisará adicionar, com migration própria:

- produto: peso em gramas, altura, largura e comprimento em centímetros;
- loja: CEP de origem e e-mail técnico/remetente;
- configuração: ativação do provedor e serviços permitidos;
- pedido: provedor, ID/nome do serviço, preço e prazo cotados no momento da compra.

Para variações que alterem peso ou volume, os campos poderão ser sobrescritos na
variante. No piloto de moda, a primeira versão pode usar dimensões do produto e
uma regra documentada de agrupamento; não deve enviar medidas genéricas escondidas.

## Sandbox e validação

O Sandbox oferece cadastro simplificado e simula apenas Correios e Jadlog. A
cotação deve ser testada com CEP válido, inválido, serviço indisponível, múltiplos
itens, timeout e token vencido. Antes de habilitar Production, comparar uma amostra
de cotações com o painel do Melhor Envio.

## Etiquetas: decisão adiada

Inserir frete no carrinho do Melhor Envio exige remetente, destinatário, produtos,
volumes e dados fiscais. Desde 06/04/2026, a documentação informa requisitos de
produtos/DC-e no fluxo de criação da etiqueta. Webhooks de etiqueta usam assinatura
HMAC-SHA256 e possuem retentativas, mas não são necessários para cotação.

Fontes oficiais:

- [Inserir fretes no carrinho](https://docs.melhorenvio.com.br/reference/inserir-fretes-no-carrinho)
- [Compra de fretes e documentos](https://docs.melhorenvio.com.br/docs/compra-de-fretes)
- [Webhooks assinados](https://docs.melhorenvio.com.br/docs/webhooks)

## Critérios de go/no-go da #44

Prosseguir quando o responsável fornecer:

1. conta e aplicativo Sandbox;
2. client ID/secret e autorização, somente por ambiente seguro;
3. CEP de origem e e-mail técnico;
4. pesos/dimensões reais ou processo para cadastrá-los;
5. decisão operacional de manter retirada/entrega local como fallback.

Sem esses itens, a #44 permanece aberta e não usa tabela fictícia em Production.
