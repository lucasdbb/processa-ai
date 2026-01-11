create table if not exists public.ai_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.ai_runs(id) on delete cascade,
  kind text not null,
  version text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  input_hash text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_runs_user_id_created_at on public.ai_runs(user_id, created_at desc);
create index if not exists idx_ai_runs_kind_created_at on public.ai_runs(kind, created_at desc);
create index if not exists idx_ai_runs_parent_id_created_at on public.ai_runs(parent_id, created_at asc);

create unique index if not exists uq_ai_runs_root_dedupe
  on public.ai_runs(user_id, kind, input_hash, version)
  where parent_id is null and input_hash is not null;

alter table public.ai_runs enable row level security;

create policy "Users can view own ai runs"
  on public.ai_runs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own ai runs"
  on public.ai_runs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ai runs"
  on public.ai_runs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_ai_runs_updated_at on public.ai_runs;
create trigger set_ai_runs_updated_at
  before update on public.ai_runs
  for each row
  execute function public.handle_updated_at();

