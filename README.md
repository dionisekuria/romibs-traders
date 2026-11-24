# ROMIBS Traders

A modern storefront for ROMIBS Traders, offering comfortable baby and children's essentials for ages 10 and under, built with Next.js App Router.

## Local development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

The launch tracker is maintained in [Monday.com](https://dionisekurias-team-company.monday.com/boards/5103820000) with priorities for each task.

The catalog uses Supabase when configured. Copy `.env.example` to `.env.local`, fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, then run `supabase/schema.sql` from the Supabase SQL Editor for a new database. For an existing database, apply `supabase/migrations/20261124193000_staff_catalog_security.sql`.

### Provisioning staff

Disable public user sign-ups in Supabase Auth settings. Create staff users from the Supabase Dashboard under **Authentication → Users**, then add their Auth user UUID to `staff_members` from the SQL Editor:

```sql
insert into public.staff_members (user_id, role, active)
values ('<AUTH_USER_UUID>', 'admin', true);
```

Use the `staff` role for inventory operators and `admin` for administrators; both roles currently have the same catalog permissions. Deactivate access by setting `active = false`; remove a membership row to revoke it permanently. Staff can sign in at `/staff`, but the page and mutation API both require an active membership. Catalog creation and updates run through service-role-only database functions so product and variant changes are atomic.

Administrators can invite and manage staff from `/staff`. Invitations are sent through Supabase Auth and memberships are stored in `staff_members`. Deactivating or removing a membership immediately revokes staff API access.

The catalog supports full product and variant updates and deletion. Product-plus-variant writes run through service-role-only PostgreSQL functions, and `anon`/`authenticated` database roles have no direct catalog write privileges.

### Google Sheets catalog sync

Google Sheets is an optional import mechanism; staff updates remain writable in Supabase and a Sheets import replaces the catalog atomically. Configure `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_SHEET_RANGE`, then share the sheet with the service account. The default range is `Catalog!A1:L` and the headers must be exactly:

`id | name | category | price | description | image | image_alt | featured | variant_id | variant_label | variant_color | variant_stock`

Only administrators can run or view sync history. Duplicate IDs, malformed rows, unexpected headers, and database errors are rejected or recorded in `catalog_sync_runs`; a successful import replaces all products and variants in one transaction.

Never expose or commit `SUPABASE_SERVICE_ROLE_KEY`. Public catalog reads are available to `anon` and `authenticated` users; direct client writes to catalog and staff tables are denied by grants and RLS.

## Product direction

The visual system is inspired by the ROMIBS logo: ink navy, bright sky blue, soft blue-gray surfaces, and clean white space. The catalog is intentionally editorial and practical, with inventory states visible at the point of purchase.

## Pre-launch checklist

- [ ] Upgrade the storefront to a more premium retail layout inspired by the reference brand, with a stronger hero section, promo strip, category navigation, and clearer visual hierarchy.
- [ ] Add featured collection blocks and a denser, more conversion-focused product grid for mobile and desktop browsing.
- [ ] Improve product discovery with cleaner filters, clearer age/category grouping, and stronger merchandising for ages 10 and under.
- [ ] Refine the cart and checkout experience so shoppers can move from browsing to purchase with more confidence and fewer friction points.
- [ ] Replace demo products with the real baby and children's products for ages 10 and under.
- [ ] Add real prices, stock quantities, colors, age ranges, and delivery rates.
- [ ] Replace placeholder stock photos with approved ROMIBS product images.
- [ ] Connect checkout to a real order destination such as email, WhatsApp, or an order database.
- [ ] Choose and connect the payment flow, including M-Pesa or card payments.
- [ ] Add delivery areas, delivery timelines, returns, exchanges, payment instructions, privacy policy, and terms.
- [ ] Test the full shopping journey on mobile and desktop, including filtering, cart updates, checkout, sold-out items, and page refreshes.
- [ ] Connect the official domain and `romibstraders@gmail.com` email workflow.
- [ ] Add search metadata, social sharing images, analytics, and error monitoring.
- [ ] Deploy to production and complete one final end-to-end test order.
