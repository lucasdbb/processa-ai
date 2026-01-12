create table if not exists public.ai_tool_templates (
  id uuid primary key default uuid_generate_v4(),
  tool_slug text not null references public.ai_tools(slug) on delete cascade,
  template text not null,
  sort_order int8 not null default 0,
  created_at timestamptz not null default now(),
  unique (tool_slug, template)
);

create index if not exists idx_ai_tool_templates_tool_slug_sort
  on public.ai_tool_templates(tool_slug, sort_order);

alter table public.ai_tool_templates enable row level security;

create policy "Authenticated can view ai tool templates"
  on public.ai_tool_templates
  for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage ai tool templates"
  on public.ai_tool_templates
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

insert into public.ai_tool_templates (tool_slug, template, sort_order)
select t.slug, v.template, v.sort_order
from (
  values
    ('initial-petition', 'Ação de Cobrança', 1),
    ('initial-petition', 'Ação Trabalhista', 2),
    ('initial-petition', 'Ação de Indenização', 3),
    ('initial-petition', 'Ação Previdenciária', 4),
    ('initial-petition', 'Ação de Despejo', 5),

    ('contract', 'Contrato de Trabalho', 1),
    ('contract', 'Contrato de Prestação de Serviços', 2),
    ('contract', 'Contrato de Locação', 3),
    ('contract', 'Contrato de Compra e Venda', 4),
    ('contract', 'Contrato de Sociedade', 5),

    ('defense', 'Contestação Trabalhista', 1),
    ('defense', 'Contestação Cível', 2),
    ('defense', 'Defesa Criminal', 3),
    ('defense', 'Impugnação ao Valor da Causa', 4),
    ('defense', 'Exceção de Incompetência', 5)
) as v(tool_slug, template, sort_order)
join public.ai_tools t on t.slug = v.tool_slug
on conflict (tool_slug, template) do update
set sort_order = excluded.sort_order;
