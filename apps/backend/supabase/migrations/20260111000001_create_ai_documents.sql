create table if not exists public.ai_documents (
  id uuid primary key default uuid_generate_v4(),
  content_hash text not null,
  pipeline_name text not null,
  pipeline_version text not null,
  storage_bucket text not null,
  storage_path text not null unique,
  size_bytes int8,
  created_at timestamptz not null default now(),
  unique (content_hash, pipeline_name, pipeline_version)
);

create table if not exists public.ai_document_users (
  document_id uuid not null references public.ai_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index if not exists idx_ai_document_users_user_id on public.ai_document_users(user_id);
