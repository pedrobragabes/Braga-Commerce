# Fluxo de pagamento

1. Cliente envia somente IDs de produto/variação e quantidades.
2. Backend valida itens, estoque e preço atual; cria `Order` com `PENDING` e `WAITING_PAYMENT`.
3. Backend cria a preferência Checkout Pro e persiste `mercadoPagoPreferenceId`.
4. Cliente conclui ou abandona o checkout no Mercado Pago.
5. Webhook consulta o pagamento, localiza o pedido e atualiza os estados.

## Idempotência

O webhook pode duplicar, atrasar ou chegar fora de ordem. A implementação deve salvar o ID de pagamento, bloquear repetição e não reaplicar transições já efetivadas. Um pedido `PAID` nunca cria outro pedido nem reduz estoque novamente.

## Estados

Pendente: `PENDING/WAITING_PAYMENT`; aprovado: `CONFIRMED/PAID`; falha ou cancelamento atualiza `PaymentStatus` sem apagar histórico; reembolso fica explícito em ambos os estados pertinentes.
