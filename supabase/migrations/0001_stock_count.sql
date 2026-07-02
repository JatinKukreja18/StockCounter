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
  quantity numeric(14,3) not null check (quantity > 0),
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

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.users where id = auth.uid() and role = 'admin') $$;

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

create policy "authenticated read imports" on public.stock_imports for select to authenticated using (true);
create policy "admin manages imports" on public.stock_imports for all using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read products" on public.products for select to authenticated using (true);
create policy "admin manages products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read stock batches" on public.stock_batches for select to authenticated using (true);
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
