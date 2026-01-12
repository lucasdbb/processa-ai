create table if not exists public.billing_plans (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  description text,
  is_visible boolean not null default true,
  is_sellable boolean not null default true,
  is_popular boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_plans_sort_order on public.billing_plans(sort_order);
create index if not exists idx_billing_plans_is_visible on public.billing_plans(is_visible);
create index if not exists idx_billing_plans_is_sellable on public.billing_plans(is_sellable);

alter table public.billing_plans enable row level security;

create policy "Anyone can view visible billing plans"
  on public.billing_plans
  for select
  to public
  using (is_visible = true);

create policy "Admins can manage billing plans"
  on public.billing_plans
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop trigger if exists set_billing_plans_updated_at on public.billing_plans;
create trigger set_billing_plans_updated_at
  before update on public.billing_plans
  for each row
  execute function public.handle_updated_at();


create table if not exists public.billing_plan_prices (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references public.billing_plans(id) on delete cascade,
  currency text not null default 'BRL' check (char_length(currency) = 3),
  amount_cents integer not null check (amount_cents >= 0),
  interval text not null default 'month' check (interval in ('month', 'year')),
  external_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, currency, interval)
);

create index if not exists idx_billing_plan_prices_plan_id on public.billing_plan_prices(plan_id);

alter table public.billing_plan_prices enable row level security;

create policy "Anyone can view prices for visible plans"
  on public.billing_plan_prices
  for select
  to public
  using (
    exists (
      select 1
      from public.billing_plans p
      where p.id = plan_id and p.is_visible = true
    )
  );

create policy "Admins can manage billing plan prices"
  on public.billing_plan_prices
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop trigger if exists set_billing_plan_prices_updated_at on public.billing_plan_prices;
create trigger set_billing_plan_prices_updated_at
  before update on public.billing_plan_prices
  for each row
  execute function public.handle_updated_at();


create table if not exists public.billing_plan_features (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references public.billing_plans(id) on delete cascade,
  feature text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, feature)
);

create index if not exists idx_billing_plan_features_plan_id on public.billing_plan_features(plan_id);
create index if not exists idx_billing_plan_features_sort_order on public.billing_plan_features(plan_id, sort_order);

alter table public.billing_plan_features enable row level security;

create policy "Anyone can view features for visible plans"
  on public.billing_plan_features
  for select
  to public
  using (
    exists (
      select 1
      from public.billing_plans p
      where p.id = plan_id and p.is_visible = true
    )
  );

create policy "Admins can manage billing plan features"
  on public.billing_plan_features
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');


insert into public.billing_plans (slug, name, description, is_visible, is_sellable, is_popular, sort_order)
values
  ('basico', 'Básico', 'Ideal para começar a explorar nossas ferramentas', true, true, false, 1),
  ('estudante', 'Estudante', 'Para quem está na faculdade e quer acelerar estudos', true, true, false, 2),
  ('autonomo', 'Autônomo', 'Para advogados autônomos que precisam produzir mais', true, true, true, 3),
  ('escritorio', 'Escritório', 'Para equipes e operação jurídica em escala', true, false, false, 4)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  is_visible = excluded.is_visible,
  is_sellable = excluded.is_sellable,
  is_popular = excluded.is_popular,
  sort_order = excluded.sort_order;

insert into public.billing_plan_prices (plan_id, currency, amount_cents, interval)
select p.id, 'BRL', v.amount_cents, 'month'
from (
  values
    ('basico', 0),
    ('estudante', 1990),
    ('autonomo', 10990)
) as v(slug, amount_cents)
join public.billing_plans p on p.slug = v.slug
on conflict (plan_id, currency, interval) do update
set
  amount_cents = excluded.amount_cents;

insert into public.billing_plan_features (plan_id, feature, sort_order)
select p.id, v.feature, v.sort_order
from (
  values
    ('basico', 'Acesso a calculadoras básicas', 1),
    ('basico', 'Prévia da IA Jurídica', 2),
    ('basico', 'Materiais gratuitos selecionados', 3),
    ('basico', 'Suporte por email', 4),

    ('estudante', 'Acesso completo às calculadoras', 1),
    ('estudante', 'IA Jurídica com limite mensal', 2),
    ('estudante', 'Templates e exemplos de peças', 3),
    ('estudante', 'Suporte por email', 4),

    ('autonomo', 'Acesso completo às calculadoras', 1),
    ('autonomo', 'IA Jurídica com limite maior', 2),
    ('autonomo', 'Geração e revisão de documentos', 3),
    ('autonomo', 'Histórico e reaproveitamento de respostas', 4),
    ('autonomo', 'Suporte prioritário', 5),

    ('escritorio', 'Multiusuário e permissões', 1),
    ('escritorio', 'Gestão centralizada de materiais', 2),
    ('escritorio', 'Padrões e templates do escritório', 3),
    ('escritorio', 'Relatórios e controle de uso', 4)
) as v(slug, feature, sort_order)
join public.billing_plans p on p.slug = v.slug
on conflict (plan_id, feature) do update
set
  sort_order = excluded.sort_order;
