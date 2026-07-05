create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'staff');
create type public.session_status as enum ('draft', 'open', 'closed');
create type public.issue_status as enum ('open', 'accepted', 'corrected', 'voided');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'staff',
  group_name text,
  created_at timestamptz not null default now()
);

create table public.stock_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_by uuid not null references public.users(id),
  imported_at timestamptz not null default now(),
  row_count numeric(10,0) not null,
  is_active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  stock_import_id uuid not null references public.stock_imports(id) on delete cascade,
  barcode text not null,
  sku text not null,
  name text not null,
  category text not null,
  store text not null,
  system_qty numeric(14,3) not null,
  stock_version timestamptz not null,
  unique(stock_import_id, store, sku)
);
create index products_barcode_idx on public.products(barcode);
create index products_sku_idx on public.products(sku);

create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  batch_key text not null,
  batch_no text,
  inward_tranno text,
  expiry_date timestamptz,
  transaction_date timestamptz,
  current_qty numeric(14,3) not null,
  purchase_price numeric(14,2),
  landing_cost numeric(14,2),
  distributor text,
  stock_version timestamptz not null,
  unique(product_id, batch_key)
);
create index stock_batches_expiry_idx on public.stock_batches(expiry_date);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status public.session_status not null default 'draft',
  category text,
  store text not null,
  stock_import_id uuid not null references public.stock_imports(id),
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz
);
create unique index sessions_stock_import_unique on public.sessions(stock_import_id);

create table public.session_products (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  stock_batch_id uuid not null references public.stock_batches(id),
  system_qty_snapshot numeric(14,3) not null,
  stock_version_snapshot timestamptz not null,
  unique(session_id, stock_batch_id)
);
create index session_products_product_idx on public.session_products(product_id);

create table public.session_assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  group_name text,
  check (user_id is not null or group_name is not null)
);

create table public.count_entries (
  id uuid primary key default gen_random_uuid(),
  local_entry_id uuid not null unique,
  device_id uuid not null,
  session_id uuid not null references public.sessions(id),
  product_id uuid not null references public.products(id),
  stock_batch_id uuid not null references public.stock_batches(id),
  user_id uuid not null references public.users(id),
  quantity numeric(14,3) not null check (quantity >= 0),
  area text,
  note text,
  is_voided boolean not null default false,
  created_on_device_at timestamptz not null,
  synced_at timestamptz not null default now(),
  corrected_from_id uuid references public.count_entries(id)
);
create index count_entries_session_product_idx on public.count_entries(session_id, product_id);

create table public.sync_issues (
  id uuid primary key default gen_random_uuid(),
  local_entry_id uuid not null,
  entry_id uuid references public.count_entries(id),
  user_id uuid not null references public.users(id),
  barcode text not null,
  product_id uuid references public.products(id),
  stock_batch_id uuid references public.stock_batches(id),
  session_id uuid references public.sessions(id),
  code text not null,
  message text not null,
  payload jsonb not null,
  status public.issue_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index sync_issues_status_idx on public.sync_issues(status);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'Staff'), '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.users where id = auth.uid() and role = 'admin') $$;

create or replace function public.create_count_session(
  p_name text,
  p_file_name text,
  p_products jsonb,
  p_assignee_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import_id uuid;
  v_session_id uuid;
  v_product_id uuid;
  v_batch_id uuid;
  v_product jsonb;
  v_batch jsonb;
  v_assignee uuid;
  v_now timestamptz := now();
  v_store text := 'Main Store';
  v_category text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if jsonb_typeof(p_products) <> 'array' or jsonb_array_length(p_products) = 0 then
    raise exception 'The stock master contains no products';
  end if;

  v_store := coalesce(nullif(p_products->0->>'store', ''), 'Main Store');
  v_category := nullif(p_products->0->>'category', '');

  insert into public.stock_imports (file_name, imported_by, row_count)
  values (p_file_name, auth.uid(), jsonb_array_length(p_products))
  returning id into v_import_id;

  insert into public.sessions (
    name, status, category, store, stock_import_id, created_by, opened_at
  ) values (
    p_name, 'open', v_category, v_store, v_import_id, auth.uid(), v_now
  ) returning id into v_session_id;

  for v_product in select value from jsonb_array_elements(p_products)
  loop
    insert into public.products (
      stock_import_id, barcode, sku, name, category, store, system_qty, stock_version
    ) values (
      v_import_id,
      coalesce(v_product->>'barcode', ''),
      v_product->>'sku',
      v_product->>'product',
      coalesce(nullif(v_product->>'category', ''), 'Uncategorised'),
      coalesce(nullif(v_product->>'store', ''), v_store),
      coalesce((v_product->>'systemQty')::numeric, 0),
      v_now
    ) returning id into v_product_id;

    for v_batch in select value from jsonb_array_elements(v_product->'batches')
    loop
      insert into public.stock_batches (
        product_id, batch_key, batch_no, inward_tranno, expiry_date,
        transaction_date, current_qty, purchase_price, landing_cost,
        distributor, stock_version
      ) values (
        v_product_id,
        v_batch->>'batchKey',
        nullif(v_batch->>'batchNo', ''),
        nullif(v_batch->>'inwardTranno', ''),
        case when nullif(v_batch->>'expiryDate', '') is null then null else (v_batch->>'expiryDate')::date end,
        case when nullif(v_batch->>'transactionDate', '') is null then null else (v_batch->>'transactionDate')::date end,
        coalesce((v_batch->>'currentStock')::numeric, 0),
        nullif(v_batch->>'purchasePrice', '')::numeric,
        nullif(v_batch->>'landingCost', '')::numeric,
        nullif(v_batch->>'distributor', ''),
        v_now
      ) returning id into v_batch_id;

      insert into public.session_products (
        session_id, product_id, stock_batch_id, system_qty_snapshot, stock_version_snapshot
      ) values (
        v_session_id, v_product_id, v_batch_id,
        coalesce((v_batch->>'currentStock')::numeric, 0), v_now
      );
    end loop;
  end loop;

  foreach v_assignee in array p_assignee_ids
  loop
    insert into public.session_assignments (session_id, user_id)
    values (v_session_id, v_assignee);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (
    auth.uid(), 'session.created', 'session', v_session_id,
    jsonb_build_object('file_name', p_file_name, 'product_count', jsonb_array_length(p_products))
  );
  return v_session_id;
end;
$$;

create or replace function public.close_count_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.sessions
  set status = 'closed', closed_at = now()
  where id = p_session_id and status = 'open';
  if not found then raise exception 'Open session not found'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'session.closed', 'session', p_session_id);
