create table if not exists public.tech_army_enquiries (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  whatsapp text not null,
  email text not null,
  country text not null,
  classes text[] not null check (cardinality(classes) > 0),
  status text not null default 'pending' check (status in ('pending','contacted','enrolled','closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tech_army_enquiries_status_created_idx on public.tech_army_enquiries(status, created_at desc);
alter table public.tech_army_enquiries enable row level security;
revoke all on public.tech_army_enquiries from anon, authenticated;
