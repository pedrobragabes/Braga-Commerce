import { spawnSync } from "node:child_process";

// An explicit disposable database is required; .env is never a test fallback.
const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (!rawUrl) throw new Error("Defina BRAGA_TEST_DATABASE_URL para o banco local braga_integrity_test.");
let url;
try { url = new URL(rawUrl); }
catch { throw new Error("BRAGA_TEST_DATABASE_URL inválida."); }
if (!['postgres:', 'postgresql:'].includes(url.protocol)
  || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  || url.pathname !== '/braga_integrity_test') {
  throw new Error("A integração aceita somente o banco local descartável braga_integrity_test.");
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: rawUrl,
  DATABASE_SSL_CA: '',
  DATABASE_POSTGRES_PRISMA_URL: '',
  DATABASE_POSTGRES_URL_NON_POOLING: '',
  EMAIL_DRIVER: 'disabled',
  MERCADO_PAGO_ACCESS_TOKEN: 'local-test-never-sent',
};
for (const args of [
  ['node_modules/prisma/build/index.js', 'generate'],
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  ['node_modules/vitest/vitest.mjs', 'run', 'tests/integration', '--no-file-parallelism'],
]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
