import "dotenv/config";
import { createServerClient } from "@supabase/ssr";
import { getDatabase } from "../lib/database";
import { createStorageAdminClient } from "../lib/storage/admin";
import { getStorageBucketName, MAX_PRODUCT_IMAGE_BYTES } from "../lib/storage/config";
import { removeStoredProductImage } from "../lib/storage/product-images";
import { getSupabasePublicConfig } from "../lib/supabase/config";

const command = process.argv[2];
const runId = process.env.M5_SMOKE_RUN_ID?.trim();
const ownerEmail = process.env.M5_SMOKE_OWNER_EMAIL?.trim();
const ownerPassword = process.env.M5_SMOKE_OWNER_PASSWORD;
const staffEmail = process.env.M5_SMOKE_STAFF_EMAIL?.trim();
const staffPassword = process.env.M5_SMOKE_STAFF_PASSWORD;
const baseUrl = (process.env.M5_SMOKE_BASE_URL || "https://braga-commerce.vercel.app").replace(/\/$/, "");
const storeSlug = process.env.SEED_STORE_SLUG || "pv-moda-masculina";

if (!runId || !/^[a-z0-9-]{6,40}$/.test(runId)) {
  throw new Error("Configure M5_SMOKE_RUN_ID com 6 a 40 caracteres seguros.");
}

async function createSessionCookieHeader(email: string | undefined, password: string | undefined) {
  if (!email || !password) throw new Error("Configure as credenciais temporárias do smoke M5.");
  const cookieJar: Array<{ name: string; value: string }> = [];
  const { url, publishableKey } = getSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieJar,
      setAll: (items) => {
        for (const item of items) {
          const index = cookieJar.findIndex((cookie) => cookie.name === item.name);
          const value = { name: item.name, value: item.value };
          if (index >= 0) cookieJar[index] = value;
          else cookieJar.push(value);
        }
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("A sessão temporária do smoke M5 não foi criada.");
  return cookieJar.map(({ name, value }) => `${name}=${value}`).join("; ");
}

function uploadForm(productId: string, file: File, alt: string) {
  const form = new FormData();
  form.set("productId", productId);
  form.set("alt", alt);
  form.set("file", file);
  return form;
}

async function upload(cookie: string | null, form: FormData) {
  return fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
    body: form,
    redirect: "manual",
  });
}

async function expectStatus(response: Response, status: number, expectedCode?: string) {
  const text = await response.text();
  let payload: { error?: { code?: string }; image?: { id?: string; url?: string } } = {};
  try {
    payload = JSON.parse(text) as typeof payload;
  } catch {
    // Mantém payload vazio para produzir o erro técnico abaixo sem imprimir resposta.
  }
  if (response.status !== status || (expectedCode && payload.error?.code !== expectedCode)) {
    throw new Error(`Smoke M5 recebeu status inesperado na etapa ${expectedCode || status}.`);
  }
  return payload;
}

async function setup() {
  const database = getDatabase();
  const product = await database.product.findFirst({
    where: { store: { slug: storeSlug }, isActive: true, images: { none: {} } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true },
  });
  if (!product) throw new Error("Nenhum produto sem imagens está disponível para o smoke M5.");

  const ownerCookie = await createSessionCookieHeader(ownerEmail, ownerPassword);
  const staffCookie = await createSessionCookieHeader(staffEmail, staffPassword);
  const pngA = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const pngB = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2aAAAAABJRU5ErkJggg==", "base64"));
  const validFile = () => new File([pngA], "ignored.png", { type: "image/png" });

  await expectStatus(await upload(null, uploadForm(product.id, validFile(), "sem sessão")), 401, "AUTH_REQUIRED");
  await expectStatus(await upload(staffCookie, uploadForm(product.id, validFile(), "staff")), 403, "FORBIDDEN");
  await expectStatus(
    await upload(ownerCookie, uploadForm(product.id, new File(["<svg/>"], "blocked.svg", { type: "image/svg+xml" }), "svg")),
    400,
    "UNSUPPORTED_TYPE",
  );
  await expectStatus(
    await upload(ownerCookie, uploadForm(product.id, new File([pngA], "forged.jpg", { type: "image/jpeg" }), "forged")),
    400,
    "TYPE_MISMATCH",
  );
  await expectStatus(
    await upload(ownerCookie, uploadForm(product.id, new File([new Uint8Array(MAX_PRODUCT_IMAGE_BYTES + 1)], "large.png", { type: "image/png" }), "large")),
    400,
    "FILE_TOO_LARGE",
  );

  const first = await expectStatus(
    await upload(ownerCookie, uploadForm(product.id, new File([pngA], "first.png", { type: "image/png" }), `M5 ${runId} primeira`)),
    201,
  );
  const second = await expectStatus(
    await upload(ownerCookie, uploadForm(product.id, new File([pngB], "second.png", { type: "image/png" }), `M5 ${runId} segunda`)),
    201,
  );
  if (!first.image?.id || !first.image.url || !second.image?.id || !second.image.url) {
    throw new Error("A API não retornou as imagens persistidas.");
  }
  const publicResponses = await Promise.all([
    fetch(first.image.url, { cache: "no-store" }),
    fetch(second.image.url, { cache: "no-store" }),
  ]);
  if (publicResponses.some((response) => !response.ok)) {
    throw new Error("A leitura pública das imagens do smoke M5 falhou.");
  }

  const records = await database.productImage.findMany({
    where: { id: { in: [first.image.id, second.image.id] }, productId: product.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true, storagePath: true },
  });
  if (records.length !== 2 || records.some((record) => !record.storagePath)) {
    throw new Error("As referências do smoke M5 não foram persistidas corretamente.");
  }
  console.info(JSON.stringify({
    productId: product.id,
    productSlug: product.slug,
    imageIds: records.map((record) => record.id),
    unauthenticated: 401,
    staff: 403,
    invalidFiles: 400,
    uploaded: 2,
    publicRead: true,
  }));
  await database.$disconnect();
}

