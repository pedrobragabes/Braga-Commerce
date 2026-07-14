# Handoff — M4 Admin MVP concluído

Atualizado em: 14/07/2026

O Admin MVP foi validado no ambiente de produção e está pronto para operação.
A migration foi aplicada no Supabase e os dados técnicos usados no smoke test
foram removidos do Auth e do banco.

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
- Fixture reproduzível `admin:smoke:setup`, `admin:smoke:verify` e
  `admin:smoke:cleanup`, sem dados sensíveis nos logs.
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

## Evidência final de 14/07/2026

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
- Login válido criou sessão SSR e redirecionou para o dashboard; logout e remoção
  da identidade invalidaram o acesso.
- OWNER criou e editou categoria, produto e variação, alterou estoque e confirmou
  a persistência. Produto inativo deixou de responder na vitrine.
- O pedido técnico exibiu snapshots, recebeu nota interna e avançou o fulfillment
  para `PREPARING` sem alterar `paymentStatus=WAITING_PAYMENT`; a nota não apareceu
  na rota pública do pedido.
- STAFF não viu configurações, foi redirecionado ao tentar abrir configurações ou
  criar produto e conseguiu alterar somente o estoque da variação.
- ADMIN acessou configurações e o formulário de novo produto em produção.
- Uma segunda loja temporária exibiu catálogo e pedidos vazios, criou produto
  próprio e alterou identidade visual sem vazar dados para a PV Moda. A sessão da
  PV recebeu 404 ao tentar abrir o produto da segunda loja.
- Dashboard, tabelas e formulários foram revisados em desktop e celular. Em 390 px,
  shell, conteúdo e tabela permaneceram dentro da largura, sem overflow horizontal.
- Estados de carregamento, vazio, sucesso, bloqueio e 404 foram exercitados.
- A limpeza confirmou zero operadores, pedidos, produtos, categorias e lojas
  temporários restantes; a vitrine também não exibiu os registros técnicos.

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

Para criar um operador real, defina localmente `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
`ADMIN_NAME` e `ADMIN_ROLE=OWNER`, depois execute:

```powershell
npm run admin:bootstrap
npm run dev
```

Não envie a senha ou service role para GitHub, issue, screenshot ou chat.

## Método usado

O trabalho segue `docs/12-delivery-workflow.md`: auditoria do milestone e issues,
plano por dependência, separação de autenticação/domínio/UI/persistência,
validação estática, migration, teste real temporário com limpeza, revisão visual,
publicação e evidências no GitHub.
