-- ===========================================================================
--  Dados por conta do Mercado do Casal.
--
--  Uma linha por usuário do Supabase Auth com o snapshot completo da base do
--  app (formato do backup v3). O RLS garante que cada usuário só lê e grava a
--  própria linha; a anon key sozinha não enxerga nada.
--
--  Idempotente: pode ser executado de novo sem erro.
-- ===========================================================================

create table if not exists public.account_data (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  revision   bigint not null default 1,
  updated_at timestamptz not null default now(),
  -- espelha LIMITE_SNAPSHOT_BYTES do app; protege o banco de payload desproporcional.
  constraint account_data_tamanho check (octet_length(data::text) <= 20971520),
  constraint account_data_objeto check (jsonb_typeof(data) = 'object')
);

alter table public.account_data enable row level security;

-- Sem acesso anônimo. Usuário autenticado só alcança a própria linha.
revoke all on public.account_data from anon;
grant select, insert, update on public.account_data to authenticated;

drop policy if exists "dono le" on public.account_data;
drop policy if exists "dono insere" on public.account_data;
drop policy if exists "dono atualiza" on public.account_data;

-- `(select auth.uid())` é avaliado uma vez por consulta, não por linha.
create policy "dono le" on public.account_data
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "dono insere" on public.account_data
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "dono atualiza" on public.account_data
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sem policy de DELETE: a linha só some junto com o usuário (on delete cascade).

-- ---------------------------------------------------------------------------
--  Gravação com controle otimista de concorrência.
--  Devolve a nova revisão, ou NULL quando outro aparelho gravou antes
--  (p_expected_revision diferente da revisão atual) — o app trata como conflito.
--  SECURITY INVOKER: roda com as permissões e o RLS de quem chama.
-- ---------------------------------------------------------------------------
create or replace function public.save_account_data(p_data jsonb, p_expected_revision bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rev bigint;
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  insert into public.account_data as a (user_id, data, revision)
  values (v_uid, p_data, 1)
  on conflict (user_id) do update
    set data = excluded.data,
        revision = a.revision + 1,
        updated_at = now()
    where a.revision = p_expected_revision
  returning a.revision into v_rev;

  return v_rev;
end;
$$;

revoke execute on function public.save_account_data(jsonb, bigint) from public, anon;
grant execute on function public.save_account_data(jsonb, bigint) to authenticated;
