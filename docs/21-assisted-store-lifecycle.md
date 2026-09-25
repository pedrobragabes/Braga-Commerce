# Tema e contratação assistida — decisão antes da implementação

25/09/2026. Recorte E4/E5 do prompt mestre, relacionado a #51, #53 e #105.
Os milestones M10/M11 e todas as suas issues foram lidos. As condições antigas
de adiamento são substituídas pelo pedido atual; preços, provedores e aceites
externos continuam sem aprovação. Não há merge do PR85.

## Decisões

- Evoluir `Store` e `StoreSettings`. Resolver o contexto público pelo hostname
  cadastrado e único; uma instância sem domínio pode fixar `STORE_SLUG`. O host
  seleciona conteúdo público, nunca concede permissão administrativa. Não usar
  um tenant global mutável ou aceitar `x-store-id` como autorização.
- Tratar `User` como vínculo de operador por loja, preservando IDs existentes.
  Seleção de contexto deve conferir o vínculo vigente pelo `authUserId` real.
  Administração comercial central usa `PlatformOperator` separado: um OWNER
  de loja não pode conceder sua própria assinatura.
- Tema com contrato v1 fechado, revisões persistidas e ponteiros independentes
  para rascunho/publicação. Publicar/restaurar requer OWNER/ADMIN; o rascunho
  nunca entra nas leituras públicas. Imagens vêm de arquivos da própria loja.
  Sem HTML/CSS/JS arbitrário. Fontes e seções pertencem a listas fechadas.
- `Plan` é uma versão imutável de condições configuradas pelo responsável,
  sem preço ou duração inventados. `StoreApplication` registra pedido e aceite;
  provisionamento transacional e idempotente cria Store, vínculo e Subscription.
  Concessão administrativa/cortesia e confirmação externa são origens distintas.
- `Subscription` autoriza novas compras no servidor dentro da transação que
  reserva estoque. Mudança comercial usa o mesmo lock de loja. Encerramento no
  fim do período respeita o limite; cancelamento/suspensão imediatos bloqueiam
  novas compras. Não interrompem pedidos existentes, webhooks, expiração ou
  histórico. Não escrevem no ComércioBES.
- Lojas preexistentes recebem marca explícita de piloto legado, preservando
  operação atual sem fabricar pagamento/assinatura. Novas lojas são assistidas
  e não ganham acesso por ausência de Subscription.
- Credencial global Mercado Pago só pode atender a loja explicitamente vinculada
  pela configuração do servidor. Segunda loja permanece sem pagamento real até
  integração com credencial/beneficiário próprios, nunca recebe pela conta alheia.

## Sequência verificável

1. Migração aditiva, funções de autorização/provisionamento e testes PostgreSQL.
2. Resolver, tema publicado/rascunho e editor com preview/restauração.
3. Solicitação e operação assistida; provas com duas lojas sintéticas.
4. Build, lint, typecheck, testes e smoke renderizado; registrar gates reais.

## Critérios que esta fatia não encerra sozinha

#51 requer homologação de credenciais, Storage, pagamentos/estornos e dois pilotos;
#53 requer revisão visual/mobile do conjunto; #105 requer custo, preço e suporte
validados pelo responsável. #106 (agente) e #107 (recorrência automática) não são
implementados nem comercializados nesta fatia. Nenhum milestone inteiro deve ser
fechado apenas com testes de domínio locais.

## Implementação e evidências locais

- Migration `20260925030000_store_lifecycle`: modo comercial explícito,
  membership único por Store/Auth (IDs preservados), tema v1, revisões,
  auditoria, Plan, Subscription, StoreApplication e PlatformOperator.
- `/admin/tema` edita campos tipados, imagens pertencentes à loja, duas fontes e
  duas apresentações. Quatro seções suportadas podem ser ocultadas/reordenadas.
  Rascunho não muda a publicação. Preview privado tem largura computador/celular;
  publicar/restaurar confere versão esperada e registra o operador. A exceção CSP
  SAMEORIGIN vale só para o preview privado; o restante continua sem framing.
- `/solicitar-loja` oferece solicitação sem oferta fabricada, aceite de proposta
  publicada, acompanhamento e motivo de rejeição. `/platform` é reservado a
  PlatformOperator e registra versão de condições, provisionamento, recusa,
  vigência, origem da concessão e atribuição de domínio aprovado.
- A criação é transacional. Repetir a mesma solicitação/provisionamento não duplica
  loja, assinatura ou proprietário. Um `User` representa membership por loja;
  `/admin/selecionar-loja` verifica o vínculo atual, inclusive após revogação.
- Gate comercial usa `FOR NO KEY UPDATE` na Store antes da reserva. O primeiro
  ensaio com `FOR UPDATE` revelou deadlock contra os FK checks de estoque/outbox;
  o lock atual serializa o acesso sem bloquear `KEY SHARE`. Checkout e mudança
  de assinatura compartilham esse lock. Pagamento/expiração existentes não consultam
  a assinatura, e cancelamento não escreve no BES.
- Contexto público vem de domínio cadastrado ou instância `STORE_SLUG` explícita.
  APIs com payload de outra loja retornam 404. Catálogo, tema, metadata, carrinho,
  histórico, sitemap e URLs de Auth usam o contexto. Loja inativa perde catálogo e
  sitemap; histórico e pedidos continuam consultáveis. Indisponibilidade comercial
  aparece com mensagem neutra, sem expor dados de cobrança.
