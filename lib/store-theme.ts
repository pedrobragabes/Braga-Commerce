import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { getDatabase } from "./database";
import { lockStore, StoreLifecycleError } from "./store-lifecycle";
import { can } from "./admin-auth";
import { pvModaConfig } from "../storefront/config/pv-moda";
import type { StorefrontConfig } from "../storefront/types";

const text = (max: number) => z.string().trim().max(max).refine((value) => !/[<>\u0000-\u0008]/.test(value), "Use texto simples.");
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const section = z.enum(["benefits", "categories", "featured", "story"]);
export const storeThemeSchema = z.object({
  version: z.literal(1), name: text(100).min(2), brandKicker: text(100), announcement: text(180),
  logoImageId: z.string().max(80).nullable(), bannerImageId: z.string().max(80).nullable(),
  brand: color, accent: color, font: z.enum(["modern", "classic"]), heroLayout: z.enum(["editorial", "simple"]),
  heroTitle: text(120).min(2), heroDescription: text(500), storyTitle: text(120), storyDescription: text(2000),
  sections: z.array(section).max(4).refine((values) => new Set(values).size === values.length),
  socialLinks: z.array(z.object({ network: z.enum(["instagram", "facebook"]), url: z.url().refine((value) => {
    const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password
      && ["instagram.com", "www.instagram.com", "facebook.com", "www.facebook.com"].includes(url.hostname);
  }) }).strict()).max(2),
}).strict().refine((theme) => contrast(theme.brand, "#ffffff") >= 4.5, { message: "A cor principal precisa de contraste mínimo de 4,5:1 com branco.", path: ["brand"] })
  .refine((theme) => contrast(theme.accent, "#151b18") >= 4.5, { message: "Escolha um destaque claro para manter o texto legível.", path: ["accent"] });
export type StoreThemeContent = z.infer<typeof storeThemeSchema>;

function luminance(hex: string) {
  const parts = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722;
}
export function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

export function defaultStoreTheme(store: { name: string; slug: string }): StoreThemeContent {
  const pilot = store.slug === pvModaConfig.storeSlug ? pvModaConfig : null;
  return { version: 1, name: store.name, brandKicker: pilot?.brandKicker ?? "Atendimento local",
    announcement: pilot?.announcement ?? "Conheça os produtos e fale com a loja.",
    logoImageId: null, bannerImageId: null, brand: pilot?.theme.brand ?? "#173d30", accent: "#e7b681",
    font: pilot ? "classic" : "modern", heroLayout: pilot ? "editorial" : "simple",
    heroTitle: pilot?.hero.title ?? `Conheça ${store.name}`, heroDescription: pilot?.hero.description ?? "Escolha seus produtos e consulte as modalidades de atendimento disponíveis.",
    storyTitle: pilot?.story.title ?? "Perto de você", storyDescription: pilot?.story.description ?? "Entre em contato para saber mais sobre a loja.",
    sections: ["benefits", "categories", "featured", "story"], socialLinks: [] };
}

async function requireThemeOperator(transaction: Prisma.TransactionClient, actor: { userId: string; storeId: string }) {
  const operator = await transaction.user.findFirst({ where: { id: actor.userId, storeId: actor.storeId, isActive: true } });
  if (!operator || !can(operator.role, "settings:write")) throw new StoreLifecycleError("FORBIDDEN");
}
async function checkImages(transaction: Prisma.TransactionClient, storeId: string, content: StoreThemeContent) {
  const ids = [...new Set([content.logoImageId, content.bannerImageId].filter((id): id is string => Boolean(id)))];
  if (ids.length !== await transaction.productImage.count({ where: { id: { in: ids }, product: { storeId } } }))
    throw new StoreLifecycleError("IMAGE_NOT_OWNED");
}

