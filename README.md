# ROMIBS Traders

A modern storefront for ROMIBS Traders, offering comfortable baby and children's essentials for ages 10 and under, built with Next.js App Router.

## Local development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

The launch tracker is maintained in [Monday.com](https://dionisekurias-team-company.monday.com/boards/5103820000) with priorities for each task.

The first milestone uses local demo catalog data so the shopping experience can be reviewed without provider credentials. Supabase, Google Sheets, and Pesapal configuration is documented in `.env.example` and will be connected through server adapters as the commerce backend is added.

## Product direction

The visual system is inspired by the ROMIBS logo: ink navy, bright sky blue, soft blue-gray surfaces, and clean white space. The catalog is intentionally editorial and practical, with inventory states visible at the point of purchase.

## Pre-launch checklist

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
