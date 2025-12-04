create table if not exists public.newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  email text not null,
  topics jsonb null,
  channel text not null default 'email' check (channel in ('email')),
  consent boolean not null default false,
  confirmation_token text null,
  status text not null default 'pending' check (status in ('pending','subscribed','unsubscribed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  unsubscribed_at timestamptz null
);

create unique index if not exists newsletter_email_channel_unique on public.newsletter_subscriptions (lower(email), channel) where status <> 'unsubscribed';
create index if not exists newsletter_status_idx on public.newsletter_subscriptions (status);
