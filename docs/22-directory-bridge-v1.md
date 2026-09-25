# Ponte de leitura ComércioBES — v1

O produtor não consulta nem escreve no banco BES. A primeira entrega é um deep
link autorizado; não anuncia sincronização de catálogo, SSO ou checkout no BES.

## HTTP

`GET /api/integrations/bes/v1/stores/[externalStoreId]`

Exige `Authorization: Bearer <BES_BRIDGE_API_KEY>` (mínimo 32 caracteres) e
`externalStoreId` em `BES_BRIDGE_STORE_IDS` (IDs separados por vírgula). A chave
é servidor-servidor: nunca deve chegar ao JavaScript da vitrine. A comparação
usa hashes de tamanho fixo e tempo constante.

```json
{
  "schemaVersion": 1,
  "store": {
    "id": "ID_DA_STORE",
    "displayName": "Nome publicado",
    "canonicalUrl": "https://loja.exemplo.com.br",
    "commerceEnabled": true,
    "directoryBinding": {
      "commerceId": 19,
      "origin": "https://comerciobes.com.br",
      "challengeHash": "SHA256_HEX_64"
    }
  },
  "fetchedAt": "2026-09-25T00:00:00.000Z"
}
```

Sem vínculo, `directoryBinding` é `null`. Sem chave: 401. Loja fora da allowlist,
inexistente ou sem canonical seguro: 404. Falha de banco: 503. Respostas usam
`Cache-Control: private, no-store`; não há resposta fake ou snapshot antigo.

`commerceEnabled` considera disponibilidade operacional e vigência da assinatura,
incluindo plano que autoriza checkout. Cancelamento comercial não remove binding,
pedidos ou perfil BES; o consumidor deve cortar a chamada comercial imediatamente.

## Prova de vínculo

1. Dono autenticado no BES solicita a associação e recebe uma string hexadecimal
   aleatória de 64 caracteres (256 bits), exibida uma única vez.
2. OWNER/ADMIN autenticado no Braga abre **Integrações**, informa o ID do perfil,
   origem exata BES e o código. STAFF e operadores alheios são recusados pelo
   serviço, mesmo chamando a ação diretamente.
3. Braga persiste apenas `SHA-256(UTF-8(challenge))`, nunca o código original.
4. BES consulta a API com chave de serviço e verifica ID, origem e hash antes de
   ativar o link. Sem matching de nome, telefone ou e-mail.
5. Remoção no Braga muda a projeção imediatamente para `null`; desativação no BES
   é independente. Reutilizar um perfil BES em duas Stores é recusado pela unique.

`BES_ALLOWED_ORIGINS` contém origens HTTPS exatas. HTTP loopback só é aceito com
`BES_BRIDGE_MODE=local` e ambiente de teste ou prévia protegida por senha. Isso
serve ao QA local e não é um modo de autenticação alternativo.

## URL canônica e operação

`Store.domain` é atribuído pela operação central após verificação de autorização,
DNS e HTTPS. O hostname também precisa estar em `STORE_PUBLIC_ALLOWED_HOSTS`.
Não são aceitos credenciais na URL, porta, query ou fragmento. Sem domínio, apenas
a loja fixa `STORE_SLUG` pode usar `NEXT_PUBLIC_APP_URL` HTTPS/allowlisted.

O endpoint integra a allowlist de rotas dispensadas da senha de beta porque já
exige a chave específica de leitura. Não libera outras rotas administrativas.

## Evidência local de 25/09/2026

- PostgreSQL real: chave/allowlist, canonical inválido, hash, tenant alheio,
  cancelamento e remoção de binding exercitados.
- HTTP real Next4320: 401 sem chave, projeção autorizada, UI protegida e dois hosts
  sintéticos com apresentações independentes. Nenhum host fictício foi publicado.
- Consumidor Express4317 ↔ produtor Next4320: login BES real, solicitação, binding,
  verificação, CTA disponível, cancelamento corta CTA mantendo perfil 200,
  reativação e desativação final. Evidência no BES em
  `.preview/master-audit/live-bridge-verification.json` (artefato local ignorado).
- O operador Braga desta prova é uma fixture que chama o serviço autorizado. Não
  houve login Supabase real, e-mail, Mercado Pago ou homologação produtiva.
- O vínculo fictício terminou DESATIVADO no BES. Fixtures ficam somente no banco
  `braga_integrity_test`; o runtime de QA escuta apenas `127.0.0.1:4320`.
