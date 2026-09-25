# Fluxo de pagamento

1. Cliente envia somente IDs de produto/variação e quantidades.
2. Backend valida itens, estoque e preço atual e baixa a reserva atomicamente; cria `Order` com `PENDING`, `WAITING_PAYMENT`, `RESERVED` e expiração em 30 minutos.
3. Backend cria a preferência Checkout Pro e persiste `mercadoPagoPreferenceId`.
4. Cliente conclui ou abandona o checkout no Mercado Pago.
5. Webhook consulta o pagamento, localiza o pedido, confirma a reserva e atualiza os estados e datas comerciais.
6. Um job autenticado cancela pedidos abandonados e libera sua reserva. Pagamento aprovado após a expiração fica marcado como `REQUIRES_REVIEW`, sem prometer estoque inexistente.

As `back_urls` servem apenas para experiência de navegação. Mesmo no retorno de
sucesso, a interface mantém “validando pagamento” até ler `PAID` do banco. A
fonte de verdade é a consulta autenticada ao provedor após um webhook assinado.

## Idempotência

O webhook pode duplicar, atrasar ou chegar fora de ordem. `PaymentEvent` salva a
combinação provedor/pagamento/estado e seu resultado. Um pedido `PAID` ignora
retornos pendentes ou rejeitados antigos, aceitando apenas a evolução para
reembolso. O fluxo de pagamento não reduz estoque novamente: ele muda a reserva
já baixada de `RESERVED` para `COMMITTED`. Cancelamento antes do pagamento libera
unidades; reembolso após confirmação não repõe estoque físico automaticamente.

## Configuração por ambiente

- `MERCADO_PAGO_ACCOUNTS_JSON` configura accountKey, storeId, collectorId,
  environment, accessToken, webhookSecret e newCheckouts por conta. Somente no servidor.
- `environment=sandbox` seleciona a URL de teste da conta; `production` seleciona
  a URL real. O webhook confere live_mode, collector_id, BRL, centavos exatos e metadata.
- `MERCADO_PAGO_LEGACY_ACCOUNT_KEY` associa explicitamente o endpoint antigo a
  uma entrada do mapa. Credenciais globais antigas, sozinhas, não ativam pagamento.
- `NEXT_PUBLIC_APP_URL` precisa apontar para a origem pública usada nas URLs de
  retorno e no webhook.

Os pedidos usam preferencialmente o domínio canônico aprovado da própria loja;
fallback para NEXT_PUBLIC_APP_URL é permitido apenas na instância STORE_SLUG explícita.
Vínculo persistido e migração histórica estão em `23-tenant-payment-and-database-tls.md`.

## Estados

Pendente: `PENDING/WAITING_PAYMENT`; aprovado: `CONFIRMED/PAID`; falha ou cancelamento atualiza `PaymentStatus` sem apagar histórico; reembolso fica explícito em ambos os estados pertinentes.

## Integridade da reserva — revisão de 25/09/2026

O prazo original de 30 minutos continua valendo após uma tentativa rejeitada:
`FAILED` pode ser tentado novamente enquanto a reserva existir, mas o job libera
essa reserva no vencimento. Uma rejeição não prorroga o prazo.

Webhook e expiração travam a linha do pedido antes de ler e decidir seu próximo
estado. Se a aprovação vencer a corrida, a reserva torna-se `COMMITTED`; se a
expiração liberar primeiro, a aprovação tardia fica `REQUIRES_REVIEW` e não reduz
estoque novamente. Eventos concorrentes não podem rebaixar um pagamento aprovado.
O insert de `PaymentEvent` usa conflito tratado pelo PostgreSQL; a primeira
entrega simultânea não depende de um upsert emulado pelo ORM.

Cancelamento pelo job e pelo webhook compartilham a chave `order:<id>:order_cancelled`
da outbox. Evento, pedido, estoque e intenção de e-mail confirmam na mesma transação;
uma falha no banco desfaz tudo e permite reprocessar a notificação.

Estorno de pagamento confirmado só é aceito para a tentativa registrada no pedido.
Após estoque confirmado, estorno financeiro **não** repõe estoque físico: a devolução
precisa de conferência operacional. Se o estorno chegar antes de qualquer confirmação
e ainda houver apenas reserva, ela é liberada uma vez. Nenhum teste desta revisão
executa cobrança ou estorno no provedor.

Validação local: suíte PostgreSQL em `tests/integration/commerce-integrity.test.ts`,
incluindo última unidade simples/variante, cinco corridas aprovação/expiração,
replay simultâneo, rejeição abandonada, eventos fora de ordem, estorno e falha da outbox.
Isso não homologa credenciais, recebedor por loja ou pagamento sandbox real (#15/#19).

### Próxima fatia: estoque administrativo e atendimento

Decisão de 25/09/2026 antes da implementação de #99/#101: a ficha comercial e a
edição de variantes deixam de salvar quantidades. O saldo disponível muda em uma
ação própria, com permissão de estoque, delta, saldo lido, motivo e identificador
idempotente. Uma migration aditiva cria `StockAdjustment`, com ator, loja, item,
saldo anterior/posterior e data; conflito exige nova leitura, sem sobrescrever
uma reserva concorrente. Produto e variante novos começam com saldo zero.
O modo simples/com variações é escolhido na criação e não muda por um formulário
de edição, evitando trocar a origem de estoque de pedidos já existentes.

O atendimento só avança quando pagamento está `PAID` e estoque `COMMITTED`, com
passos diferentes para retirada e entrega. Cancelamento operacional não executa
estorno financeiro e nunca é apresentado como reembolso.

### Resolução de REQUIRES_REVIEW (#101)

OWNER/ADMIN registra no pedido uma decisão com motivo, versão e chave idempotente.
`COMMIT_STOCK` debita cada item do saldo atual atomicamente e só então libera a
preparação. Falta de qualquer item desfaz a transação inteira. `CANCEL_FULFILLMENT`
encerra atendimento sem repor saldo já liberado e sem modificar o pagamento PAID,
valor, ID do provedor ou data de reembolso. A próxima ação exibida é contatar o
cliente e executar/conferir estorno no provedor; não existe botão de estorno fictício.

STAFF não resolve nem contorna revisão pelo cancelamento comum. Atendimento já
cancelado nunca é reaberto: somente a decisão de encaminhar o estorno é permitida.
Webhook, expiração e operação avançam `operationVersion` sob o mesmo lock de pedido;
formulário antigo falha. Replay com intenção igual devolve o registro auditado;
chave reaproveitada com outro motivo/ação falha. Estorno confirmado que chega antes
da decisão encerra a revisão sem débito; depois de COMMITTED, conserva estoque
comprometido até conferência física. Nenhuma dessas decisões cobra novamente.
