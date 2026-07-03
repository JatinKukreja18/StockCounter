-- Apply this migration after 0001 on existing pilot projects.

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id, coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'Staff'), '@', 1)),
    'staff'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

insert into public.users (id, email, full_name, role)
select id, coalesce(email, ''), coalesce(nullif(raw_user_meta_data->>'full_name', ''), split_part(coalesce(email, 'Staff'), '@', 1)), 'staff'
from auth.users
on conflict (id) do nothing;

create or replace function public.create_count_session(
  p_name text, p_file_name text, p_products jsonb,
  p_assignee_ids uuid[] default array[]::uuid[]
) returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_import_id uuid; v_session_id uuid; v_product_id uuid; v_batch_id uuid;
  v_product jsonb; v_batch jsonb; v_assignee uuid; v_now timestamptz := now();
  v_store text := 'Main Store'; v_category text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) = 0 then
    raise exception 'The stock master contains no products';
  end if;
  v_store := coalesce(nullif(p_products->0->>'store', ''), 'Main Store');
  v_category := nullif(p_products->0->>'category', '');

  insert into public.stock_imports (file_name, imported_by, row_count)
  values (p_file_name, auth.uid(), jsonb_array_length(p_products)) returning id into v_import_id;
  insert into public.sessions (name, status, category, store, stock_import_id, created_by, opened_at)
  values (p_name, 'open', v_category, v_store, v_import_id, auth.uid(), v_now) returning id into v_session_id;

  for v_product in select value from jsonb_array_elements(p_products) loop
    insert into public.products (stock_import_id, barcode, sku, name, category, store, system_qty, stock_version)
    values (
      v_import_id, coalesce(v_product->>'barcode', ''), v_product->>'sku', v_product->>'product',
      coalesce(nullif(v_product->>'category', ''), 'Uncategorised'),
      coalesce(nullif(v_product->>'store', ''), v_store),
      coalesce((v_product->>'systemQty')::numeric, 0), v_now
    ) returning id into v_product_id;

    for v_batch in select value from jsonb_array_elements(v_product->'batches') loop
      insert into public.stock_batches (
        product_id, batch_key, batch_no, inward_tranno, expiry_date, transaction_date,
        current_qty, purchase_price, landing_cost, distributor, stock_version
      ) values (
        v_product_id, v_batch->>'batchKey', nullif(v_batch->>'batchNo', ''),
        nullif(v_batch->>'inwardTranno', ''),
        case when nullif(v_batch->>'expiryDate', '') is null then null else (v_batch->>'expiryDate')::date end,
        case when nullif(v_batch->>'transactionDate', '') is null then null else (v_batch->>'transactionDate')::date end,
        coalesce((v_batch->>'currentStock')::numeric, 0),
        nullif(v_batch->>'purchasePrice', '')::numeric,
        nullif(v_batch->>'landingCost', '')::numeric,
        nullif(v_batch->>'distributor', ''), v_now
      ) returning id into v_batch_id;
      insert into public.session_products (
        session_id, product_id, stock_batch_id, system_qty_snapshot, stock_version_snapshot
      ) values (
        v_session_id, v_product_id, v_batch_id,
        coalesce((v_batch->>'currentStock')::numeric, 0), v_now
      );
    end loop;
  end loop;

  foreach v_assignee in array p_assignee_ids loop
    insert into public.session_assignments (session_id, user_id) values (v_session_id, v_assignee);
  end loop;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'session.created', 'session', v_session_id,
    jsonb_build_object('file_name', p_file_name, 'product_count', jsonb_array_length(p_products)));
  return v_session_id;
end;
$$;

create or replace function public.close_count_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.sessions set status = 'closed', closed_at = now()
  where id = p_session_id and status = 'open';
  if not found then raise exception 'Open session not found'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'session.closed', 'session', p_session_id);
end;
$$;

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
    if p_quantity is null or p_quantity <= 0 then raise exception 'A positive corrected quantity is required'; end if;
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

create or replace function public.assign_sync_issue(
  p_issue_id uuid, p_session_id uuid, p_stock_batch_id uuid
) returns void language plpgsql security definer set search_path = public
as $$
declare v_issue public.sync_issues%rowtype; v_product_id uuid; v_entry_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_issue from public.sync_issues where id = p_issue_id and status = 'open' for update;
  if not found then raise exception 'Open issue not found'; end if;
  select sp.product_id into v_product_id
  from public.session_products sp join public.sessions s on s.id = sp.session_id
  where sp.session_id = p_session_id and sp.stock_batch_id = p_stock_batch_id and s.status = 'open';
  if not found then raise exception 'The selected batch is not in an open session'; end if;
  insert into public.count_entries (
    local_entry_id, device_id, session_id, product_id, stock_batch_id,
    user_id, quantity, area, note, created_on_device_at
  ) values (
    (v_issue.payload->>'localEntryId')::uuid, (v_issue.payload->>'deviceId')::uuid,
    p_session_id, v_product_id, p_stock_batch_id, v_issue.user_id,
    (v_issue.payload->>'quantity')::numeric, nullif(v_issue.payload->>'area', ''),
    nullif(v_issue.payload->>'note', ''), coalesce((v_issue.payload->>'createdAt')::timestamptz, now())
  ) returning id into v_entry_id;
  update public.sync_issues
  set entry_id = v_entry_id, product_id = v_product_id, stock_batch_id = p_stock_batch_id,
      session_id = p_session_id, status = 'accepted',
      resolution_note = 'Assigned to an existing session batch', resolved_by = auth.uid(), resolved_at = now()
  where id = p_issue_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'sync_issue.assigned', 'sync_issue', p_issue_id,
    jsonb_build_object('session_id', p_session_id, 'stock_batch_id', p_stock_batch_id));
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
    if p_quantity is null or p_quantity <= 0 then raise exception 'A positive corrected quantity is required'; end if;
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

drop policy if exists "authenticated read imports" on public.stock_imports;
drop policy if exists "assigned users read session imports" on public.stock_imports;
create policy "assigned users read session imports" on public.stock_imports for select using (
  public.is_admin() or exists (select 1 from public.sessions s where s.stock_import_id = stock_imports.id)
);

drop policy if exists "authenticated read products" on public.products;
drop policy if exists "assigned users read session products" on public.products;
create policy "assigned users read session products" on public.products for select using (
  public.is_admin() or exists (
    select 1 from public.session_products sp join public.sessions s on s.id = sp.session_id
    where sp.product_id = products.id
  )
);

drop policy if exists "authenticated read stock batches" on public.stock_batches;
drop policy if exists "assigned users read session batches" on public.stock_batches;
create policy "assigned users read session batches" on public.stock_batches for select using (
  public.is_admin() or exists (
    select 1 from public.session_products sp join public.sessions s on s.id = sp.session_id
    where sp.stock_batch_id = stock_batches.id
  )
);
