# Testes

## Pirâmide

- Unitários: dinheiro, slug, validações Zod e regras de transição de pedido.
- Integração: Prisma, criação de pedido, cálculo server-side e processamento idempotente de webhook.
- E2E: catálogo → carrinho → checkout → Mercado Pago sandbox → admin.

## Checklist manual antes do deploy

- Produto simples e com variação exibem preço e indisponibilidade corretamente.
- Alteração de quantidade e revalidação bloqueiam estoque insuficiente.
- Total enviado pelo cliente é ignorado e recalculado.
- Pagamento aprovado atualiza o pedido uma vez; notificação repetida não duplica nada.
- Admin sem sessão não acessa `/admin`; uploads inválidos são rejeitados.
- Layout funciona em celular e metadata/404/robots/sitemap estão presentes.
- `/api/health` responde 200 somente quando aplicação e banco estão disponíveis.
- Monitor externo e backup agendado possuem uma execução manual comprovada.
- Restauração é feita apenas em banco descartável e comparada com o schema atual.

## Gate automatizado

O workflow `Quality gate` roda em pull requests e pushes para `main` com Node
24.18: instalação pelo lockfile, audit completo de dependências, 52 testes
unitários, lint, typecheck e build. Dependabot verifica npm e GitHub Actions
semanalmente. Isso não substitui os smokes autenticados e o pagamento Sandbox.

## Evidência do Milestone 3

Sem credenciais de teste, os testes locais cobrem configuração, seleção segura
da URL, assinatura HMAC, mapeamento e proteção contra transições antigas. O item
de sandbox só pode ser fechado após um pagamento real de teste produzir uma
preferência, retorno e `PaymentEvent` no banco.

## Evidência do Milestone 4

- Unitário: matriz OWNER/ADMIN/STAFF, transições de fulfillment, slug e dinheiro.
- Integração: operador temporário no Supabase Auth vinculado a uma loja, login,
  isolamento por `storeId` e CRUD com limpeza posterior.
- Visual: dashboard, tabela, formulários e pedido em desktop/mobile.
- Produção: smoke autenticado com os três papéis, duas lojas, produto simples e
  com variação, categoria, pedido, configurações e limpeza comprovada.

O fixture pode ser repetido com `admin:smoke:setup`, `admin:smoke:verify` e
`admin:smoke:cleanup`. Identidades e senha são fornecidas somente por variáveis
locais e nunca são impressas pelo script.

## Integração comercial com PostgreSQL descartável

Crie um banco local vazio chamado `braga_integrity_test` e forneça sua conexão
somente em `BRAGA_TEST_DATABASE_URL`. Execute `npm run test:integration`: o comando
valida que o destino é loopback e que o nome do banco é exatamente o esperado,
aplica migrations versionadas e executa a suíte real. Não há fallback para `.env`,
Supabase ou banco de produção. O comando não cria nem apaga bancos automaticamente.
Fixtures sintéticas são removidas após cada teste; não há seed do piloto.

`npm test` continua executando os unitários e informa a integração como ignorada
quando a variável explícita não está definida. O job `commerce-integrity` do workflow
`Quality gate` possui PostgreSQL 16 dedicado, migra do zero e executa a integração.
Sua execução remota só é comprovada depois de publicar e consultar o resultado.

Em 25/09/2026: 69 casos de integração passaram em PostgreSQL 16 local, além dos
82 unitários no checkpoint `review-storage-verification.json` (schema/lint/types/build também aprovados). A última fatia de contas de pagamento tem 24 testes focados em 2 arquivos; ainda não há novo consolidado/build após ela. Não somar seleções como testes distintos. O primeiro teste concorrente revelou uma colisão real de chave única
no upsert de `PaymentEvent`; a regressão agora cobre a solução com insert atômico.
Somente o lookup do SDK de pagamentos é substituído por respostas sintéticas;
Prisma, transações, locks, constraints e outbox usam o banco real. A suíte também
injeta uma falha de escrita real na outbox e verifica rollback e nova tentativa.

A suíte cobre a fatia de #100, os ajustes e permissões de #99 e os gates de
atendimento de #101; o job prepara parte de #102. A autenticação externa é
substituída apenas na fronteira Supabase por uma identidade sintética; as actions
reais consultam o operador, papel e loja persistidos. Testes diretos cobrem STAFF,
ficha antiga após reserva, replay/conflito de ajuste e etapas de retirada/entrega.
Inclui duas lojas com contas/contatos iguais, checkout convidado, identidade
server-side, sessão expirada, FK composta, backfill legado em schema descartável
e processamento da outbox com captura local. Veja `20-customer-account.md`.
Inclui resolução operacional de `REQUIRES_REVIEW`: débito integral ou rollback,
duas revisões pela última unidade, decisões concorrentes, replay, STAFF, outra
loja, cancelamento sem inventar estorno e corrida contra reembolso confirmado.
Não certifica interface autenticada em navegador ou homologação do provedor.
Essas dependências continuam com aceite próprio.

O recorte posterior de tema/contratação acrescenta provisionamento idempotente,
membership de duas lojas, publicação e restauração independentes, contraste,
imagem alheia, gate de assinatura/validade, pagamento após cancelamento, host e
API cruzados e ponte com chave/allowlist/hash. Veja `21-assisted-store-lifecycle.md`
e `22-directory-bridge-v1.md`. O runtime de QA deixa duas fixtures identificadas
no banco local para a prova HTTP entre projetos; elas não são clientes publicados.

## Evidência do Milestone 5

- Unitário: roles de imagem, bucket seguro, JPG/PNG/WebP, SVG, MIME forjado e
  limite de 4 MiB.
- Integração: migration de `storagePath`, bucket idempotente, escrita anônima
  bloqueada, leitura pública e limpeza do objeto técnico.
- E2E: upload autenticado, ordem persistida, imagem principal no storefront,
  remoção de referência/objeto e bloqueio de STAFF.

`tests/integration/storage-integrity.test.ts` usa PostgreSQL real e somente troca
o cliente externo Storage por um simulador. Cobre exclusão concorrente, trigger
de falha no último write que desfaz imagem/journal, falha externa, falha DB depois
da remoção externa, ausência idempotente, lease/limite/retry, path cruzado, duas
lojas, referência ainda ativa, tema, upload confirmado/interrompido e worker sem
credencial. Não representa ensaio do bucket ou das políticas RLS reais.
