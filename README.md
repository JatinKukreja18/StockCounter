# Sekai Ichiba Stock Count

Offline-first physical stock counting PWA built with Next.js 15, React 19, Supabase, Drizzle, IndexedDB, html5-qrcode, and SheetJS.

## Start locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_DEMO_MODE=true` to use the included demonstration data without Supabase. The counting queue still uses real IndexedDB and the sync endpoint simulates routing and validation.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_stock_count.sql`, `0002_pilot_backend.sql`, `0003_product_level_counting.sql`, and `0004_mobile_pin_auth.sql` in order.
3. Fill in `.env.local`.
4. Create Auth users, then add matching rows to `public.users`.
5. Set `NEXT_PUBLIC_DEMO_MODE=false`.

The Supabase secret key is reserved for server-side import/administration code and must never use the `NEXT_PUBLIC_` prefix. New Supabase projects should use publishable and secret keys; legacy anon/service-role keys remain supported by the client helpers during migration.

Staff accounts use admin-created Indian mobile numbers and 6-digit PINs. Enable the Phone provider in Supabase Authentication settings; this flow auto-confirms staff phone numbers and does not send OTP messages. Existing administrators can continue signing in with email and password.

## Counting semantics

- Every count session owns exactly one immutable GoFrugal Excel import. A later session may use a different file without changing the earlier session's master quantities.
- Every Save creates an additive entry with a device-generated UUID.
- GoFrugal batch/lot rows are combined into one countable system total per SKU.
- Staff count the product's total physical quantity without selecting a batch or expiry.
- A physical count of zero is valid and marks the product as counted.
- Entries are written to IndexedDB before any network request.
- Manual Sync sends up to 250 entries in one request.
- `count_entries.local_entry_id` is unique, making retries idempotent.
- Repeating a SKU, user, or area is valid and adds another entry.
- Variances and exports are product-level. Admins allocate any adjustment to the appropriate GoFrugal batch afterward.
- A product is `uncounted` until it has at least one active count entry in that session.
- Synced entries cannot be edited or deleted on the staff device.
- Admin corrections should void the original and create a linked correction, preserving the audit trail.

## Install as an app

Run a production build over HTTPS. On Android use the browser’s **Install app** action. On iPhone open in Safari, tap **Share**, then **Add to Home Screen**. Camera access requires HTTPS (localhost is allowed during development).
