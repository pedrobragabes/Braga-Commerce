# Checklist de segurança

- [x] Secrets de pagamento apenas em variáveis de ambiente e ausentes dos logs.
- [x] Zod nas entradas públicas de pedido e pagamento; preço recalculado no servidor.
- [x] Rotas e ações admin validam identidade Supabase, operador, loja e role no servidor.
- [x] Webhook tem assinatura HMAC, consulta ao provedor, idempotência persistente e log sem dados sensíveis.
- [x] Upload limita a 4 MiB, confere MIME e assinatura de JPG/PNG/WebP; SVG e tipo forjado são bloqueados.
- [x] HTTPS na URL Vercel e headers CSP, HSTS, frame, MIME, referrer e permissões configurados.
- [x] APIs são same-origin; nenhuma origem CORS pública foi liberada.
- [x] Rate limiting persistente protege APIs públicas, senha beta e login administrativo sem salvar IP ou e-mail em claro.
- [x] Token beta assinado possui expiração criptográfica máxima de 12 horas.
- [x] Constraints do PostgreSQL impedem estoque, preços, tentativas e totais de pedido inválidos.
- [x] Dependências auditadas sem advisory conhecido; GitHub Actions fixadas por SHA e scripts npm permitidos por versão.
- [ ] CA do Supabase configurada em `DATABASE_SSL_CA` e conexão comprovada com validação de cadeia e hostname.
- [ ] Backup diário executado e restauração comprovada em banco descartável.
- [x] Dados de pagamento e credenciais não entram em logs ou commits; testes visuais usam operador temporário.

Antes do go-live, executar revisão de variáveis, validação TLS por CA, permissões
de bucket, URL de webhook e restauração de backup. CSP ainda usa `unsafe-inline`
para compatibilidade com o runtime atual; migrar para nonces é hardening futuro,
não substituto para escaping e ausência de HTML não confiável.
