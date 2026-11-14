-- Dock Portal beta: run only after reviewing against the production schema.
create table if not exists public.adbs_facility_members (
  facility_id text not null references public.adbs_facilities(facility_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (facility_id, user_id)
);
create index if not exists adbs_facility_members_user_idx on public.adbs_facility_members(user_id);
alter table public.adbs_facility_members enable row level security;
-- No public policies: only service-role server functions can inspect memberships.
-- Admin must add memberships after verifying facility authorization.
-- Existing facility registration endpoint must be access-controlled before public onboarding.
