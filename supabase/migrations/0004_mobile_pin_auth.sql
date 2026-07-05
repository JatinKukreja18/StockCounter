-- Apply after 0003 on existing projects.
-- Staff authenticate with an admin-created Indian mobile number and 6-digit PIN.

alter table public.users add column if not exists phone text;

update public.users as profile
set phone = nullif(auth_user.phone, '')
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.phone is null;

create unique index if not exists users_phone_unique
on public.users(phone)
where phone is not null;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, phone, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.phone, ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      nullif(new.phone, ''),
      'Staff'
    ),
    'staff'
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_auth_user();
