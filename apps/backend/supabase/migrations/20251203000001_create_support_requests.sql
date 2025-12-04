create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  name text not null,
  email text not null,
  phone text null,
  company text null,
  subject text not null,
  contact_preference text not null check (contact_preference in ('email','telefone','whatsapp')),
  message text not null,
  is_client boolean not null default false,
  consent boolean not null default false,
  status text not null default 'open' check (status in ('open','in_progress','closed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz null
);

create index if not exists support_requests_created_at_idx on public.support_requests (created_at desc);
