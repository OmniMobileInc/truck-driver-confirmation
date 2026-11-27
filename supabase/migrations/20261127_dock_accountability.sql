-- Keep legacy audit records and require a fresh acknowledgment for active legacy links.
begin;

create table if not exists public.adbs_facility_members (
  facility_id text not null references public.adbs_facilities(facility_id),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (facility_id, user_id)
);
create index if not exists adbs_facility_members_user_idx on public.adbs_facility_members(user_id);
alter table public.adbs_facility_members enable row level security;

alter table public.verify_links add column if not exists broker_acknowledged_at timestamptz;
alter table public.verify_checks
  add column if not exists dock_employee_id uuid,
  add column if not exists dock_employee_email text,
  add column if not exists dock_certified_at timestamptz;

alter table public.verify_links enable row level security;
alter table public.verify_checks enable row level security;
alter table public.broker_accounts enable row level security;
alter table public.beta_requests enable row level security;
alter table public.adbs_facilities enable row level security;

revoke all on table public.verify_links, public.verify_checks, public.broker_accounts,
  public.beta_requests, public.adbs_facilities, public.adbs_facility_members
  from public, anon, authenticated;
grant select, insert, update, delete on table public.verify_links, public.verify_checks,
  public.broker_accounts, public.beta_requests, public.adbs_facilities,
  public.adbs_facility_members to service_role;

drop function if exists public.adbs_record_driver_attempt(text,text,text,boolean);

create or replace function public.adbs_record_driver_attempt(
  p_token text,
  p_entered_usdot text,
  p_entered_plate text,
  p_driver_answered boolean,
  p_dock_user_id uuid,
  p_dock_certified boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.verify_links%rowtype;
  v_failures integer;
  v_match boolean;
  v_result text;
  v_time timestamptz;
begin
  select * into v_link from public.verify_links
    where token = p_token for update;
  if not found then
    return jsonb_build_object('state','not_found');
  end if;
  perform 1 from public.adbs_facility_members
    where facility_id = v_link.facility_id and user_id = p_dock_user_id
    for key share;
  if not found then
    return jsonb_build_object('state','forbidden');
  end if;
  if p_dock_certified is distinct from true then
    return jsonb_build_object('state','uncertified');
  end if;
  if lower(coalesce(v_link.status,'')) in ('revoked','cleared','completed','locked') then
    return jsonb_build_object('state',lower(v_link.status));
  end if;
  v_time := clock_timestamp();
  if lower(coalesce(v_link.status,'')) <> 'active' then
    return jsonb_build_object('state','unavailable');
  end if;
  if v_link.expires_at is not null and v_link.expires_at <= v_time then
    return jsonb_build_object('state','expired');
  end if;
  if v_link.starts_at is not null and v_link.starts_at > v_time then
    return jsonb_build_object('state','pending');
  end if;
  if v_link.broker_acknowledged_at is null then
    return jsonb_build_object('state','unacknowledged');
  end if;
  select count(*) into v_failures from public.verify_checks
    where token = p_token and result = 'CAUTION_ALERT';
  if v_failures >= 3 then
    update public.verify_links set status = 'locked' where token = p_token;
    return jsonb_build_object('state','locked');
  end if;
  v_match := coalesce(p_entered_usdot,'') ~ '[0-9]' and btrim(coalesce(p_entered_plate,'')) <> '' and regexp_replace(coalesce(p_entered_usdot,''),'[^0-9]','','g') =
    regexp_replace(coalesce(v_link.usdot_on_record,''),'[^0-9]','','g')
    and upper(btrim(coalesce(p_entered_plate,''))) = upper(btrim(coalesce(v_link.plate_on_record,'')))
    and coalesce(p_driver_answered,false);
  v_result := case when v_match then 'CLEAR_TO_LOAD' else 'CAUTION_ALERT' end;
  insert into public.verify_checks
    (token,entered_usdot,entered_plate,driver_answered,result,checked_at,dock_employee_id,dock_employee_email,dock_certified_at)
  values (p_token,p_entered_usdot,p_entered_plate,coalesce(p_driver_answered,false),v_result,v_time,
          p_dock_user_id,(select email from auth.users where id = p_dock_user_id),v_time);
  if v_match then
    update public.verify_links set status = 'cleared' where token = p_token;
    return jsonb_build_object('state','cleared','result',v_result,'verified_at',v_time,'failed_attempts',v_failures,'alert_triggered',false);
  end if;
  v_failures := v_failures + 1;
  if v_failures >= 3 then
    update public.verify_links set status = 'locked' where token = p_token;
  end if;
  return jsonb_build_object(
    'state',case when v_failures >= 3 then 'locked' else 'active' end,
    'result',v_result,'verified_at',v_time,'failed_attempts',v_failures,
    'alert_triggered',v_failures = 3);
end;
$$;

revoke all on function public.adbs_record_driver_attempt(text,text,text,boolean,uuid,boolean)
  from public, anon, authenticated;
grant execute on function public.adbs_record_driver_attempt(text,text,text,boolean,uuid,boolean)
  to service_role;

commit;
