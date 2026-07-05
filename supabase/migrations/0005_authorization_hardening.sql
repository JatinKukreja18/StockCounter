-- Apply after 0004.
-- Make staff access depend on an actual session assignment and validate every
-- count entry against its assigned session/product/batch tuple.

create or replace function public.can_access_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.session_assignments assignment
    left join public.users profile on profile.id = auth.uid()
    where assignment.session_id = p_session_id
      and (
        assignment.user_id = auth.uid()
        or (
          assignment.group_name is not null
          and profile.group_name is not null
          and assignment.group_name = profile.group_name
        )
      )
  )
$$;

drop policy if exists "assigned sessions visible" on public.sessions;
create policy "assigned sessions visible" on public.sessions for select
  using (public.can_access_session(id));

drop policy if exists "assigned users read session imports" on public.stock_imports;
create policy "assigned users read session imports" on public.stock_imports for select
  using (
    public.is_admin() or exists (
      select 1 from public.sessions session
      where session.stock_import_id = stock_imports.id
        and public.can_access_session(session.id)
    )
  );

drop policy if exists "assigned users read session products" on public.products;
create policy "assigned users read session products" on public.products for select
  using (
    public.is_admin() or exists (
      select 1 from public.session_products mapping
      where mapping.product_id = products.id
        and public.can_access_session(mapping.session_id)
    )
  );

drop policy if exists "assigned users read session batches" on public.stock_batches;
create policy "assigned users read session batches" on public.stock_batches for select
  using (
    public.is_admin() or exists (
      select 1 from public.session_products mapping
      where mapping.stock_batch_id = stock_batches.id
        and public.can_access_session(mapping.session_id)
    )
  );

drop policy if exists "session products follow session access" on public.session_products;
create policy "session products follow session access" on public.session_products for select
  using (public.can_access_session(session_id));

drop policy if exists "assigned users read session entries" on public.count_entries;
create policy "assigned users read session entries" on public.count_entries for select
  using (public.can_access_session(session_id));

drop policy if exists "users insert own entries" on public.count_entries;
create policy "users insert own assigned entries" on public.count_entries for insert
  with check (
    user_id = auth.uid()
    and public.can_access_session(session_id)
    and exists (
      select 1 from public.session_products mapping
      where mapping.session_id = count_entries.session_id
        and mapping.product_id = count_entries.product_id
        and mapping.stock_batch_id = count_entries.stock_batch_id
    )
  );

drop policy if exists "admin reviews issues" on public.sync_issues;
create policy "admin reviews issues" on public.sync_issues for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "staff creates own sync issues" on public.sync_issues;
create policy "staff creates own sync issues" on public.sync_issues for insert
  with check (
    user_id = auth.uid()
    and (session_id is null or public.can_access_session(session_id))
  );
