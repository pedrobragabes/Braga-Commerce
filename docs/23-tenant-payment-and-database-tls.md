# Isolamento de pagamento e TLS — decisão antes da implementação

25/09/2026. Complemento E4/E5 e #51: duas lojas não podem usar implicitamente o
mesmo recebedor. Nenhum teste consulta Mercado Pago/Supabase reais ou movimenta
dinheiro. Configuração de contas/recebedores e CA reais continua operacional.

## TLS do PostgreSQL

Remover o fallback `sslmode=no-verify` do pooler. Conexões remotas verificam cadeia
e hostname com as CAs do Node ou uma cadeia PEM configurada em `DATABASE_SSL_CA`.
Se o certificado não for confiável, a conexão falha; não tentar novamente sem
validação. Parâmetros SSL da URL não podem sobrescrever o objeto TLS do driver;
host/port alternativos em query são recusados. Não aceitar `no-verify`/`disable`
remotos. Loopback sem TLS é permitido em teste/desenvolvimento; um runtime de QA
com NODE_ENV=production exige `DATABASE_ALLOW_INSECURE_LOCAL=true` explicitamente.
Essa flag nunca libera plaintext para hostname remoto ou privado não loopback.

## Próximo recorte de pagamento por conta configurada

Mapa JSON somente no ambiente do servidor, indexado por accountKey estável. Cada
entrada associa storeId imutável, ambiente, collectorId, token, secret de webhook
e permissão de novas preferências. A configuração antiga só atende ao piloto
explicitamente vinculado; nenhuma loja recebe fallback de outra conta. Não há
formulário para secrets nem resposta pública contendo credenciais.

O pedido recebe snapshot sem segredo da conta/recebedor/ambiente antes de criar a
preferência. Uma mudança posterior não troca o recebedor de pedido em andamento.
Chaves antigas devem continuar configuradas para webhooks, mesmo que novas
compras sejam desativadas. Conta removida/divergente falha fechado até o operador
restaurar a configuração correta. Preservar pedidos/eventos legados; não deduzir
recebedor por primeiro registro, e-mail, preço ou host enviado pelo comprador.

Webhook escolhe uma accountKey conhecida no endpoint gerado pelo servidor,
valida sua assinatura e consulta o pagamento com seu token. Antes de qualquer
efeito, confere loja, collector_id, live_mode, BRL, total e vínculo da tentativa.
Idempotência deve incluir a conta para evitar colisão entre recebedores.
Cancelamento da assinatura não impede processar pagamentos/pedidos existentes.

Provas exigidas: duas contas/lojas, assinatura de outra conta, recebedor/ambiente/
valor/moeda incompatíveis, configuração ausente, replay, concorrência, rotação
sem troca silenciosa e rollback da vinculação. Somente provider simulado e banco
local descartável. A homologação real dos recebedores permanece aberta.

### Compatibilidade e rotação autorizadas

`MERCADO_PAGO_ACCOUNTS_JSON` tem `{ "version": 1, "accounts": [...] }`;
cada entrada contém `key`, `storeId`, `collectorId` (string decimal), `environment`,
`accessToken`, `webhookSecret` e `newCheckouts`. Nunca reutilizar uma key para outra
loja/recebedor/ambiente: `PaymentAccountBinding` guarda essa identidade sem secrets
e recusa divergência, mesmo após alteração do ambiente. Token/secret podem ser
rotacionados sob a mesma identidade; manter a key antiga quando a identidade mudar.

`MERCADO_PAGO_LEGACY_ACCOUNT_KEY` aponta explicitamente para a entrada que atende
o endpoint histórico sem query `account`. A migração marca `paymentLegacy` somente
nos pedidos que já tinham preferência/pagamento; o primeiro evento validado pode
vinculá-los à conta legada da mesma loja. Eventos antigos não são apagados ou
reatribuídos por heurística. Pedidos novos recebem binding antes da preferência;
um webhook para pedido novo sem binding é rejeitado. Novas keys de evento incluem
a accountKey, e eventos legados concluídos são reconhecidos após provar a conta.

Para rotacionar secret de webhook com callbacks pendentes, prefira nova key com
o novo secret e mantenha a key anterior configurada com `newCheckouts=false`.
Rotação do accessToken sob a mesma key exige manter o mesmo recebedor/ambiente.

As antigas variáveis globais não ativam pagamento por conta própria depois deste
recorte. Antes de publicar, o operador precisa converter a configuração do piloto
para o mapa com storeId/collectorId conferidos e definir a key legada. Ausência
permanece 503, nunca entrega credencial de outra loja. Uma loja tem no máximo uma
conta habilitada para novas preferências; duas lojas não compartilham collector.

Implementado com a migration `20260925070000_tenant_payment_accounts`. O SDK recebe
o token apenas depois de selecionar/validar a conta. A preferência deve devolver
collector_id e external_reference compatíveis antes de sua URL sair do servidor.
Webhooks com conta inválida não consultam o provedor; resultados rejeitados de
conta A sobre pedido B não são anexados ao histórico de B. A outbox por pedido
permanece transacional. Reembolso não repõe saldo físico já comprometido.

## Corte de execução em 25/09/2026

Implementação local em andamento. `.local/payment-isolation-focused.log` registra 24 testes em 2 arquivos aprovados. O último consolidado anterior tem 69 integrações e 82 unitários, schema/lint/types/build verdes; não certifica a fatia financeira posterior. Retomar pela revisão da migration 070000 e executar todos os checks antes de publicar código. Nenhuma credencial real, recebedor ou transação externa foi homologada.
