create table if not exists public.ai_tools (
  slug text primary key,
  name text not null,
  description text not null,
  icon text not null,
  locked boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  "order" int8 not null
);
