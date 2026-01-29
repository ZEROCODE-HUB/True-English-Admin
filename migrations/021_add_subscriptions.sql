-- Migration: 021_add_subscriptions.sql
-- Purpose: create a subscriptions table to track user subscriptions (Stripe/other)

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  plan_id text references public.plans(id) on delete set null,
  provider text not null default 'stripe', -- payment provider identifier
  provider_subscription_id text, -- external subscription id (eg. stripe subscription id)
  provider_customer_id text, -- external customer id
  price_id text, -- price id in provider
  product_id text,
  status text not null default 'active', -- active, past_due, canceled, incomplete, trialing, etc.
  quantity integer default 1,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_plan_id_idx on public.subscriptions(plan_id);
create index if not exists subscriptions_provider_subscription_id_idx on public.subscriptions(provider_subscription_id);

create or replace function public.set_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_subscriptions_updated_at();

-- Optional: make provider_subscription_id unique if you expect only one record per external subscription
-- create unique index if not exists subscriptions_provider_subscription_id_unique_idx on public.subscriptions(provider_subscription_id);
