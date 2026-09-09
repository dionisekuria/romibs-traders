# ROMIBS Traders

A modern storefront for ROMIBS Traders, offering comfortable baby and children's essentials for ages 10 and under, built with Next.js App Router.

## Local development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

The launch tracker is maintained in [Monday.com](https://dionisekurias-team-company.monday.com/boards/5103820000) with priorities for each task.

The catalog now supports Supabase. Copy `.env.example` to `.env.local`, fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then run the SQL in `supabase/schema.sql` from the Supabase SQL Editor. Open `/staff` to add products and update prices or variant stock. Without Supabase credentials, the storefront uses the demo catalog and the staff page is read-only.

Never expose or commit `SUPABASE_SERVICE_ROLE_KEY`. The staff API currently assumes that `/staff` is used privately; add Supabase Auth before exposing the dashboard publicly.

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
