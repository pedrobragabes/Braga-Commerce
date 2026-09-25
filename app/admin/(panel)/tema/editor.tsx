"use client";
import { useActionState, useState } from "react";
import type { StoreThemeContent } from "../../../../lib/store-theme";
import { publishThemeAction, saveThemeAction } from "./actions";

export function ThemeEditor({ content, version, publishedVersion, draftVersion, images, revisions }: {
  content: StoreThemeContent; version: number; publishedVersion: number | null; draftVersion: number | null;
  images: Array<{ id: string; alt: string | null }>; revisions: number[];
}) {
  const [state, save, pending] = useActionState(saveThemeAction, {});
  const [publishState, publish, publishing] = useActionState(publishThemeAction, {});
  const [width, setWidth] = useState("100%");
  const sections = { benefits: "Benefícios", categories: "Categorias", featured: "Destaques", story: "Sobre a loja" };
  return <div className="theme-editor">
    <form action={save} className="admin-form-card">
      <input type="hidden" name="expectedVersion" value={version} />
      <div className="admin-form-grid">
        <label><span>Nome exibido</span><input name="name" defaultValue={content.name} maxLength={100} required /></label>
        <label><span>Frase abaixo do nome</span><input name="brandKicker" defaultValue={content.brandKicker} maxLength={100} /></label>
        <label className="wide"><span>Aviso do topo (opcional)</span><input name="announcement" defaultValue={content.announcement} maxLength={180} /></label>
        <label><span>Cor principal escura</span><input name="brand" type="color" defaultValue={content.brand} /></label>
        <label><span>Cor de destaque clara</span><input name="accent" type="color" defaultValue={content.accent} /></label>
        <label><span>Tipografia</span><select name="font" defaultValue={content.font}><option value="modern">Moderna</option><option value="classic">Clássica</option></select></label>
        <label><span>Apresentação inicial</span><select name="heroLayout" defaultValue={content.heroLayout}><option value="simple">Simples</option><option value="editorial">Editorial</option></select></label>
        {(["logoImageId", "bannerImageId"] as const).map((field) => <label key={field}><span>{field === "logoImageId" ? "Logo" : "Imagem de capa"}</span><select name={field} defaultValue={content[field] ?? ""}><option value="">Sem imagem</option>{images.map((image) => <option value={image.id} key={image.id}>{image.alt || `Imagem ${image.id.slice(-6)}`}</option>)}</select><small>Escolha uma imagem enviada em um produto da sua loja.</small></label>)}
        <label className="wide"><span>Título da apresentação</span><input name="heroTitle" defaultValue={content.heroTitle} maxLength={120} required /></label>
        <label className="wide"><span>Descrição inicial</span><textarea name="heroDescription" defaultValue={content.heroDescription} maxLength={500} /></label>
        <label className="wide"><span>Título institucional</span><input name="storyTitle" defaultValue={content.storyTitle} maxLength={120} /></label>
        <label className="wide"><span>Sobre a loja</span><textarea name="storyDescription" defaultValue={content.storyDescription} maxLength={2000} /></label>
        {[0, 1, 2, 3].map((index) => <label key={index}><span>Seção {index + 1}</span><select name={`section${index + 1}`} defaultValue={content.sections[index] ?? ""}><option value="">Ocultar</option>{Object.entries(sections).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>)}
        {["instagram", "facebook"].map((network) => <label key={network}><span>{network}</span><input name={network} type="url" defaultValue={content.socialLinks.find((link) => link.network === network)?.url ?? ""} placeholder={`https://www.${network}.com/`} /></label>)}
      </div>
      <p>Cada seção aparece no máximo uma vez. Cores são verificadas para manter a leitura. Contatos e endereço continuam em Configurações.</p>
      <p role={state.error ? "alert" : "status"}>{state.error || state.success}</p>
      <button className="admin-button primary" disabled={pending}>{pending ? "Salvando…" : "Salvar rascunho"}</button>
    </form>
    <section className="admin-form-card"><h2>Prévia do rascunho</h2><p>O conteúdo publicado continua estável enquanto você edita. Salve antes de atualizar esta prévia.</p>
      <div className="admin-check-row"><button type="button" className="admin-button" onClick={() => setWidth("100%")}>Computador</button><button type="button" className="admin-button" onClick={() => setWidth("390px")}>Celular</button></div>
      <iframe key={version} title="Prévia privada da loja" src="/admin/tema/preview" style={{ width, maxWidth: "100%", height: 600, border: "1px solid #ccc" }} />
    </section>
    <form action={publish} className="admin-form-card"><h2>Publicação e restauração</h2>
      <p>Versão publicada: {publishedVersion ?? "configuração inicial"}. Você pode publicar o rascunho ou restaurar uma versão salva.</p>
      <input name="expectedPublishedVersion" type="hidden" value={publishedVersion ?? ""} />
      <label><span>Versão para publicar</span><select name="version" defaultValue={draftVersion ?? ""} required><option value="" disabled>Salve um rascunho primeiro</option>{revisions.map((number) => <option key={number} value={number}>Versão {number}{number === draftVersion ? " — rascunho atual" : ""}</option>)}</select></label>
      <p role={publishState.error ? "alert" : "status"}>{publishState.error || publishState.success}</p>
      <button className="admin-button primary" disabled={publishing || !revisions.length}>{publishing ? "Publicando…" : "Publicar esta versão"}</button>
    </form>
  </div>;
}
