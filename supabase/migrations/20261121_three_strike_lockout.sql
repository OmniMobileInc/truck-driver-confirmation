-- Apply in Supabase SQL Editor before deploying the API change.
-- Serializes verification attempts for each link so concurrent requests cannot bypass the limit.
create or replace function public.adbs_record_driver_attempt(
  p_token text,
  p_entered_usdot text,
  p_entered_plate text,
  p_driver_answered boolean
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
  v_time timestamptz := now();
begin
  select * into v_link from public.verify_links
    where token = p_token for update;
  if not found then
    return jsonb_build_object('state','not_found');
  end if;
  if lower(coalesce(v_link.status,'')) in ('revoked','cleared','completed','locked') then
    return jsonb_build_object('state',lower(v_link.status));
  end if;
  select count(*) into v_failures from public.verify_checks
    where token = p_token and result = 'CAUTION_ALERT';
  if v_failures >= 3 then
    update public.verify_links set status = 'locked' where token = p_token;
    return jsonb_build_object('state','locked');
  end if;
  v_match := regexp_replace(coalesce(p_entered_usdot,''),'[^0-9]','','g') =
    regexp_replace(coalesce(v_link.usdot_on_record,''),'[^0-9]','','g')
    and upper(btrim(coalesce(p_entered_plate,''))) = upper(btrim(coalesce(v_link.plate_on_record,'')))
    and coalesce(p_driver_answered,false);
  v_result := case when v_match then 'CLEAR_TO_LOAD' else 'CAUTION_ALERT' end;
  insert into public.verify_checks
    (token,entered_usdot,entered_plate,driver_answered,result,checked_at)
  values (p_token,p_entered_usdot,p_entered_plate,coalesce(p_driver_answered,false),v_result,v_time);
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
-- Never allow browsers or anonymous Supabase clients to invoke this privileged function.
revoke all on function public.adbs_record_driver_attempt(text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.adbs_record_driver_attempt(text,text,text,boolean) to service_role;
