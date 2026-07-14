# Admin MVP

## Autenticação

O painel usa Supabase Auth com e-mail e senha. `proxy.ts` atualiza cookies e
desvia visitantes sem sessão; as páginas validam a identidade novamente no
servidor com `auth.getUser()`. A identidade só recebe acesso quando existe um
`User` ativo no Prisma, vinculado pelo `authUserId` exato a uma `Store` ativa.
Não existe associação automática por e-mail: operadores antigos sem esse vínculo
devem ser reprovisionados pelo script de bootstrap.

Para provisionar o primeiro operador, configure no `.env` local:

```powershell
$env:ADMIN_EMAIL="operador@loja.com.br"
$env:ADMIN_PASSWORD="uma-senha-longa-e-unica"
$env:ADMIN_NAME="Nome do operador"
$env:ADMIN_ROLE="OWNER"
npm run admin:bootstrap
```

O script usa a service role somente no servidor, confirma o e-mail e cria o
vínculo Prisma. A senha não é persistida pelo Braga Commerce. Nunca coloque
`SUPABASE_SERVICE_ROLE_KEY` em variável `NEXT_PUBLIC_*`.

## Permissões

| Capacidade | OWNER | ADMIN | STAFF |
| --- | --- | --- | --- |
| Dashboard e leitura de catálogo/pedidos | Sim | Sim | Sim |
| Criar/editar produto e categoria | Sim | Sim | Não |
| Atualizar variação e estoque | Sim | Sim | Sim |
| Atualizar operação e nota interna | Sim | Sim | Sim |
| Configurar loja | Sim | Sim | Não |

Esconder um botão é apenas experiência visual. Cada Server Action repete a
validação de sessão, role e `storeId` antes da mutation.

## Domínio

- Produto simples controla `Product.stockQuantity`.
- Produto com variações ignora o estoque do produto e soma opções ativas.
- Alterar produto não reescreve snapshots de `OrderItem`.
- `Order.internalNote` nunca aparece no contrato público do pedido.
- Fulfillment tem transições direcionais; pedido entregue ou cancelado não é
  reaberto silenciosamente.
