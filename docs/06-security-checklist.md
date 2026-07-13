# Checklist de segurança

- [x] Secrets de pagamento apenas em variáveis de ambiente e ausentes dos logs.
- [x] Zod nas entradas públicas de pedido e pagamento; preço recalculado no servidor.
- [ ] Rotas e ações admin validam sessão e role no servidor.
- [x] Webhook tem assinatura HMAC, consulta ao provedor, idempotência persistente e log sem dados sensíveis.
- [ ] Upload limita tamanho e MIME a JPG/PNG/WebP; SVG bloqueado.
- [ ] HTTPS, headers de segurança, CORS restritivo quando necessário e backup diário.
- [ ] Dados de pagamento e credenciais não entram em logs, commits ou screenshots.

Antes do go-live, executar revisão de variáveis, permissões de bucket, URL de webhook e restauração de backup.
