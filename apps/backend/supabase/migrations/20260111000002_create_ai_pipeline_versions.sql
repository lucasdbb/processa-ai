create table if not exists public.ai_pipeline_versions (
  name text primary key,
  version text not null,
  updated_at timestamptz not null default now()
);

insert into public.ai_pipeline_versions (name, version)
values ('cnis-analysis', '1.0.0')
on conflict (name) do nothing;