end;
$$;

create or replace function public.resolve_sync_issue(
  p_issue_id uuid,
  p_resolution public.issue_status,
  p_quantity numeric default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.sync_issues%rowtype;
  v_entry public.count_entries%rowtype;
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
  values (auth.uid(), 'sync_issue.resolved', 'sync_issue', p_issue_id, jsonb_build_object('resolution', p_resolution, 'quantity', p_quantity));
end;
$$;

create or replace function public.assign_sync_issue(
  p_issue_id uuid,
  p_session_id uuid,
  p_stock_batch_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.sync_issues%rowtype;
  v_product_id uuid;
  v_entry_id uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_issue from public.sync_issues where id = p_issue_id and status = 'open' for update;
  if not found then raise exception 'Open issue not found'; end if;

  select sp.product_id into v_product_id
  from public.session_products sp
  join public.sessions s on s.id = sp.session_id
  where sp.session_id = p_session_id and sp.stock_batch_id = p_stock_batch_id and s.status = 'open';
  if not found then raise exception 'The selected batch is not in an open session'; end if;

  insert into public.count_entries (
    local_entry_id, device_id, session_id, product_id, stock_batch_id,
    user_id, quantity, area, note, created_on_device_at
  ) values (
    (v_issue.payload->>'localEntryId')::uuid,
    (v_issue.payload->>'deviceId')::uuid,
    p_session_id,
    v_product_id,
    p_stock_batch_id,
    v_issue.user_id,
    (v_issue.payload->>'quantity')::numeric,
    nullif(v_issue.payload->>'area', ''),
    nullif(v_issue.payload->>'note', ''),
    coalesce((v_issue.payload->>'createdAt')::timestamptz, now())
  ) returning id into v_entry_id;

  update public.sync_issues
  set entry_id = v_entry_id, product_id = v_product_id, stock_batch_id = p_stock_batch_id,
      session_id = p_session_id, status = 'accepted', resolution_note = 'Assigned to an existing session batch',
      resolved_by = auth.uid(), resolved_at = now()
  where id = p_issue_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, after)
  values (auth.uid(), 'sync_issue.assigned', 'sync_issue', p_issue_id, jsonb_build_object('session_id', p_session_id, 'stock_batch_id', p_stock_batch_id));
end;
$$;

create or replace function public.admin_correct_count_entry(
  p_entry_id uuid,
  p_action text,
  p_quantity numeric default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.count_entries%rowtype;
  v_new_id uuid;
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
  values (auth.uid(), 'count_entry.' || p_action, 'count_entry', p_entry_id, to_jsonb(v_entry), jsonb_build_object('new_entry_id', v_new_id, 'quantity', p_quantity));
  return v_new_id;
end;
$$;

alter table public.users enable row level security;
alter table public.stock_imports enable row level security;
alter table public.products enable row level security;
alter table public.stock_batches enable row level security;
alter table public.sessions enable row level security;
alter table public.session_products enable row level security;
alter table public.session_assignments enable row level security;
alter table public.count_entries enable row level security;
alter table public.sync_issues enable row level security;
alter table public.audit_logs enable row level security;

create policy "users read self or admin" on public.users for select
  using (id = auth.uid() or public.is_admin());
create policy "admin manages users" on public.users for all
  using (public.is_admin()) with check (public.is_admin());

create policy "assigned users read session imports" on public.stock_imports for select using (
  public.is_admin() or exists (
    select 1 from public.sessions s
    where s.stock_import_id = stock_imports.id
  )
);
create policy "admin manages imports" on public.stock_imports for all using (public.is_admin()) with check (public.is_admin());
create policy "assigned users read session products" on public.products for select using (
  public.is_admin() or exists (
    select 1 from public.session_products sp
    join public.sessions s on s.id = sp.session_id
    where sp.product_id = products.id
  )
);
create policy "admin manages products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "assigned users read session batches" on public.stock_batches for select using (
  public.is_admin() or exists (
    select 1 from public.session_products sp
    join public.sessions s on s.id = sp.session_id
    where sp.stock_batch_id = stock_batches.id
  )
);
create policy "admin manages stock batches" on public.stock_batches for all using (public.is_admin()) with check (public.is_admin());

create policy "assigned sessions visible" on public.sessions for select using (
  public.is_admin() or exists (
    select 1 from public.session_assignments a
    join public.users u on u.id = auth.uid()
    where a.session_id = sessions.id and (a.user_id = auth.uid() or a.group_name = u.group_name)
  )
);
create policy "admin manages sessions" on public.sessions for all using (public.is_admin()) with check (public.is_admin());
create policy "session products follow session access" on public.session_products for select using (
  exists (select 1 from public.sessions s where s.id = session_products.session_id)
);
create policy "admin manages session products" on public.session_products for all using (public.is_admin()) with check (public.is_admin());
create policy "assignments follow session access" on public.session_assignments for select using (
  public.is_admin() or user_id = auth.uid()
);
create policy "admin manages assignments" on public.session_assignments for all using (public.is_admin()) with check (public.is_admin());

create policy "assigned users read session entries" on public.count_entries for select
  using (
    public.is_admin() or exists (
      select 1 from public.session_assignments a
      join public.users u on u.id = auth.uid()
      where a.session_id = count_entries.session_id
        and (a.user_id = auth.uid() or a.group_name = u.group_name)
    )
  );
create policy "users insert own entries" on public.count_entries for insert
  with check (user_id = auth.uid());
create policy "admin updates entries" on public.count_entries for update
  using (public.is_admin()) with check (public.is_admin());
create policy "admin reviews issues" on public.sync_issues for all
  using (public.is_admin()) with check (public.is_admin());
create policy "admin reads audit" on public.audit_logs for select using (public.is_admin());
create policy "authenticated writes own audit" on public.audit_logs for insert with check (actor_id = auth.uid());

create or replace view public.session_variances
with (security_invoker = true) as
select
  sp.session_id,
  sp.product_id,
  sp.stock_batch_id,
  p.barcode,
  p.sku,
  p.name,
  sb.batch_no,
  sb.inward_tranno,
  sb.expiry_date,
  sp.system_qty_snapshot as system_qty,
  coalesce(sum(ce.quantity) filter (where not ce.is_voided), 0) as count_qty,
  coalesce(sum(ce.quantity) filter (where not ce.is_voided), 0) - sp.system_qty_snapshot as difference
from public.session_products sp
join public.products p on p.id = sp.product_id
join public.stock_batches sb on sb.id = sp.stock_batch_id
left join public.count_entries ce on ce.session_id = sp.session_id and ce.stock_batch_id = sp.stock_batch_id
group by sp.session_id, sp.product_id, sp.stock_batch_id, p.barcode, p.sku, p.name, sb.batch_no, sb.inward_tranno, sb.expiry_date, sp.system_qty_snapshot;

create or replace view public.session_product_progress
with (security_invoker = true) as
select
  sp.session_id,
  sp.product_id,
  p.barcode,
  p.sku,
  p.name,
  count(distinct sp.stock_batch_id) as expected_batches,
  count(distinct sp.stock_batch_id) filter (
    where exists (
      select 1 from public.count_entries ce
      where ce.session_id = sp.session_id
        and ce.stock_batch_id = sp.stock_batch_id
        and not ce.is_voided
    )
  ) as counted_batches,
  case
    when count(distinct sp.stock_batch_id) filter (
      where exists (
        select 1 from public.count_entries ce
        where ce.session_id = sp.session_id
          and ce.stock_batch_id = sp.stock_batch_id
          and not ce.is_voided
      )
    ) = 0 then 'uncounted'
    when count(distinct sp.stock_batch_id) filter (
      where exists (
        select 1 from public.count_entries ce
        where ce.session_id = sp.session_id
          and ce.stock_batch_id = sp.stock_batch_id
          and not ce.is_voided
      )
    ) < count(distinct sp.stock_batch_id) then 'partial'
    else 'counted'
  end as count_status
from public.session_products sp
join public.products p on p.id = sp.product_id
group by sp.session_id, sp.product_id, p.barcode, p.sku, p.name;
