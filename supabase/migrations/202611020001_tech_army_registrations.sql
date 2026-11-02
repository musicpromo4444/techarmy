create table if not exists public.tech_army_registrations (
  id uuid primary key default gen_random_uuid(),
  payment_reference text not null unique,
  student_name text not null,
  whatsapp text not null,
  email text not null,
  country text not null,
  classes text[] not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  payment_status text not null check (payment_status in ('success')),
  batch_month text,
  created_at timestamptz not null default now()
);

alter table public.tech_army_registrations enable row level security;

-- Browser clients receive no direct read/write access. The server uses the
-- Supabase service-role key only after verifying the transaction with Paystack.
revoke all on public.tech_army_registrations from anon, authenticated;