async function cleanup() {
  const database = getDatabase();
  const images = await database.productImage.findMany({
    where: { alt: { startsWith: `M5 ${runId} ` } },
    select: { id: true, storagePath: true },
  });
  const paths = images.flatMap((image) => (image.storagePath ? [image.storagePath] : []));
  if (paths.length) {
    const { error } = await createStorageAdminClient().storage.from(getStorageBucketName()).remove(paths);
    if (error) throw new Error("A limpeza dos objetos do smoke M5 falhou.");
  }
  await database.productImage.deleteMany({ where: { id: { in: images.map((image) => image.id) } } });
  const remaining = await database.productImage.count({ where: { alt: { startsWith: `M5 ${runId} ` } } });
  if (remaining !== 0) throw new Error("A limpeza do smoke M5 deixou referências no banco.");
  console.info(JSON.stringify({ cleaned: true, objects: paths.length, references: images.length }));
  await database.$disconnect();
}

async function verify() {
  const productId = process.env.M5_SMOKE_PRODUCT_ID?.trim();
  if (!productId) throw new Error("Configure M5_SMOKE_PRODUCT_ID.");
  const database = getDatabase();
  const product = await database.product.findFirst({
    where: { id: productId, store: { slug: storeSlug } },
    select: { id: true, slug: true, storeId: true },
  });
  if (!product) throw new Error("Produto do smoke M5 não encontrado.");

  const ownerCookie = await createSessionCookieHeader(ownerEmail, ownerPassword);
  const staffCookie = await createSessionCookieHeader(staffEmail, staffPassword);
  const [ownerPage, staffPage] = await Promise.all([
    fetch(`${baseUrl}/admin/produtos/${product.id}`, { headers: { cookie: ownerCookie } }),
    fetch(`${baseUrl}/admin/produtos/${product.id}`, { headers: { cookie: staffCookie } }),
  ]);
  const [ownerHtml, staffHtml] = await Promise.all([ownerPage.text(), staffPage.text()]);
  if (!ownerPage.ok || !ownerHtml.includes("Enviar imagem")) {
    throw new Error("Os controles de imagem não apareceram para OWNER.");
  }
  if (!staffPage.ok || staffHtml.includes("Enviar imagem") || staffHtml.includes(">Remover<")) {
    throw new Error("A galeria não ficou somente leitura para STAFF.");
  }

  const images = await database.productImage.findMany({
    where: { productId: product.id, alt: { startsWith: `M5 ${runId} ` } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, alt: true, storagePath: true },
  });
  if (images.length !== 2 || images[0]?.alt !== `M5 ${runId} segunda`) {
    throw new Error("A ordem principal do smoke M5 não foi persistida.");
  }
  const removed = images.find((image) => image.alt === `M5 ${runId} primeira`);
  if (!removed?.storagePath) throw new Error("A imagem a remover não possui caminho de Storage.");
  await removeStoredProductImage({ storeId: product.storeId, productId: product.id, imageId: removed.id });

  const slash = removed.storagePath.lastIndexOf("/");
  const folder = removed.storagePath.slice(0, slash);
  const filename = removed.storagePath.slice(slash + 1);
  const listed = await createStorageAdminClient().storage.from(getStorageBucketName()).list(folder, { search: filename });
  if (listed.error || listed.data.some((item) => item.name === filename)) {
    throw new Error("O objeto removido ainda existe no Storage.");
  }
  const remaining = await database.productImage.findMany({
    where: { productId: product.id, alt: { startsWith: `M5 ${runId} ` } },
    select: { alt: true, sortOrder: true },
  });
  if (remaining.length !== 1 || remaining[0]?.alt !== `M5 ${runId} segunda` || remaining[0].sortOrder !== 0) {
    throw new Error("A remoção não normalizou a galeria.");
  }
  const storefront = await fetch(`${baseUrl}/produto/${product.slug}`, { cache: "no-store" });
  const storefrontHtml = await storefront.text();
  if (!storefront.ok || !storefrontHtml.includes(`M5 ${runId} segunda`)) {
    throw new Error("A imagem principal restante não apareceu no storefront.");
  }
  console.info(JSON.stringify({ ownerControls: true, staffReadOnly: true, orderPersisted: true, removedObject: true, storefrontPrimary: true }));
  await database.$disconnect();
}

async function main() {
  if (command === "setup") await setup();
  else if (command === "verify") await verify();
  else if (command === "cleanup") await cleanup();
  else throw new Error("Use setup, verify ou cleanup.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha no smoke M5.");
  process.exitCode = 1;
});
