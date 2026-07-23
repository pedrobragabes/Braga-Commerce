# Auditoria da ponte Comércio BES → Braga Commerce

> Escopo: issue #81. Auditoria somente de leitura em 22/07/2026; não autoriza
> integração, sincronização, deploy ou alteração no repositório Comércio BES.

## Resultado

O menor fluxo útil é manter o **Comércio BES** como diretório local e encaminhar
a PV Moda para a URL canônica do **Braga Commerce** quando o piloto comercial
estiver estável. Não é recomendado fundir repositórios, compartilhar banco,
replicar checkout ou criar SSO neste estágio.

## Estado confirmado

| Área | Braga Commerce | Comércio BES | Decisão |
| --- | --- | --- | --- |
| Descoberta e perfil público | Não é o foco | Perfil, endereço, fotos, WhatsApp e leads | Comércio BES |
| Catálogo transacional | Produto, variação e estoque por loja | Catálogo simples do diretório | Braga Commerce no piloto pago |
| Carrinho, pedido e pagamento | Recalculados no servidor e isolados por loja | API de pedidos existe, mas o pivot público congela checkout | Braga Commerce |
| Identidade | Supabase Auth para admin e conta do cliente | JWT/cookies e modelos próprios | Sem SSO ou compartilhamento de usuários |
| Banco e deploy | PostgreSQL/Supabase e Vercel | PostgreSQL/Prisma e Docker/Caddy | Bancos e ambientes independentes |

O checkout público do Comércio BES já chama `/api/pedidos`, enquanto o fluxo de
WhatsApp é explicitamente externo. Isso não muda a decisão de produto atual:
o diretório piloto não deve expor checkout até que a vitrine esteja validada.

## Riscos e limites

- Os modelos, identificadores e autenticação dos projetos são diferentes; copiar
  usuários, pedidos ou estoque criaria inconsistência e ampliaria o tratamento
  de dados pessoais.
- A pasta `backend/public` do Comércio BES é saída de build. Qualquer evolução
  futura deve ocorrer nos módulos-fonte e passar pelo build, não por edição do
  conteúdo gerado.
- O worktree do Comércio BES tinha alterações locais não relacionadas nesta
  auditoria; nenhuma delas foi alterada ou considerada evidência de release.

## Alternativas comparadas

| Alternativa | Custo e risco | Decisão |
| --- | --- | --- |
| Link canônico do perfil para a loja | Baixo; não compartilha estado nem PII | Recomendado para #83 |
| Sincronizar catálogo/estoque | Médio/alto; exige IDs, reconciliação e observabilidade | Adiar até contrato aprovado (#82) |
| Integrar pedidos, carrinho ou pagamento | Alto; duplica fonte de verdade e obrigações de segurança | Não fazer |

## Próximo passo e critérios

Depois de M6/M8 estarem estáveis, a #82 deve fixar uma única URL canônica,
parâmetros permitidos sem PII, métrica agregada de saída e o comportamento para
loja indisponível. Só então a #83 pode adicionar o CTA do perfil PV Moda para o
Braga Commerce e validar o caminho em desktop e mobile.

Referências: `docs/COMERCIOBES-BRIDGE.md`,
`C:\Users\pedro\Documents\Projetos\Comercio_BES\docs\BRAGA-COMMERCE-BRIDGE.md`
e as issues #81–#83.
