-- ===========================================================================
--  Fotos de produto no Supabase Storage.
--
--  - Bucket privado `product-photos`: arquivos binários (WebP/JPEG reduzidos pelo
--    app, ~20-60 KB), até 1 MB cada. Nada de base64 dentro de tabela.
--  - Pasta por usuário: `<auth.uid()>/<produto>-<hash>.<ext>`.
--  - Leitura: qualquer usuário conectado (as fotos aparecem no catálogo de
--    todos). Escrita, troca e remoção: só na própria pasta.
--  - `shared_products.photo_path` aponta para a foto do item publicado.
--
--  Sem DROP: as policies são criadas só se ainda não existirem.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'fotos: conectados leem') then
    create policy "fotos: conectados leem" on storage.objects
      for select to authenticated
      using (bucket_id = 'product-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'fotos: dono envia') then
    create policy "fotos: dono envia" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'fotos: dono troca') then
    create policy "fotos: dono troca" on storage.objects
      for update to authenticated
      using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'fotos: dono remove') then
    create policy "fotos: dono remove" on storage.objects
      for delete to authenticated
      using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

alter table public.shared_products
  add column if not exists photo_path text
  check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$');
