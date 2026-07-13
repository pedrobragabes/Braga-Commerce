# Deploy

## MVP

Next.js na Vercel, PostgreSQL/Supabase, Supabase Storage, DNS Cloudflare e Mercado Pago. Hostinger compartilhada não hospeda webhook/API crítica.

## Checklist

1. Criar projeto e banco de produção separados do desenvolvimento.
2. Configurar todas as variáveis da `.env.example` na Vercel.
3. Executar `prisma migrate deploy` durante o deploy.
4. Configurar domínio e HTTPS; ajustar `NEXT_PUBLIC_APP_URL`.
5. Criar bucket e políticas mínimas de storage no Milestone 7.
6. Registrar URL pública do webhook no Mercado Pago e fazer pagamento sandbox/produção controlado.
7. Ativar backup diário e testar restauração antes do go-live.

## Mercado Pago na Vercel

Configure `MERCADO_PAGO_ENV`, `MERCADO_PAGO_ACCESS_TOKEN`,
`MERCADO_PAGO_WEBHOOK_SECRET` e `NEXT_PUBLIC_APP_URL` nos ambientes corretos do
projeto. Depois do deploy, registre no painel do Mercado Pago:

`https://SEU-DOMINIO/api/webhooks/mercadopago`

Comece com credenciais de teste e `MERCADO_PAGO_ENV=sandbox`. Valide pelo menos
aprovação, rejeição e repetição da mesma notificação antes de trocar para
produção. Não copie token ou secret para variáveis `NEXT_PUBLIC_*`.

## Rollback

Reverter a release na Vercel. Migrations são aditivas sempre que possível; rollback de banco exige migration própria e backup validado, não edição manual da base.
