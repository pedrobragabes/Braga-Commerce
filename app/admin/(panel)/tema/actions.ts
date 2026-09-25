"use server";
import { revalidatePath } from "next/cache";
import { requireAdminAction } from "../../../../lib/admin-auth";
import { publishTheme, saveThemeDraft } from "../../../../lib/store-theme";
import { StoreLifecycleError } from "../../../../lib/store-lifecycle";
import { z } from "zod";

export type ThemeFormState = { error?: string; success?: string };
export async function saveThemeAction(_: ThemeFormState, form: FormData): Promise<ThemeFormState> {
  try {
    const actor = await requireAdminAction("settings:write");
    const value = (name: string) => String(form.get(name) ?? "");
    const socialLinks = ["instagram", "facebook"].filter((network) => value(network)).map((network) => ({ network, url: value(network) }));
    await saveThemeDraft(actor, { version: 1, name: value("name"), brandKicker: value("brandKicker"), announcement: value("announcement"),
      logoImageId: value("logoImageId") || null, bannerImageId: value("bannerImageId") || null,
      brand: value("brand"), accent: value("accent"), font: value("font"), heroLayout: value("heroLayout"),
      heroTitle: value("heroTitle"), heroDescription: value("heroDescription"), storyTitle: value("storyTitle"), storyDescription: value("storyDescription"),
      sections: ["section1", "section2", "section3", "section4"].map(value).filter(Boolean), socialLinks,
    }, Number(value("expectedVersion")));
    revalidatePath("/admin/tema");
    return { success: "Rascunho salvo. Confira a prévia antes de publicar." };
  } catch (error) {
    return { error: error instanceof z.ZodError ? error.issues[0].message : error instanceof StoreLifecycleError && error.code === "THEME_CHANGED"
      ? "O tema mudou em outra sessão. Atualize a página e revise sua edição." : "Não foi possível salvar. Confira seus dados e permissões." };
  }
}
export async function publishThemeAction(_: ThemeFormState, form: FormData): Promise<ThemeFormState> {
  try {
    const actor = await requireAdminAction("settings:write");
    await publishTheme(actor, Number(form.get("version")), form.get("expectedPublishedVersion") ? Number(form.get("expectedPublishedVersion")) : null);
    revalidatePath("/", "layout");
    return { success: "Apresentação publicada." };
  } catch { return { error: "A versão mudou ou não pode ser publicada. Atualize a página e confira a prévia." }; }
}
