import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

const rawUrl = process.env.BRAGA_TEST_DATABASE_URL;
if (rawUrl) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Banco de integração inválido."); }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/braga_integrity_test') {
    throw new Error("Use somente braga_integrity_test local.");
  }
}

describe.skipIf(!rawUrl)("migração de clientes legados em PostgreSQL", () => {
  it("preserva órfãos e snapshots, separa multiloja e impede vínculo cruzado", async () => {
    const database = new Client({ connectionString: rawUrl });
    const schema = `customer_migration_${randomUUID().replaceAll('-', '')}`;
    if (!/^customer_migration_[0-9a-f]{32}$/.test(schema)) throw new Error("Schema de teste inválido.");
    await database.connect();
    try {
      await database.query(`CREATE SCHEMA "${schema}"`);
      await database.query(`SET search_path TO "${schema}"`);
      const migrations = (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort();
      for (const migration of migrations.filter((name) => name < '20260925020000_scope_customer_accounts')) {
        await database.query(await readFile(join('prisma/migrations', migration, 'migration.sql'), 'utf8'));
      }
      await database.query(`INSERT INTO "Store" ("id", "name", "slug", "updatedAt") VALUES
        ('store-a','Loja A sintética','loja-a',now()), ('store-b','Loja B sintética','loja-b',now())`);
      await database.query(`INSERT INTO "Customer" ("id", "name", "email", "phone", "updatedAt") VALUES
        ('single','Contato legado','same@example.test','00000000000',now()),
        ('multi','Contato multiloja','same@example.test','00000000000',now()),
        ('orphan','Sem pedido','same@example.test','00000000000',now())`);
      await database.query(`INSERT INTO "Order" ("id", "storeId", "customerId", "subtotalCents", "totalCents", "customerName", "customerPhone", "customerEmail", "updatedAt") VALUES
        ('order-single','store-a','single',1200,1200,'Snapshot A','11111111111','snapshot-a@example.test',now()),
        ('order-a','store-a','multi',2500,2500,'Snapshot antigo A','22222222222','old-a@example.test',now()),
        ('order-b','store-b','multi',3300,3300,'Snapshot antigo B','33333333333','old-b@example.test',now())`);
      const snapshotSql = `SELECT "id", "storeId", "customerName", "customerPhone", "customerEmail", "totalCents" FROM "Order" ORDER BY "id"`;
      const before = (await database.query(snapshotSql)).rows;
      await database.query(await readFile('prisma/migrations/20260925020000_scope_customer_accounts/migration.sql', 'utf8'));
      expect((await database.query(snapshotSql)).rows).toEqual(before);
      expect((await database.query(`SELECT "storeId", "authUserId", "isQuarantined" FROM "Customer" WHERE "id"='single'`)).rows[0])
        .toEqual({ storeId: 'store-a', authUserId: null, isQuarantined: false });
      expect((await database.query(`SELECT "storeId", "authUserId", "isQuarantined" FROM "Customer" WHERE "id" IN ('orphan','multi')`)).rows)
        .toEqual([{ storeId: null, authUserId: null, isQuarantined: true }, { storeId: null, authUserId: null, isQuarantined: true }]);
      expect((await database.query(`SELECT "storeId" FROM "Customer" WHERE "legacyCustomerId"='multi' ORDER BY "storeId"`)).rows)
        .toEqual([{ storeId: 'store-a' }, { storeId: 'store-b' }]);
      expect((await database.query(`SELECT count(*)::int AS count FROM "Order" o JOIN "Customer" c ON c."id"=o."customerId" AND c."storeId"=o."storeId"`)).rows[0].count).toBe(3);
      await expect(database.query(`UPDATE "Order" SET "customerId"='single' WHERE "id"='order-b'`)).rejects.toMatchObject({ code: '23503' });
      await expect(database.query(`UPDATE "Customer" SET "storeId"='store-b' WHERE "id"='single'`)).rejects.toMatchObject({ code: '23503' });
      expect((await database.query(`SELECT count(*)::int AS count FROM "Customer"`)).rows[0].count).toBe(5);
    } finally {
      await database.query('ROLLBACK');
      await database.query('SET search_path TO public');
      await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await database.end();
    }
  });
});
