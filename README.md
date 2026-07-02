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
2. Run `supabase/migrations/0001_stock_count.sql` in the SQL editor.
3. Fill in `.env.local`.
4. Create Auth users, then add matching rows to `public.users`.
5. Set `NEXT_PUBLIC_DEMO_MODE=false`.

The Supabase secret key is reserved for server-side import/administration code and must never use the `NEXT_PUBLIC_` prefix. New Supabase projects should use publishable and secret keys; legacy anon/service-role keys remain supported by the client helpers during migration.

## Counting semantics

- Every count session owns exactly one immutable GoFrugal Excel import. A later session may use a different file without changing the earlier session's master quantities.
- Every Save creates an additive entry with a device-generated UUID.
- Counts are attached to a specific GoFrugal stock batch/lot, not only a SKU.
- When a product has multiple batches, staff must select the printed expiry or inward reference before saving.
- Entries are written to IndexedDB before any network request.
- Manual Sync sends up to 250 entries in one request.
- `count_entries.local_entry_id` is unique, making retries idempotent.
- Repeating a SKU, user, or area is valid and adds another entry.
- Product variances roll up from batch variances; expiry-level detail remains available for review and export.
- A product is `uncounted` until it has at least one active count entry for every expected batch in that session. Products with only some batches counted are `partial`.
- Synced entries cannot be edited or deleted on the staff device.
- Admin corrections should void the original and create a linked correction, preserving the audit trail.

## Install as an app

Run a production build over HTTPS. On Android use the browser’s **Install app** action. On iPhone open in Safari, tap **Share**, then **Add to Home Screen**. Camera access requires HTTPS (localhost is allowed during development).
