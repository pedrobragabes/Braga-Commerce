# Checklist de segurança

- [ ] Secrets apenas em variáveis de ambiente, nunca em `NEXT_PUBLIC_*` nem em logs.
- [ ] Zod em toda entrada; preço e estoque recalculados no servidor.
- [ ] Rotas e ações admin validam sessão e role no servidor.
- [ ] Webhook tem validação, idempotência e log sem dados sensíveis.
- [ ] Upload limita tamanho e MIME a JPG/PNG/WebP; SVG bloqueado.
- [ ] HTTPS, headers de segurança, CORS restritivo quando necessário e backup diário.
- [ ] Dados de pagamento e credenciais não entram em logs, commits ou screenshots.

Antes do go-live, executar revisão de variáveis, permissões de bucket, URL de webhook e restauração de backup.
