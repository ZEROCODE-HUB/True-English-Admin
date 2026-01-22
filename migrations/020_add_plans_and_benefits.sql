-- Migration: 020_add_plans_and_benefits.sql
-- Purpose: add plans and plan_benefits tables for dynamic learning plans

create table if not exists public.plans (
  id text primary key,
  label text not null,
  duration_label text not null,
  price_mxn numeric(10,2) not null,
  price_per_month_mxn numeric(10,2) not null,
  recommended boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.set_plans_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_plans_updated_at
before update on public.plans
for each row execute function public.set_plans_updated_at();

create table if not exists public.plan_benefits (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  benefit_label text not null,
  benefit_description text,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists plan_benefits_plan_id_idx
  on public.plan_benefits(plan_id);

-- Seed default plans
insert into public.plans (id, label, duration_label, price_mxn, price_per_month_mxn, recommended, sort_order)
values
  ('1m', '1 mes',  '$249 MXN / mes', 249, 249, false, 1),
  ('3m', '3 meses', '$233 MXN / mes', 699, 233, true,  2),
  ('12m', '12 meses', '$208 MXN / mes', 2499, 208, false, 3)
on conflict (id) do update set
  label = excluded.label,
  duration_label = excluded.duration_label,
  price_mxn = excluded.price_mxn,
  price_per_month_mxn = excluded.price_per_month_mxn,
  recommended = excluded.recommended,
  sort_order = excluded.sort_order;

-- Seed benefits
insert into public.plan_benefits (plan_id, benefit_label, benefit_description, sort_order) values
  ('1m',  'Acceso a todas las lecciones', null, 1),
  ('1m',  'Conversaciones IA ilimitadas', null, 2),
  ('3m',  'Acceso a todas las lecciones', null, 1),
  ('3m',  'Conversaciones IA ilimitadas', null, 2),
  ('3m',  'Descuento especial por 3 meses', null, 3),
  ('12m', 'Acceso a todas las lecciones', null, 1),
  ('12m', 'Conversaciones IA ilimitadas', null, 2),
  ('12m', 'Mejor precio por mes', null, 3)
  on conflict do nothing;
