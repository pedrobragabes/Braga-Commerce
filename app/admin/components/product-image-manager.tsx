"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { moveProductImage, removeProductImage } from "../actions";

type ProductImageItem = {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
};

export function ProductImageManager({
  productId,
  productName,
  images,
  canEdit,
}: {
  productId: string;
  productName: string;
  images: ProductImageItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/upload", { method: "POST", body: new FormData(form) });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message || "O upload não foi concluído.");
      form.reset();
      setMessage({ tone: "success", text: "Imagem enviada e vinculada ao produto." });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "O upload não foi concluído.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section admin-image-manager">
      <div className="admin-section-heading">
        <div>
          <p className="admin-kicker">Vitrine e galeria</p>
          <h2>Imagens do produto</h2>
        </div>
        <span>{images.length} cadastrada(s)</span>
      </div>

      {images.length ? (
        <ol className="admin-image-list">
          {images.map((image, index) => (
            <li key={image.id}>
              <div
                aria-label={image.alt || productName}
                className="admin-image-preview"
                role="img"
                style={{ backgroundImage: `url(${JSON.stringify(image.url)})` }}
              />
              <div className="admin-image-copy">
                <strong>{index === 0 ? "Imagem principal" : `Imagem ${index + 1}`}</strong>
                <span>{image.alt || "Sem texto alternativo específico"}</span>
              </div>
              {canEdit ? (
                <div className="admin-image-actions">
                  <form action={moveProductImage}>
                    <input name="productId" type="hidden" value={productId} />
                    <input name="imageId" type="hidden" value={image.id} />
                    <button disabled={index === 0} name="direction" type="submit" value="up">
                      ↑ <span className="sr-only">Mover imagem para cima</span>
                    </button>
                    <button
                      disabled={index === images.length - 1}
                      name="direction"
                      type="submit"
                      value="down"
                    >
                      ↓ <span className="sr-only">Mover imagem para baixo</span>
                    </button>
                  </form>
                  <form
                    action={removeProductImage}
                    onSubmit={(event) => {
                      if (!window.confirm("Remover esta imagem do produto e do Storage?")) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input name="productId" type="hidden" value={productId} />
                    <input name="imageId" type="hidden" value={image.id} />
                    <button className="danger" type="submit">
                      Remover
                    </button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="admin-empty compact">
          <strong>Nenhuma foto publicada.</strong>
          <p>A vitrine continua usando a ilustração de fallback até o primeiro upload.</p>
        </div>
      )}

      {canEdit ? (
        <form className="admin-upload-form" onSubmit={upload}>
          <input name="productId" type="hidden" value={productId} />
          <label>
            <span>Arquivo *</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              name="file"
              required
              type="file"
            />
          </label>
          <label>
            <span>Texto alternativo</span>
            <input disabled={busy} maxLength={160} name="alt" placeholder={productName} />
          </label>
          <button className="admin-button primary" disabled={busy} type="submit">
            {busy ? "Enviando…" : "Enviar imagem →"}
          </button>
          <small>JPG, PNG ou WebP · máximo 4 MiB. SVG não é aceito.</small>
        </form>
      ) : null}

      {message ? (
        <p className={`admin-upload-message ${message.tone}`} role="status">
          {message.text}
        </p>
      ) : null}
    </section>
  );
}
