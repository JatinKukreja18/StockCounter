# Pilot activation

The local app is configured for real Supabase mode. Complete these steps in order.

## 1. Apply the backend migration

In Supabase Dashboard, open **SQL Editor → New query**, paste the full contents of:

`supabase/migrations/0002_pilot_backend.sql`

Run it once. It adds the user-profile trigger, transactional Excel import, session closing, issue assignment/resolution, entry correction, audit logging, and tighter assigned-session RLS.

## 2. Create the first administrator

In **Authentication → Users**, create the administrator with an email and password and enable email confirmation.

Then run this in SQL Editor, replacing the email:

```sql
update public.users
set role = 'admin'
where email = 'YOUR-ADMIN-EMAIL';

select email, full_name, role
from public.users;
```

The result must show the administrator with role `admin`.

## 3. Deploy on Vercel

Import the private GitHub repository `JatinKukreja18/StockCounter`.

Configure these Production environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_DEMO_MODE=false
```

Deploy `main`. In Supabase **Authentication → URL Configuration**, set the Vercel production URL as Site URL and add:

```text
https://YOUR-VERCEL-DOMAIN/**
http://localhost:3000/**
```

## 4. Create five staff users

Sign in to the deployed app as administrator and open **Users**. Create one account per tester with a temporary password. Share each password privately.

## 5. First real Excel upload

Open **Sessions → Create session** and select the GoFrugal Current Stock Detail file.

For the supplied example, verify before creating:

- 470 products
- 602 expiry/batch rows
- Current stock total 4,304.76
- 18 missing-EAN warnings

Select the five staff users and create the session. The Excel snapshot becomes immutable for that session.

## 6. Smoke test before inviting everyone

1. Sign in as one staff user on an iPhone.
2. Confirm only the assigned session is visible.
3. Count one product with two expiry batches.
4. Confirm both entries save locally.
5. Sync manually.
6. Confirm the admin variance and entry history update.
7. Confirm an untouched product remains under **Uncounted**.
8. Export XLSX, then close only the test session.