- Mercado Pago global foi limitado a `MERCADO_PAGO_STORE_SLUG`; outra loja não
  recebe preferência nem aplica webhook com essa credencial. A descrição usa a
  loja do pedido e BRL é conferido no webhook. Isso é bloqueio seguro da segunda
  credencial ainda não configurada, não integração multirrecebedor concluída.
- 52 integrações PostgreSQL e 66 unitários aprovados; lint, typecheck, build e
  Prisma diff vazio contra banco local. Dois hosts sintéticos serviram HTML e
  metadata diferentes, com marcas distintas e sem herdar “PV Moda”. O teste HTTP
  rejeitou payload cruzado e manteve beta protegido.
- A ponte do `22-directory-bridge-v1.md` também passou pelo consumidor Express do
  BES e produtor Next em processos reais. O perfil BES ficou publicado quando a
  assinatura da fixture foi cancelada, e o vínculo fictício terminou desativado.

## Operação inicial e limites restantes

A administração central exige um `PlatformOperator.authUserId` real, confirmado e
aprovado pelo responsável. Não existe autocadastro de administrador central nem
promoção por e-mail. Os operadores locais usados nos testes são sintéticos; isso
não certifica login, confirmação, recuperação ou OAuth reais do Supabase.

Condições/versões publicadas não são editadas pelo serviço: mudanças geram nova
versão. A aplicação não emite recibo ou faz cobrança recorrente. Atribuição de
domínio exige allowlist no servidor e conferência operacional de DNS/HTTPS.

Continuam faltando: credenciais e beneficiário de pagamento próprios por loja,
ensaio real de Storage por tenant, revisão visual autenticada em
360/390/768/1280/1440 px e homologação de Auth/e-mail/provedores reais. O editor
usa as imagens já enviadas por produtos; não foi criada biblioteca de mídia
independente. Nenhum aceite externo foi convertido em check local fictício.

## Fatia seguinte — revisão de estoque e exclusão durável (decisão prévia)

25/09/2026, #101; relidos #99–#102 e o milestone M6.1. A revisão paga passa a
ter duas decisões administrativas explícitas (OWNER/ADMIN; STAFF não resolve):

- `COMMIT_STOCK`: exige pagamento PAID, estoque REQUIRES_REVIEW, atendimento
  ainda não iniciado e versão atual do pedido. Debita novamente cada item do
  saldo disponível com predicado `saldo >= quantidade`, em uma única transação.
  A falta de qualquer item desfaz todos os débitos. Só então muda para COMMITTED.
- `CANCEL_FULFILLMENT`: encerra o atendimento e marca estoque RELEASED sem
  incrementar saldo (a reserva anterior já foi liberada). Mantém PAID, valores,
  IDs de pagamento e datas financeiras. O operador deve executar/conferir o
  estorno no provedor; somente webhook validado confirma REFUNDED.

As decisões guardam ator, loja, motivo, ação, versão anterior e requestId único.
O lock do pedido é o mesmo do webhook/expiração/atendimento. Replay da mesma
intenção retorna o registro; requestId reaproveitado com intenção diferente e
formulário desatualizado falham. A versão operacional avança com todos esses
escritores. Não há consumo de uma assinatura nova para resolver pedido antigo.

A exclusão de mídia deixa de apagar Storage antes de confirmar o banco. Uma
transação retira a referência da galeria e cria `StorageDeletionJob` com bucket
e path exatos. Rollback conserva a galeria e não toca Storage. Worker autorizado
retoma jobs por lease, tenta exclusão idempotente e confirma por token de claim;
falha de Storage/banco conserva a tarefa para retry. O mesmo journal é criado
antes de um upload para limpar objeto órfão caso a vinculação falhe ou o processo
pare; a vinculação confirmada cancela a limpeza na mesma transação. Paths são
únicos por upload, nunca reutilizados. Não remover objeto de outra loja nem
objeto ainda referenciado. Imagem atualmente usada pelo tema exige substituição
antes da exclusão. Falhas definitivas ficam visíveis e permitem retry operacional.

Provas previstas: concorrência/resolução/replay/STAFF/loja alheia/estoque parcial,
cancelamento sem estorno fictício, falha DB antes/depois do Storage, falha externa,
lease retomável e API de job protegida. Somente PostgreSQL local isolado e Storage
simulado; credenciais reais, recebedor por loja e homologação externa permanecem gates.

Implementado com migrations `20260925050000_inventory_review_resolution` e
`20260925060000_storage_deletion_outbox`. Resolução e histórico aparecem no pedido;
limpeza pendente/bloqueada e retry autorizado aparecem na ficha do produto. Jobs
guardam path/bucket/ator sem payload de sessão. Os paths nunca são reutilizados;
o timeout HTTP total de Storage é 10 s, inferior à lease de 60 s. O worker usa
claimToken no CAS final e não promete exatamente uma chamada externa: remoção
repetida de objeto ausente é segura, inclusive após falha de confirmação no banco.

Executar `POST /api/jobs/storage/cleanup` com Bearer `JOB_SECRET` no agendador do
servidor. O workflow existente de manutenção inclui essa chamada a cada 10 min;
a execução remota depende de publicar/configurar o secret. Não foi disparado em
produção. Após 10 falhas a tarefa fica BLOCKED, visível ao operador. O retry
registra auditoria e mantém validação de tenant/path e de referência ativa.
Revisões antigas de tema continuam preservadas; restaurar uma revisão cuja imagem
foi removida exige antes uma imagem válida, sem ressuscitar arquivo excluído.
