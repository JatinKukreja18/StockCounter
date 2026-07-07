# Pilot activation

The local app is configured for real Supabase mode. Complete these steps in order.

## 1. Apply the backend migrations

In Supabase Dashboard, open **SQL Editor → New query** and run these files in order:

`supabase/migrations/0002_pilot_backend.sql`

`supabase/migrations/0003_product_level_counting.sql`

`supabase/migrations/0004_mobile_pin_auth.sql`

`supabase/migrations/0005_authorization_hardening.sql`

The later migrations enable explicit zero counts, mobile/PIN staff accounts,
and strict assignment-based access for staff.

In **Authentication → Providers → Phone**, enable the Phone provider. Staff accounts are created and phone-confirmed by the admin, so this workflow does not send OTP messages.

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
```

Deploy `main`. In Supabase **Authentication → URL Configuration**, set the Vercel production URL as Site URL and add:

```text
https://YOUR-VERCEL-DOMAIN/**
http://localhost:3000/**
```

## 4. Create five staff users

Sign in to the deployed app as administrator and open **Users**. Create one account per tester using their 10-digit Indian mobile number and a unique 6-digit PIN. Share each PIN privately.

## 5. First real Excel upload

Open **Sessions → Create session** and select the GoFrugal Current Stock Detail file.

Verify that the product total and current-stock total match the GoFrugal report. Source batch/lot rows are combined into one countable total per product.

Select the five staff users and create the session. The Excel snapshot becomes immutable for that session.

## 6. Smoke test before inviting everyone

1. Sign in as one staff user on an iPhone.
2. Confirm only the assigned session is visible.
3. Count one product by entering its total physical quantity.
4. Count one missing product as zero and confirm both entries save locally.
5. Sync manually.
6. Confirm the admin variance and entry history update.
7. Confirm an untouched product remains under **Uncounted**.
8. Export XLSX, then close only the test session.
