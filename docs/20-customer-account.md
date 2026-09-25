# Contas de clientes — reconciliação de 25/09/2026

Referência preservada: PR [#85](https://github.com/pedrobragabes/Braga-Commerce/pull/85),
head `9e8d8a2e51bbbeeae33b283841c410e24f9d451e`. A leitura de #71–#80 e #98 confirma
que código em draft e antigos checks não comprovam a entrega atual. Nenhum merge,
deploy, envio externo de e-mail ou alteração de Supabase é autorizado por esta etapa.

## Decisões antes da implementação

Portar seletivamente autenticação SSR/PKCE, telas de conta, rate limits,
comportamento de checkout e estilos/componentes novos compatíveis com a vitrine.
Preservar o gate beta, as correções locais de reserva/estoque/atendimento e o
checkout convidado. Não substituir manifests/lockfiles pelas versões antigas do PR.

Substituir duas decisões do PR: histórico consultado por e-mail e associação de
Customer por telefone. E-mail e telefone são contatos, não prova de posse de pedido.
O histórico exige `authUserId` verificado na sessão e vínculo exato dentro da loja.
Pedidos convidados não são herdados automaticamente depois de cadastrar uma conta.
Convidado cria identidade de contato própria, sem atualizar um cliente autenticado
ou depender de unicidade de telefone. Uma conta pode ter uma identidade distinta
por loja; não se compartilham cookies ou senhas com o diretório ComércioBES.

O backfill usa somente relações reais de pedidos. Customer com pedidos de uma loja
recebe essa loja; Customer com pedidos de várias lojas ganha cópias por loja, com
referência à identidade legada preservada e snapshots dos pedidos intactos. O
original fica em quarentena. Customer sem pedido também permanece em quarentena,
sem loja nem vínculo de autenticação. Não existe fallback para a primeira loja.
Uma FK composta impede ligar pedido de uma loja ao Customer de outra.

Recuperação tem resposta genérica, redirecionamento é interno, senha preserva
espaços e OAuth só aparece quando habilitado explicitamente. Credenciais e operação
de confirmação/recuperação do Supabase continuam gates de ambiente; mocks locais
comprovam contratos e autorização, não entrega real do provedor.

A outbox existente continua durável e acionada por job. Não será substituída por
envio dependente de uma requisição aberta. O driver de desenvolvimento captura
mensagens localmente; Resend continua opção existente, sem envio nesta validação.
SMTP do PR não será ativado antes de definir o provedor operacional (#84).

## Implementado e validado localmente

- Rotas `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/minha-conta`
  e callback PKCE; Google fica oculto/desativado até `AUTH_GOOGLE_ENABLED=true`.
- Checkout usa e-mail da sessão e exige nova autenticação se a sessão expirar
  após abrir o formulário autenticado. IDs de identidade enviados pelo navegador
  não fazem parte do contrato aceito. Checkout convidado continua disponível.
- `20260925020000_scope_customer_accounts` é uma migration nova e transacional;
  a migration histórica insegura do PR não foi importada nem marcada como aplicada.
  A migration anterior de `StockAdjustment` e todas as correções de integridade
  foram mantidas.
- `Customer.storeId` é nulo somente em quarentena. Identidade autenticada é única
  por loja; telefone não tem unicidade de autenticação. `Order(customerId,storeId)`
  referencia a mesma loja de Customer e impede movimentação desse vínculo por update.
- Driver `development` grava em `.local/email-capture/<eventId>.json` (ignorado
  por Git), com criação exclusiva/idempotente e uso proibido em produção.
  O job da outbox já existente mantém tentativas, concessão de processamento e
  recuperação. Erros persistem códigos permitidos, não mensagens do provedor com PII.

Evidências desta revisão: 66 testes unitários, 42 integrações PostgreSQL, lint,
typecheck e build aprovados. O ensaio de migration cria schema vazio, aplica o
histórico anterior, insere identidades legadas de uma loja/múltiplas lojas/sem
pedido, migra e compara snapshots antes/depois. Depois remove o schema de teste.

Smoke HTTP local em servidor Next de produção, protegido pelo gate beta, com
PostgreSQL descartável e Supabase explicitamente desconfigurado: formulários de
login/cadastro/recuperação renderizaram 200; área de conta exigiu login; pedido
convidado persistiu e sua página abriu; checkout com sessão exigida retornou 401.
Isso comprova independência do checkout convidado, não autenticação externa real.
Fixtures foram removidas e servidor temporário encerrado.

## Gates que permanecem abertos

Supabase de staging com confirmação/recuperação e cookies reais (#75/#79), Google
se adotado (#76), revisão visual autenticada/mobile (#78), escolha/remetente do
e-mail (#84), ensaio com cópia restaurada dos dados reais e release autorizada
(#80/#98). A execução remota do novo job de CI ainda depende de publicação.
Não houve envio real de e-mail, cobrança, migration remota, merge do PR ou deploy.

O histórico por e-mail descrito nas issues antigas #73/#77 foi substituído pela
política mais restrita deste documento. A revisão deve atualizar os aceites antes
de fechar a reconciliação; não reaproveitar checks antigos como comprovação atual.
