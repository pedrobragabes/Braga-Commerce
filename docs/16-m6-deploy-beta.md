# M6 — Deploy beta e operação

## Estado verificável

| Issue                    | Entrega automática                                                                                            | Dependência manual para aceite                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| #36 Vercel e ambiente    | Projeto ligado; Production, Preview e Development possuem escopos separados e builds comprovados              | Nenhuma                                                                               |
| #37 Banco e migrations   | `prisma migrate deploy` executa no deploy de Production; Supabase não produtivo possui schema e seed próprios | Nenhuma                                                                               |
| #38 Domínio, DNS e HTTPS | Headers HTTPS e URL canônica estão preparados                                                                 | Informar o domínio comprado e acesso ao DNS; apontar para a Vercel e validar HTTPS    |
| #39 SEO técnico          | Metadata, canonical, Open Graph, `robots.txt`, `sitemap.xml` e 404                                            | Nenhuma                                                                               |
| #40 Observabilidade      | Logs estruturados sem PII, `/api/health` e monitor externo no GitHub Actions                                  | Ativar notificações de falha do Actions para o responsável pela operação              |
| #41 Backup               | Exportação diária criptografada e retenção de 30 dias preparadas                                              | Cadastrar secrets, executar o workflow e comprovar restauração em banco descartável   |
| #42 Pedido ponta a ponta | Fluxo técnico implementado desde M3                                                                           | Fornecer credenciais sandbox, registrar webhook e concluir um pagamento real de teste |
| #56 Reserva de estoque   | Baixa atômica de produto simples/variação e estado de revisão para pagamento tardio                           | Nenhuma após smoke de produção                                                        |
| #57 Expiração            | Reserva por 30 minutos e GitHub Actions autenticado a cada 10 minutos                                         | Manter Actions habilitado no repositório                                              |
| #58 Rate limiting        | Buckets persistentes por HMAC nas APIs públicas                                                               | Nenhuma após smoke de produção                                                        |
| #59 Datas comerciais     | `paidAt`, `cancelledAt`, `refundedAt` e relatório por confirmação                                             | Nenhuma após smoke de produção                                                        |

Os bloqueios manuais permanecem nas issues obrigatórias do M6. A issue operacional
do M7 é um espelho consolidado para o responsável pela loja e não substitui os
critérios de aceite.

Enquanto esses bloqueios existirem, Production usa um gate temporário de senha.
`SITE_ACCESS_PASSWORD` e `SITE_ACCESS_SECRET` ficam apenas na Vercel; health,
`robots.txt` e o webhook do Mercado Pago permanecem públicos. Remover o gate no
go-live exige apagar as duas variáveis e fazer um novo deploy.

## Ambientes

O projeto Vercel `errinhopogs-projects/braga-commerce` está ligado ao repositório.
Em 14/07/2026, foi criado o Supabase `braga-commerce-development`, na região de
São Paulo, exclusivamente para Preview e Development. A comparação por hash dos
identificadores confirmou que ele é diferente de Production, sem imprimir URLs,
senhas ou chaves. Nenhuma credencial de Mercado Pago estava presente.

Configuração desejada:

- Production: Supabase de produção, `MERCADO_PAGO_ENV=production` quando o piloto
  estiver aprovado, URL pública definitiva e webhook de produção.
- Preview: Supabase `braga-commerce-development`; credenciais sandbox de pagamento
  ainda pendentes; deployments protegidos pela autenticação Vercel.
- Development: o mesmo Supabase não produtivo de Preview, acessado com `vercel env
run` ou `vercel env pull --environment=development`.

O build da Vercel usa `npm run vercel-build`. A migration só roda quando
`VERCEL_ENV=production`; Preview e desenvolvimento nunca aplicam migrations no
banco de produção por esse script.

Evidências dos ambientes:

- 5 migrations aplicadas e `prisma migrate status` atualizado em Production,
  Preview e Development;
- seed da PV Moda aplicado;
- bucket `product-images` com leitura pública e escrita anônima bloqueada;
- Preview `dpl_BHvRnMQvsanBUTdrExRXB5nMfSM4` com build Ready;
- smoke autenticado do Preview: home, sitemap e `/api/health` com banco `ok`.

## Backup criptografado

