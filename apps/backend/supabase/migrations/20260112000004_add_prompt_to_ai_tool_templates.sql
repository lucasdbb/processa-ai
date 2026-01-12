alter table public.ai_tool_templates
add column if not exists prompt text;

update public.ai_tool_templates
set prompt = concat('Criar ', lower(template), ' para ')
where prompt is null or btrim(prompt) = '';

update public.ai_tool_templates
set prompt = 'Analisar CNIS: '
where tool_slug = 'cnis-analysis' and template ilike '%cnis%';

alter table public.ai_tool_templates
alter column prompt set not null;

create index if not exists idx_ai_tool_templates_tool_slug_sort_prompt
  on public.ai_tool_templates(tool_slug, sort_order);
