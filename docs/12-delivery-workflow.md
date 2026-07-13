# Regra de execução por milestone

Este documento descreve o formato usado para construir o Braga Commerce. Ele é a
regra operacional para as próximas entregas.

## Hierarquia

```text
Produto
└── Milestone: resultado comercial/técnico observável
    ├── Issue: unidade de entrega com aceite verificável
    ├── Issue
    └── Issue
        └── Tasks locais: passos de implementação e validação
```

- **Milestone** responde “qual capacidade ficará pronta?”.
- **Issue** responde “qual parte independente precisa ser entregue?”.
- **Task local** responde “o que será feito agora para concluir a issue?”.
- **Evidência** prova o aceite: teste, rota, estado no banco, screenshot ou deploy.

## Formato de uma issue

```markdown
## Objetivo
Uma capacidade concreta, sem misturar fases futuras.

## Aceite
- Comportamento observável e testável.
- Regra de segurança ou integridade aplicável.

## Fora do escopo
- O que pertence a outro milestone.

## Evidências esperadas
- Testes, rotas, banco, interface ou deploy que comprovam a entrega.
```

## Ciclo obrigatório

1. **Auditoria:** confirmar `git status`, commit atual, milestone, issues, banco,
   variáveis e deploy existente.
2. **Plano:** ordenar as issues por dependência e manter somente uma etapa em
   andamento.
3. **Implementação:** separar UI, configuração do cliente, domínio, persistência
   e provedor externo.
4. **Validação estática:** executar testes, lint, typecheck e build.
5. **Validação real:** testar rotas e estado persistido; limpar dados de teste.
6. **Revisão visual:** conferir desktop/mobile e estados vazio, erro, carregamento
   e sucesso quando houver interface.
7. **Publicação:** revisar o diff, excluir secrets, commitar e publicar conforme
   a estratégia autorizada.
8. **Produção:** esperar a Vercel, testar a URL pública e as APIs aplicáveis.
9. **GitHub:** comentar evidências, fechar issues concluídas e atualizar o texto
   do milestone.
10. **Handoff:** informar commit, deploy, testes, decisões e próximo bloqueio.

## Regra de fechamento

Uma issue não é fechada porque o código “parece pronto”. Ela é fechada quando os
itens de aceite foram exercitados. Um bloqueio externo — credencial, DNS,
aprovação comercial ou conta de provedor — permanece aberto e documentado.

O milestone só fecha com `open_issues = 0`. Entregas parciais ficam visíveis, não
são escondidas por um fechamento otimista.

## Segurança e dados de teste

- O navegador envia identificadores e intenção; o servidor decide preço,
  estoque, autorização e estado.
- Secrets ficam apenas no ambiente do servidor.
- Logs usam IDs técnicos e resultado, nunca token, endereço, telefone ou e-mail.
- Testes que criam registros externos devem removê-los ao terminar.
- Retornos do navegador não confirmam pagamento; somente consulta autenticada e
  webhook validado alteram o pedido.

## Regra visual

Cada cliente parte de componentes comuns, mas recebe direção visual própria.
Tokens não substituem direção de arte. Polimento inclui tipografia, ritmo,
composição, imagens, estados, microinterações e motion com
`prefers-reduced-motion`. A revisão visual não pode alterar silenciosamente regra
de negócio.
