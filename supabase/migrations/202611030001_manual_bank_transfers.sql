create table if not exists public.tech_army_payment_settings (
  id text primary key check (id = 'default'),
  bank_name text,
  account_name text,
  account_number text,
  admin_whatsapp text not null default '2347017036508',
  general_group_url text,
  starter_group_url text,
  professional_group_url text,
  master_group_url text,
  updated_at timestamptz not null default now()
);
insert into public.tech_army_payment_settings (id, admin_whatsapp)
values ('default', '2347017036508')
on conflict (id) do nothing;

create table if not exists public.tech_army_manual_payments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  student_name text not null,
  whatsapp text not null,
  email text,
  country text not null,
  classes text[] not null check (cardinality(classes) > 0),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  started_at timestamptz,
  expires_at timestamptz,
  admin_notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tech_army_manual_payments_status_created_idx on public.tech_army_manual_payments(status, created_at desc);
create index if not exists tech_army_manual_payments_whatsapp_idx on public.tech_army_manual_payments(whatsapp);
alter table public.tech_army_payment_settings enable row level security;
alter table public.tech_army_manual_payments enable row level security;
revoke all on public.tech_army_payment_settings from anon, authenticated;
revoke all on public.tech_army_manual_payments from anon, authenticated;