export async function saveThemeDraft(actor: { userId: string; storeId: string }, input: unknown, expectedVersion: number) {
  const content = storeThemeSchema.parse(input);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new StoreLifecycleError("INVALID_VERSION");
  return getDatabase().$transaction(async (transaction) => {
    await requireThemeOperator(transaction, actor);
    await lockStore(transaction, actor.storeId);
    const settings = await transaction.storeSettings.upsert({ where: { storeId: actor.storeId }, update: {}, create: { storeId: actor.storeId } });
    if (settings.themeVersion !== expectedVersion) throw new StoreLifecycleError("THEME_CHANGED");
    await checkImages(transaction, actor.storeId, content);
    const version = settings.themeVersion + 1;
    await transaction.storeThemeRevision.create({ data: { storeId: actor.storeId, version, content, actorId: actor.userId } });
    await transaction.storeSettings.update({ where: { storeId: actor.storeId }, data: { themeVersion: version, themeDraftVersion: version } });
    await transaction.storeAuditEvent.create({ data: { storeId: actor.storeId, actorId: actor.userId, action: "THEME_DRAFT_SAVED", reference: String(version) } });
    return version;
  });
}

export async function publishTheme(actor: { userId: string; storeId: string }, version: number, expectedPublishedVersion: number | null) {
  if (!Number.isInteger(version) || version < 1) throw new StoreLifecycleError("INVALID_VERSION");
  return getDatabase().$transaction(async (transaction) => {
    await requireThemeOperator(transaction, actor);
    await lockStore(transaction, actor.storeId);
    const settings = await transaction.storeSettings.findUnique({ where: { storeId: actor.storeId } });
    if (!settings || settings.themePublishedVersion !== expectedPublishedVersion) throw new StoreLifecycleError("THEME_CHANGED");
    const revision = await transaction.storeThemeRevision.findUnique({ where: { storeId_version: { storeId: actor.storeId, version } } });
    if (!revision) throw new StoreLifecycleError("THEME_NOT_FOUND");
    await checkImages(transaction, actor.storeId, storeThemeSchema.parse(revision.content));
    await transaction.storeSettings.update({ where: { storeId: actor.storeId }, data: { themePublishedVersion: version } });
    await transaction.storeAuditEvent.create({ data: { storeId: actor.storeId, actorId: actor.userId,
      action: version === settings.themeDraftVersion ? "THEME_PUBLISHED" : "THEME_RESTORED", reference: String(version) } });
    return version;
  });
}

// No global cache: draft and published reads are always explicitly store-scoped.
export async function getStorePresentation(storeId: string, draftActor?: { userId: string; storeId: string }) {
  const database = getDatabase();
  if (draftActor) {
    if (draftActor.storeId !== storeId) throw new StoreLifecycleError("FORBIDDEN");
    await requireThemeOperator(database, draftActor);
  }
  const store = await database.store.findUniqueOrThrow({ where: { id: storeId }, include: { settings: true } });
  const version = draftActor ? store.settings?.themeDraftVersion : store.settings?.themePublishedVersion;
  const revision = version ? await database.storeThemeRevision.findUnique({ where: { storeId_version: { storeId, version } } }) : null;
  const parsed = storeThemeSchema.safeParse(revision?.content);
  const content = parsed.success ? parsed.data : defaultStoreTheme(store);
  const images = await database.productImage.findMany({ where: { id: { in: [content.logoImageId, content.bannerImageId].filter((id): id is string => Boolean(id)) }, product: { storeId } }, select: { id: true, url: true } });
  const imageUrl = (id: string | null) => images.find((image) => image.id === id)?.url ?? null;
  const config: StorefrontConfig = {
    storeSlug: store.slug, brandKicker: content.brandKicker, announcement: content.announcement,
    hero: { eyebrow: content.name, title: content.heroTitle, description: content.heroDescription, primaryCta: "Ver produtos", secondaryCta: "Conhecer a loja", badge: "Atendimento local" },
    benefits: [{ icon: "pin", title: "Contato direto", description: "Converse com a loja para tirar suas dúvidas." }, { icon: "shield", title: "Compra acompanhada", description: "Acompanhe os detalhes do seu pedido." }],
    story: { eyebrow: content.name, title: content.storyTitle, description: content.storyDescription },
    theme: { ink: "#151b18", paper: "#f2efe8", surface: "#fcfbf7", brand: content.brand, accent: content.accent,
      accentStrong: content.brand, brandSoft: "#e8ece9", line: "#d5cec2", muted: "#66665f", radius: "0.9rem" },
    presentation: { font: content.font, heroLayout: content.heroLayout, sections: content.sections,
      bannerUrl: imageUrl(content.bannerImageId), socialLinks: content.socialLinks },
  };
  return { config, content, version: revision?.version ?? null,
    store: { ...store, name: content.name, logoUrl: imageUrl(content.logoImageId) ?? store.logoUrl } };
}
