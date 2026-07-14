-- Alternativa manual ao script `npm run storage:setup`.
-- O bucket é público apenas para leitura. Upload, alteração e remoção usam a
-- service role no servidor depois da validação de sessão, role e storeId.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images');

-- Deliberadamente não existem políticas INSERT/UPDATE/DELETE para anon ou
-- authenticated neste bucket. A API usa a service role somente no servidor.
