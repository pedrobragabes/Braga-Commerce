# Checklist de segurança

- [x] Secrets de pagamento apenas em variáveis de ambiente e ausentes dos logs.
- [x] Zod nas entradas públicas de pedido e pagamento; preço recalculado no servidor.
- [x] Rotas e ações admin validam identidade Supabase, operador, loja e role no servidor.
- [x] Webhook tem assinatura HMAC, consulta ao provedor, idempotência persistente e log sem dados sensíveis.
- [x] Upload limita a 4 MiB, confere MIME e assinatura de JPG/PNG/WebP; SVG e tipo forjado são bloqueados.
- [ ] HTTPS, headers de segurança, CORS restritivo quando necessário e backup diário.
- [x] Dados de pagamento e credenciais não entram em logs ou commits; testes visuais usam operador temporário.

Antes do go-live, executar revisão de variáveis, permissões de bucket, URL de webhook e restauração de backup.
