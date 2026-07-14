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

- `MERCADO_PAGO_ENV=sandbox` usa a URL de checkout de teste.
- `MERCADO_PAGO_ACCESS_TOKEN` existe apenas no servidor.
- `MERCADO_PAGO_WEBHOOK_SECRET` valida as notificações.
- `NEXT_PUBLIC_APP_URL` precisa apontar para a origem pública usada nas URLs de
  retorno e no webhook.

## Estados

Pendente: `PENDING/WAITING_PAYMENT`; aprovado: `CONFIRMED/PAID`; falha ou cancelamento atualiza `PaymentStatus` sem apagar histórico; reembolso fica explícito em ambos os estados pertinentes.
