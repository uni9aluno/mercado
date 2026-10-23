-- ===========================================================================
--  Catálogo de todos: produtos publicados pelas contas, visíveis para todos os
--  usuários conectados.
--
--  - Só dados de produto (nome, marca, categoria, embalagem, código de barras).
--    Preços, mercados, fotos e histórico continuam na conta (account_data).
--  - `chave` (nome|marca|embalagem normalizados, calculada pelo app) é única:
--    o mesmo produto publicado por várias contas vira uma linha só.
--  - Todos leem; cada um insere em nome próprio e só altera ou remove o que ele
--    mesmo publicou. `created_by` não é exposto a ninguém além do UUID.
--
--  Sem DROP: as policies são criadas só se ainda não existirem.
-- ===========================================================================

create table if not exists public.shared_products (
  id           uuid primary key default gen_random_uuid(),
  chave        text not null unique check (char_length(chave) between 1 and 400),
  busca        text not null check (char_length(busca) <= 400),
  name         text not null check (char_length(name) between 1 and 200),
  brand        text check (char_length(brand) <= 120),
  category     text check (char_length(category) <= 80),
  unit         text check (char_length(unit) <= 20),
  package_size numeric check (package_size is null or package_size > 0),
  package_unit text check (char_length(package_unit) <= 10),
  frequency    text check (char_length(frequency) <= 20),
  barcode      text check (barcode is null or barcode ~ '^[0-9]{1,14}$'),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists shared_products_name_idx on public.shared_products (name);

alter table public.shared_products enable row level security;

revoke all on public.shared_products from anon;
grant select, insert, update, delete on public.shared_products to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shared_products' and policyname = 'todos leem') then
    create policy "todos leem" on public.shared_products
      for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shared_products' and policyname = 'publica em nome proprio') then
    create policy "publica em nome proprio" on public.shared_products
      for insert to authenticated with check ((select auth.uid()) = created_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shared_products' and policyname = 'autor altera') then
    create policy "autor altera" on public.shared_products
      for update to authenticated
      using ((select auth.uid()) = created_by)
      with check ((select auth.uid()) = created_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'shared_products' and policyname = 'autor remove') then
    create policy "autor remove" on public.shared_products
      for delete to authenticated using ((select auth.uid()) = created_by);
  end if;
end $$;
