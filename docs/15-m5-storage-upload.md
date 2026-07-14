# M5 — Storage e imagens de produto

Atualizado em: 14/07/2026

## Arquitetura

- Bucket: `product-images` (ou o valor validado de `STORAGE_BUCKET`).
- Leitura: pública somente para objetos desse bucket, usada pelo storefront.
- Escrita e remoção: nunca são públicas. A rota valida sessão, operador, role e
  `storeId`, e só então usa a service role no servidor.
- Papéis: OWNER e ADMIN possuem `images:write`; STAFF recebe `403`.
- Caminho: `storeId/productId/UUID.ext`, sempre gerado pelo servidor.
- Banco: `ProductImage.storagePath` guarda a chave do objeto; `sortOrder` define
  a imagem principal e a ordem da galeria.

## Regras de arquivo

- Formatos aceitos: JPG, PNG e WebP.
- Limite: 4 MiB, abaixo do limite de corpo das funções da Vercel.
- O servidor confere MIME declarado e assinatura binária. Nome e extensão do
  arquivo do cliente não são usados.
- SVG, arquivo vazio, tipo forjado e arquivo acima do limite retornam erro claro
  sem criar referência no banco.

## Provisionamento

Com as variáveis privadas do Supabase e do banco configuradas:

```powershell
npm run db:migrate:deploy
npm run storage:setup
npm run storage:smoke
```

`storage:setup` é idempotente: cria/atualiza o bucket, limita MIME/tamanho e
aplica apenas a política `SELECT`. O SQL equivalente está em
`supabase/storage-product-images.sql`. `storage:smoke` comprova que escrita
anônima falha, leitura pública funciona e remove o arquivo técnico.

## Fluxo administrativo

No detalhe do produto, o operador autorizado envia a foto e um texto
alternativo. `POST /api/upload` valida o produto dentro da loja, grava o objeto e
só então cria `ProductImage`. Se a persistência falhar, o objeto é removido.

Setas alteram a ordem persistida; o primeiro item é a imagem principal no card,
carrinho e página de produto. Ao remover, o objeto do Storage é excluído antes
da referência e as posições restantes são normalizadas. Registros legados sem
`storagePath` removem somente a referência.

## Checklist de smoke

- [x] Bucket público apenas para leitura.
- [x] Upload anônimo bloqueado.
- [x] Leitura da URL pública confirmada.
- [x] Arquivo técnico removido após o smoke de Storage.
- [x] OWNER/ADMIN enviam, ordenam e removem pelo painel publicado.
- [x] STAFF recebe `403` na API e não vê controles de imagem.
- [x] JPG/PNG/WebP válidos aparecem no storefront publicado.
- [x] SVG, MIME forjado e arquivo acima de 4 MiB retornam `400`.

## Evidência final

- `POST /api/upload` retornou `401` sem sessão e `403` para STAFF.
- SVG, MIME forjado e arquivo acima de 4 MiB retornaram `400` sem criar objeto.
- Dois PNGs foram enviados, persistidos e lidos pelas URLs públicas.
- A segunda imagem foi movida para a primeira posição; reload e storefront
  confirmaram que ela se tornou a imagem principal.
- A remoção apagou objeto e referência, e normalizou `sortOrder` da imagem
  restante.
- OWNER recebeu controles de upload; STAFF visualizou a galeria somente para
  leitura.
- Revisão em 390 px confirmou conteúdo, lista e formulário dentro de 351 px,
  sem overflow horizontal.
- `images:smoke:cleanup` removeu a imagem restante; os dois operadores técnicos
  foram removidos do Supabase Auth e do Prisma.
