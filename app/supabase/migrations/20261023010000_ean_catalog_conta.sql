-- ===========================================================================
--  Catálogo de códigos de barras (EAN) no projeto da CONTA.
--
--  Mesmo formato da tabela descrita em docs/SUPABASE.md, mas restrita a
--  usuários autenticados: com login no app, não há motivo para leitura ou
--  escrita anônima. Guarda só dados de produto (nome, marca, tamanho), nada
--  pessoal. Compartilhada entre todas as contas do projeto.
--
--  Idempotente quanto à tabela; as policies são criadas só se ainda não
--  existirem (sem DROP, para rodar também por ferramentas que bloqueiam
--  comandos destrutivos).
-- ===========================================================================

create table if not exists public.ean_catalog (
  ean          text primary key check (ean ~ '^[0-9]{1,14}$'),
  name         text not null check (char_length(name) between 1 and 200),
  brand        text check (char_length(brand) <= 120),
  package_size numeric check (package_size is null or package_size > 0),
  package_unit text check (char_length(package_unit) <= 10),
  image_url    text check (char_length(image_url) <= 500),
  source       text check (char_length(source) <= 60),
  updated_at   timestamptz default now()
);

alter table public.ean_catalog enable row level security;

revoke all on public.ean_catalog from anon;
grant select, insert, update on public.ean_catalog to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ean_catalog' and policyname = 'conectado le') then
    create policy "conectado le" on public.ean_catalog for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ean_catalog' and policyname = 'conectado insere') then
    create policy "conectado insere" on public.ean_catalog for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ean_catalog' and policyname = 'conectado atualiza') then
    create policy "conectado atualiza" on public.ean_catalog for update to authenticated using (true) with check (true);
  end if;
end $$;

-- Sem policy de DELETE: nenhuma conta apaga linhas pelo app.