O workflow `Encrypted database backup` executa diariamente e também aceita
execução manual. Ele gera um dump lógico, cifra com AES-256/PBKDF2 antes do upload
e retém apenas o artefato cifrado por 30 dias. O dump em texto claro é removido no
runner.

Cadastre em **GitHub > Settings > Secrets and variables > Actions**:

- `DATABASE_BACKUP_URL`: conexão direta ou session pooler somente do banco de
  produção, com TLS.
- `BACKUP_ENCRYPTION_PASSPHRASE`: frase aleatória longa, guardada fora do GitHub
  em um gerenciador de senhas.

Depois, execute manualmente `Encrypted database backup` e baixe um artefato para
o teste de restauração. Em uma máquina com OpenSSL e PostgreSQL Client:

```sh
openssl enc -d -aes-256-cbc -pbkdf2 -in database-RUN_ID.dump.enc -out database.dump -pass env:BACKUP_ENCRYPTION_PASSPHRASE
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$RESTORE_DATABASE_URL" database.dump
```

`RESTORE_DATABASE_URL` deve apontar exclusivamente para um projeto descartável,
nunca para Production. Após restaurar, executar `npx prisma migrate status`, abrir
o storefront contra esse banco e conferir loja, categorias, produtos e pedidos.
Apagar o dump decifrado ao final. Registrar na #41 o run do backup, data do teste,
destino descartável e resultado, sem colar URLs, senhas ou dados de clientes.

No Supabase Free, backups automáticos não fazem parte do plano. Como alternativa
à rotina acima, migrar Production para Pro ativa backups diários gerenciados, mas
o teste de restauração continua obrigatório e o Storage precisa de estratégia
própria, pois o backup do banco contém apenas metadados dos objetos.

## Go-live e rollback

1. Confirmar que Preview e Development não usam Production.
2. Validar backup restaurável.
3. Configurar domínio, HTTPS e `NEXT_PUBLIC_APP_URL`.
4. Configurar Mercado Pago sandbox e testar aprovação, rejeição e webhook repetido.
5. Fazer um pedido controlado e conferir status no admin.
6. Promover credenciais de produção somente após as evidências anteriores.

Rollback: reverter a release pela Vercel. Banco só volta por migration corretiva
ou backup validado; nunca editar manualmente tabelas de pedido/pagamento para
simular sucesso.

## Pós — ações manuais do responsável

Estas ações não devem ser simuladas pelo desenvolvimento e permanecem abertas até
existir evidência real:

1. Comprar/definir o domínio, apontar o DNS para a Vercel, atualizar
   `NEXT_PUBLIC_APP_URL` e validar HTTPS, canonical e webhook no domínio final (#38).
2. Guardar `DATABASE_BACKUP_URL` e `BACKUP_ENCRYPTION_PASSPHRASE` nos secrets do
   GitHub, executar o backup e restaurá-lo em banco descartável (#41).
3. Fornecer as credenciais Sandbox do Mercado Pago, registrar o webhook e executar
   aprovação, rejeição, repetição do webhook e pagamento após abandono (#15, #19 e #42).
4. Revisar e aprovar o texto de `/trocas` e `/privacidade`, confirmando canais,
   prazos e fornecedores citados antes de fechar #47.
5. Escolher domínio/remetente e provedor de e-mail. Para o driver preparado,
   configurar `EMAIL_DRIVER=resend`, `EMAIL_FROM` verificado e `RESEND_API_KEY` na
   Vercel; então testar criação, pagamento, cancelamento e reembolso antes de fechar #46.
6. Ativar notificações de falha dos workflows de disponibilidade, expiração e
   backup para uma pessoa responsável pela operação.
7. No go-live, remover `SITE_ACCESS_PASSWORD` e `SITE_ACCESS_SECRET`, publicar de
   novo e só então divulgar a loja. Até lá, o beta continua protegido por senha.
8. Baixar a CA de Production em **Supabase > Database Settings > SSL
   Configuration**, cadastrar o PEM como `DATABASE_SSL_CA` na Vercel e comprovar
   uma conexão com validação de cadeia/hostname. O pooler está criptografado, mas
   sem essa variável o processo Node ainda usa `sslmode=no-verify` por
   compatibilidade com a cadeia do Supavisor.
