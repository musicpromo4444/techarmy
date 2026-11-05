-- Persist every selected course and level for both payment routes.
-- The earlier tables stored only a single course; these columns keep the
-- complete selection list without breaking existing single-course records.

alter table public.tech_army_manual_payments
  add column if not exists course_id text,
  add column if not exists course_title text,
  add column if not exists level text,
  add column if not exists course_selections jsonb not null default '[]'::jsonb;

alter table public.tech_army_registrations
  add column if not exists course_id text,
  add column if not exists course_title text,
  add column if not exists level text,
  add column if not exists course_selections jsonb not null default '[]'::jsonb;

alter table public.tech_army_manual_payments
  drop constraint if exists tech_army_manual_payments_course_selections_array_check;
alter table public.tech_army_manual_payments
  add constraint tech_army_manual_payments_course_selections_array_check
  check (jsonb_typeof(course_selections) = 'array' and jsonb_array_length(course_selections) <= 3);

alter table public.tech_army_registrations
  drop constraint if exists tech_army_registrations_course_selections_array_check;
alter table public.tech_army_registrations
  add constraint tech_army_registrations_course_selections_array_check
  check (jsonb_typeof(course_selections) = 'array' and jsonb_array_length(course_selections) <= 3);
