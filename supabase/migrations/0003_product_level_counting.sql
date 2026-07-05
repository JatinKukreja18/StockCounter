-- Apply after 0002 on existing projects.
-- Product-level stock counts must allow an explicit physical count of zero.

alter table public.count_entries
  drop constraint if exists count_entries_quantity_check;

alter table public.count_entries
  add constraint count_entries_quantity_check check (quantity >= 0);

create or replace function public.resolve_sync_issue(
  p_issue_id uuid, p_resolution public.issue_status,
  p_quantity numeric default null, p_note text default null
) returns void language plpgsql security definer set search_path = public
as $$
declare v_issue public.sync_issues%rowtype; v_entry public.count_entries%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_resolution not in ('accepted', 'corrected', 'voided') then raise exception 'Invalid resolution'; end if;
  select * into v_issue from public.sync_issues where id = p_issue_id and status = 'open' for update;
  if not found then raise exception 'Open issue not found'; end if;
  if v_issue.entry_id is not null and p_resolution in ('voided', 'corrected') then
    update public.count_entries set is_voided = true where id = v_issue.entry_id returning * into v_entry;
  end if;
  if p_resolution = 'corrected' then
    if p_quantity is null or p_quantity < 0 then raise exception 'A non-negative corrected quantity is required'; end if;
    insert into public.count_entries (
      local_entry_id, device_id, session_id, product_id, stock_batch_id,
      user_id, quantity, area, note, created_on_device_at, corrected_from_id
    ) values (
      gen_random_uuid(), v_entry.device_id, v_entry.session_id, v_entry.product_id, v_entry.stock_batch_id,
      auth.uid(), p_quantity, v_entry.area, p_note, now(), v_entry.id
    );
  end if;
  update public.sync_issues
  set status = p_resolution, resolution_note = p_note, resolved_by = auth.uid(), resolved_at = now()
  where id = p_issue_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'sync_issue.resolved', 'sync_issue', p_issue_id,
    jsonb_build_object('resolution', p_resolution, 'quantity', p_quantity));
end;
$$;

create or replace function public.admin_correct_count_entry(
  p_entry_id uuid, p_action text, p_quantity numeric default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = public
as $$
declare v_entry public.count_entries%rowtype; v_new_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('void', 'correct') then raise exception 'Invalid action'; end if;
  update public.count_entries set is_voided = true
  where id = p_entry_id and not is_voided returning * into v_entry;
  if not found then raise exception 'Active entry not found'; end if;
  if p_action = 'correct' then
    if p_quantity is null or p_quantity < 0 then raise exception 'A non-negative corrected quantity is required'; end if;
    insert into public.count_entries (
      local_entry_id, device_id, session_id, product_id, stock_batch_id,
      user_id, quantity, area, note, created_on_device_at, corrected_from_id
    ) values (
      gen_random_uuid(), v_entry.device_id, v_entry.session_id, v_entry.product_id, v_entry.stock_batch_id,
      auth.uid(), p_quantity, v_entry.area, p_note, now(), v_entry.id
    ) returning id into v_new_id;
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before, after)
  values (auth.uid(), 'count_entry.' || p_action, 'count_entry', p_entry_id, to_jsonb(v_entry),
    jsonb_build_object('new_entry_id', v_new_id, 'quantity', p_quantity));
  return v_new_id;
end;
$$;
