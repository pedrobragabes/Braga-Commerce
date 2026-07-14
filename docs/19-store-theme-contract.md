# Contrato de tema por loja

## Decisão

O Braga Commerce continuará usando uma composição de storefront fixa e uma
identidade versionada por cliente. A configuração por loja será um conjunto
pequeno de overrides tipados, nunca HTML, CSS, JavaScript ou uma árvore livre de
blocos. Portanto, esta proposta **não cria page builder**.

## Estado atual comprovado

- `storefront/config/pv-moda.ts` define textos, blocos e todos os dez tokens
  visuais usados pela PV Moda.
- `StoreSettings.primaryColor` e `secondaryColor` são validados e persistidos
  pelo admin.
- O `StorefrontFrame` recebe somente `pvModaConfig`; não consulta as duas cores
  persistidas. Hoje, mudar esses campos no admin **não altera a vitrine**.
- Nome, contato, endereço, entrega e retirada já são resolvidos por loja e não
  fazem parte do contrato visual.

Enquanto não existir um resolver server-side de tema, as cores do banco são uma
proposta armazenada. A configuração versionada continua autoritativa.

## Camadas permitidas

| Camada | Origem | Pode mudar sem deploy | Responsabilidade |
| --- | --- | --- | --- |
| Direção de arte | `storefront/config/<cliente>.ts` | Não | Tipografia, ritmo, raio, paleta completa, textos e composição |
| Overrides seguros | `StoreSettings` | Futuramente | Cor de marca e cor de destaque, após validação |
| Conteúdo comercial | Modelos tipados futuros | Futuramente | Textos e imagens com tamanho, formato e destino limitados |
| Domínio | Componentes compartilhados | Não | Catálogo, preço, estoque, carrinho, checkout e pagamento |

Um override nunca pode alterar regra de preço, disponibilidade, pagamento,
permissão, consulta ou isolamento por `storeId`.

## Tokens

### Editáveis pela loja após implementação do resolver

| Campo do admin | Token resultante | Regra |
| --- | --- | --- |
| `primaryColor` | `brand` | Hexadecimal de seis dígitos; deve manter contraste para texto branco e controles |
| `secondaryColor` | `accent` | Hexadecimal de seis dígitos; não pode ser usado como texto sem contraste suficiente |

`accentStrong` e `brandSoft` devem ser derivados pelo servidor a partir das cores
aprovadas ou permanecer nos valores da direção de arte. O navegador nunca envia
um conjunto completo de tokens como fonte autoritativa.

### Exclusivos da direção de arte versionada

- `ink`, `paper`, `surface`, `line` e `muted`;
- `accentStrong` e `brandSoft`, quando não derivados;
- `radius`;
- famílias tipográficas, escala, espaçamento, sombras, motion e breakpoints.

Esses valores afetam legibilidade e composição em muitas telas. Liberá-los
isoladamente produziria combinações quebradas e aparência genérica.

## Blocos configuráveis sem page builder

A ordem estrutural permanece fixa:

1. anúncio;
2. cabeçalho e navegação;
3. hero;
4. benefícios;
5. categorias;
6. produtos em destaque;
7. história da loja;
8. rodapé.

Uma evolução futura pode permitir:

- ativar ou ocultar apenas anúncio, benefícios, destaques e história;
- editar campos explícitos de texto com limites de tamanho;
- escolher ícones em uma lista fechada;
- selecionar uma imagem já pertencente à loja;
- escolher CTA apenas entre rotas internas autorizadas e WhatsApp validado.

Não será permitido:

- reordenar, duplicar, aninhar ou criar tipos de bloco;
- inserir HTML, Markdown arbitrário, CSS, script, iframe ou URL de imagem externa;
- alterar header, carrinho, checkout, preço, estoque ou pagamento;
- salvar payload de editor visual como JSON livre.

## Validação e publicação futura

O resolver de tema deverá:

1. carregar a configuração versionada da loja;
2. buscar `StoreSettings` pelo `storeId` resolvido no servidor;
3. validar formato, contraste e lista de campos permitidos;
4. derivar tokens complementares;
5. aplicar apenas overrides válidos e retornar ao tema base em qualquer falha;
6. registrar somente IDs técnicos e resultado, nunca conteúdo pessoal.

Antes de publicar um override, a interface deverá oferecer preview desktop e
mobile, checar contraste mínimo de 4,5:1 para texto normal e permitir restaurar
o tema versionado. A publicação deve ser uma ação explícita de `OWNER` ou
`ADMIN`, com data e operador; `STAFF` permanece sem acesso.

## Próxima implementação necessária

A #50 encerra a definição. Aplicar cores persistidas exige uma issue separada
para criar o resolver server-side, testes de contraste, preview e rollback. A
#53 pode trabalhar a direção visual da PV Moda usando a configuração versionada,
mas não deve transformar essa etapa em editor de páginas.
