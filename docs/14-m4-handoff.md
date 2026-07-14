# Handoff — M4 Admin MVP em validação

Atualizado em: 14/07/2026

Este checkpoint existe porque o trabalho foi interrompido durante o smoke test
visual. **Não recomeçar do zero.** O código está compilando e a migration já foi
aplicada no Supabase.

## Implementado

- Supabase Auth SSR com cookies e renovação em `proxy.ts`.
- Vínculo seguro `authUserId -> User -> storeId`.
- Matriz OWNER/ADMIN/STAFF e autorização repetida em cada Server Action.
- Login e logout administrativo.
- Shell visual do painel e dashboard com dados reais.
- Lista, criação, edição e ativação de produtos.
- Produto simples com estoque próprio; produto com grade usa variações.
- Categorias com slug, ordem e publicação.
- Variações, tamanho, cor, preço e estoque.
- Lista e detalhe de pedidos por loja.
- Fulfillment com transições protegidas e nota interna separada.
- Configurações de contato, endereço, retirada, entrega e cores.
- Scripts `admin:bootstrap` e `admin:remove`.
- Documentação do admin em `docs/13-admin-mvp.md`.

## Correções do checkpoint de 14/07

- O vínculo administrativo agora aceita apenas o `authUserId` exato; não existe
  associação automática por coincidência de e-mail.
- Preço, estoque, ordem, UF e cores recebem validação server-side estrita.
- Pelo menos retirada ou entrega local deve permanecer ativa.
- Scripts administrativos não imprimem e-mail nos logs.
- O painel ganhou estados explícitos de carregamento e erro.
- `npm install` gera o Prisma Client, tornando o handoff reproduzível em checkout
  limpo.

## Validado neste checkpoint

- Migration `20260713163000_add_admin_fields` aplicada no Supabase.
- `npm run typecheck` aprovado.
- `npm run lint` aprovado.
- `npm run test`: 25 testes aprovados.
- `npm run build` aprovado, incluindo todas as rotas `/admin` e `proxy.ts`.
- Operador temporário criado com Supabase Admin API e removido ao terminar.
- Tela de login renderizada e inspecionada semanticamente.
- `npm install`, typecheck, lint, 25 testes e build aprovados novamente em
  14/07/2026 com Node 24.
- Produção atual respondeu em `https://braga-commerce.vercel.app`: storefront
  usa dados reais, `/admin` redireciona para `/admin/login` e credenciais
  inválidas exibem erro acessível sem criar sessão.
- Login revisado em 1440 × 900 e 390 × 844 sem overflow horizontal.

## Ainda não validado — não fechar M4 ainda

1. Completar login válido pelo formulário e confirmar cookie/redirecionamento.
2. Exercitar criação/edição de produto, categoria, variação e estoque pelo navegador.
3. Exercitar atualização de fulfillment e comprovar que `paymentStatus` não muda.
4. Testar STAFF sem acesso a configurações/criação de catálogo.
5. Fazer teste explícito de isolamento com uma segunda loja temporária.
6. Revisar dashboard, tabelas e formulários em desktop e celular.
7. Publicar este checkpoint e validar o novo deploy da Vercel.
8. Só então comentar e fechar as issues #20–#29 que tiverem todos os critérios
   comprovados.

## Bloqueio externo atual

Este computador não possui `.env` nem sessão do Vercel CLI. Para executar os
itens autenticados, configure localmente as variáveis do Supabase/Vercel ou faça
login no Vercel CLI e puxe o ambiente do projeto. A credencial necessária é a
service role do Supabase, além da URL/chave pública e `DATABASE_URL`; nenhuma
delas deve ser enviada em issue, commit, log ou chat. Até isso ocorrer, as issues
do M4 permanecem abertas.

## Como retomar em outro computador

```powershell
git pull origin main
npm install
npm run db:migrate:deploy
npm run typecheck
npm run lint
npm run test
npm run build
```

Copie para `.env` o snippet privado da integração Supabase/Vercel. Para criar o
operador real, defina localmente `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` e
`ADMIN_ROLE=OWNER`, depois execute:

```powershell
npm run admin:bootstrap
npm run dev
```

Não envie a senha ou service role para GitHub, issue, screenshot ou chat.

## Método usado

O trabalho segue `docs/12-delivery-workflow.md`: auditoria do milestone e issues,
plano por dependência, separação de autenticação/domínio/UI/persistência,
validação estática, migration, teste real temporário com limpeza, revisão visual,
publicação e evidências no GitHub. Como o smoke test não terminou, as issues do
M4 permanecem abertas deliberadamente.
