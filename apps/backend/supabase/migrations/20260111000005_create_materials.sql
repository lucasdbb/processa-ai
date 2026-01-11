create table if not exists public.materials (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  description text,
  "group" text not null,
  storage_bucket text not null default 'materials',
  storage_path text not null,
  filename text not null,
  mime_type text not null check (mime_type in ('pdf', 'xls', 'xlsx', 'xlsm', 'docx', 'csv')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_materials_group_title on public.materials("group", title);
create index if not exists idx_materials_is_published on public.materials(is_published);

alter table public.materials enable row level security;

create policy "Authenticated can view published materials"
  on public.materials
  for select
  using (auth.role() = 'authenticated' and is_published = true);

create policy "Admins can manage materials"
  on public.materials
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at
  before update on public.materials
  for each row
  execute function public.handle_updated_at();
