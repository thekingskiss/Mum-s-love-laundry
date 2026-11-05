# Mum's Love Laundry — Version 19.0

Laundry order-tracking app for Mum's Love Laundry (Eastern Region, Ghana).
**Walk-in drop-off model** — customers bring laundry in themselves and
collect it in person; there is no pickup or delivery service. PostgreSQL
(local or Supabase) + custom JWT auth, with a staff-facing operations system
layered on top of the customer-facing app.

## Structure

- `server/` — Express API (`/config`, `/middleware`, `/controllers`,
  `/routes`, `/db`, `/services`, `/utils`). Connects to local PostgreSQL or
  Supabase PostgreSQL via `pg`; it issues its own JWTs and hashes passwords
  with `bcryptjs`.
- `client/` — React + Vite single-page app styled with Tailwind CSS:
  a multi-page marketing site (Home/About/Services/Pricing/Blog/Contact),
  auth pages, a multi-step booking wizard (item cart + drop-off date), a
  customer dashboard, and a role-gated staff dashboard.
- `supabase/schema.sql` — the deprecated v1.0 Supabase schema, kept for
  reference only.
- server/db/init.sql — fresh-install schema baseline, folded through v13.
- server/db/migrate.js — checksummed, version-tracked migration runner; the
  fresh-install path applies v14–v23 after the v13 baseline.
- `server/db/migrate_v14_balance_reminders.sql`, `migrate_v15_invoices.sql`,
  `migrate_v16_branches.sql`, `migrate_v17_settings.sql`,
  `migrate_v18_late_fee_payments.sql`, `migrate_v19_backfill_branches.sql`,
  `migrate_v20_audit_log.sql`, `migrate_v21_shop_time_zone.sql`,
  `migrate_v22_more_themes.sql`, and `migrate_v23_naira.sql` — schema changes
  after that baseline. v21 sets
  the database to `Africa/Accra`, so its dates follow the shop's calendar
  whatever zone the server is configured for. v22 lets `theme_preference` hold
  the newer colour themes (see `client/src/lib/themes.js`).
  Do not replay the older v3–v13 migrations on top of `init.sql`; their
  changes are already included.
- server/uploads/avatars/ — local development storage for avatars; production
  uploads use Cloudinary. The local directory also serves any legacy avatar
  URLs until they are migrated.

## Setup

1. **Prerequisite**: use Node.js 20 or later.
2. **Database**: choose local PostgreSQL or Supabase PostgreSQL. Never commit
   `server/.env` or share database credentials. For Supabase, create a project
   and copy its PostgreSQL URI from **Project Settings -> Database -> Connection
   string**. Use the **Session pooler** URI for this long-running API and worker;
   put it in `server/.env` as `DATABASE_URL`. TLS is enabled automatically.
   This version keeps its existing PostgreSQL schema and custom JWT auth. Do
   not use the deprecated `supabase/schema.sql` or the Supabase client-side
   anon key.

   For local PostgreSQL, create the empty database with your locally
   configured PostgreSQL administrator credentials:
   
       "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE mums_love_laundry;"
   
3. **Backend**:
   ```
   cd server
   cp .env.example .env   # set DATABASE_URL or local DB settings, plus JWT_SECRET
   npm install
   npm run db:migrate
   npm run dev
   ```
   Runs on `http://localhost:4000`.

   `npm run db:migrate` initializes an empty database and applies the tracked
   schema changes. Changing the connection to Supabase does not copy records
   from your local database; export and import existing data separately
   before directing real users to the new database. Back up the local database
   first, and do not baseline a newly created empty Supabase database.
4. **Frontend**:
   ```
   cd client
   cp .env.example .env   # defaults to http://localhost:4000
   npm install
   npm run dev
   ```
   Runs on `http://localhost:5173`.

Start scheduled reminders in a separate server terminal with npm run worker.
The worker runs the daily jobs from 9:00 to 9:15am in Africa/Accra.
PostgreSQL advisory locks prevent overlapping worker or manual runs across instances.

For an existing database created before migration tracking, confirm its schema
and run npm run db:migrate -- --baseline=VERSION, where VERSION is the highest
fully applied version from 13 through 17. The runner validates the baseline,
then applies anything newer.

### Creating your first staff/admin account

Registration (`/register`) always creates a `customer` account. To get a
staff or admin account, promote any existing user directly in the database:

```
psql -U postgres -h 127.0.0.1 -d mums_love_laundry -c "UPDATE users SET role = 'super_admin' WHERE email = 'you@example.com';"
```

Log out and back in (JWTs carry the role at issue-time). From there, use
**Administration → Staff accounts** in the admin workspace (`/admin`) to create
`laundry_staff` and `administrator` accounts through the UI. Only a
`super_admin` can create accounts.

## Roles

| Role              | Can do                                                              |
|-------------------|----------------------------------------------------------------------|
| `customer`        | Place orders, track them, cancel before processing starts.          |
| `laundry_staff`   | Advance orders through washing/ironing/QC/ready stages; manage garment tags. |
| `administrator`   | Everything staff can, plus analytics, payments, inventory, expenses, zones, and capacity for their branch, and the price list, which is shared by all branches. |
| `super_admin`     | Everything an administrator can across all branches, plus branches, display currency rates, staff accounts, and the audit log. |

Laundry staff work in `/staff`; administrators and super admins work in `/admin`,
which shares the same tabs and adds a business overview. An admin can open `/staff`
to preview the staff view; changes made there are real. Hiding a page isn't
security, so the server enforces each of these role limits itself.

The **audit log** (`/admin?tab=audit`) records staff accounts created, branch and
price changes, voided invoices, and deleted expenses.

`laundry_staff` and `administrator` accounts belong to one branch. The server
applies that to single records as well as lists, so staff get a 403 on another
branch's orders, payments, invoices, garment tags, inventory, and expenses. In
the Customers directory they only see order activity from their own branch.
A staff account with no branch assigned is denied those single-record actions;
assign one instead of promoting a user straight to `administrator` in SQL.

## Pricing — Real Per-Item Price List

Pricing is itemized per garment/linen type (`laundry_items` table), not a
flat per-service rate — it mirrors the shop's actual physical price sheet
across 4 categories (Everyday Wear, Bedding & Linens, Towels & Household,
Formal & Traditional Wear). An order is a cart of `order_items` (item +
quantity), each snapshotting the item's price at order time. A handful of
items (e.g. Bathroom Mat, Wedding Dress Small) are range-priced — the
order uses the low end as an estimate, flagged `is_price_estimated`, with
the exact price confirmed at drop-off. Administrators and super admins manage
the whole catalog — names, categories, prices, ranges, new items,
activate/deactivate — from Admin → Pricing. Prices apply to every branch, and
orders already placed keep the price they were placed at.

The old `services` table (Washing Only / Ironing Only / Wash & Iron / Dry
Cleaning) still exists and powers the descriptive cards on the public
`/services` page, but no longer drives order pricing.

## Order Lifecycle (walk-in)

```
order_received → in_washing → ironing_process → quality_check
  → ready_for_pickup → completed
(order_received only) → cancelled
```

No pickup or delivery legs — `ready_for_pickup` means the order is ready
for the customer to collect in person at the shop. Each transition is
role-gated server-side (`server/config/orderLifecycle.js`) — the API
rejects any move a role isn't allowed to make, independent of what the UI
shows. Customers may cancel their own order themselves only while it's
still `order_received` (before processing starts).

`daily_capacity` still applies — it caps how many orders the shop accepts
per drop-off date (a processing-capacity limit), unrelated to pickup/delivery.

Once an order is received, staff assign a `pickup_date` (separate from
`drop_off_date`) telling the customer when it'll be ready to collect —
independent of the status transitions above, and updatable at any time
before the order is completed or cancelled.

`service_zones` is now purely informational — the list of areas customers
register from. It doesn't gate order creation in any way, since anyone
can walk in.

## Customer Profile Settings

Every account (`/settings`) can manage:

- **Username, full name, phone, area** — edited via `PATCH /api/auth/profile`.
  Usernames are auto-generated from the email at registration and are
  freely renameable afterwards (unique, 3–30 chars, letters/digits/`_`/`.`).
- **Profile picture** — POST /api/auth/profile/avatar accepts JPEG/PNG/WebP
  up to 2MB and checks file signatures before storage. Development uses local
  files under server/uploads/avatars/; production uploads to Cloudinary and
  stores the returned HTTPS URL. Configure CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env before
  enabling production avatar uploads. Before deploying existing local avatars,
  run npm run avatars:migrate from the server directory with Cloudinary set up.
- **Theme (light/dark)** — a real, working toggle (Tailwind `dark:` classes,
  `darkMode: 'class'`). Coverage is thorough on the navbar, footer, dashboard,
  and settings page; other pages inherit a sane dark background/text color
  but haven't each had a dedicated dark-mode pass.
- **Display currency** — GHS, USD, EUR, GBP, or NGN. The `currencies` table
  holds manually-set exchange rates against GHS (admin-editable via
  `PATCH /api/admin/currencies/:code`; there's no screen for this yet).
  Selecting a currency only changes how prices are *displayed* (Dashboard,
  Admin → Customers); every order is still created and charged in GHS —
  there's no live FX feed or multi-currency payment involved.
- **Language** — `preferred_language` is a real, saved preference, but
  translation coverage is intentionally partial: only the nav bar, footer,
  and settings page have English/Twi strings today (`client/src/lib/i18n.js`).
  The Twi strings are a best-effort machine translation, not reviewed by a
  native speaker — treat them as a starting point, not production copy, and
  have someone fluent check them before customers see them. Extending
  translation to the rest of the site means adding more keys to that file.

### Notification and account preferences

These `/settings` switches are enforced on the server. In-app notifications are
always written; the switches only control outbound email and SMS.

| Setting | Effect |
|---|---|
| `email_order_updates`, `sms_order_updates` | Order status and pickup-date messages, per channel. |
| `pickup_reminders` | The daily ready-for-pickup reminders. |
| `invoice_notifications` | Invoice messages and invoice reminders. |
| `low_stock_alerts` | The alert sent when an adjustment takes an item to or below its reorder threshold. It goes to that branch's administrators and all super admins. |
| `birthday_discount_enabled` | Whether an order gets the 5% birthday discount. Birthday greetings leave out the offer when it's off. |
| `auto_generate_invoice` | Creates an invoice as soon as an order is placed for this customer, including orders staff enter for them. |

Payment confirmations, balance reminders, admin messages, and birthday greetings
have no switch and are always sent.

## Admin Customer Directory

Staff → **Customers** (any staff role, same access as the order queue) lists
every customer with their order count and how many orders are sitting at
`ready_for_pickup`. Expanding a row calls `GET /api/admin/customers/:id` for
their full order history — drop-off date, items brought, assigned pickup
date, current status, and a picked-up/not-picked-up flag (`picked_up` is
just `status = 'completed'`).

## Payments

Customers can pay in person, with staff recording cash/Mobile Money/etc., or
use the optional Paystack online-payment flow. In-person payment has no
rigid schedule: a customer can pay a deposit at
drop-off and the balance whenever — before or after pickup — or pay the
full amount at either end. The `payments` table is a straightforward
ledger (amount, method, type, who recorded it, when); an order's
`amount_paid` and `balance_due` are always computed live from the sum of
its payments, never stored redundantly, so they can't drift out of sync.

- **Recording a payment** (Staff → Order Queue, any staff role, "Show
  payments" on an order) takes an amount, method (cash / Mobile Money /
  bank transfer / card / other), and a type (deposit / partial / balance /
  full / refund) purely for readability in reports — the running balance
  itself is computed from amounts alone. A regular payment can't push
  `amount_paid` past `total_price`; a refund can't exceed what's already
  been paid — both return a clear error instead of silently corrupting the
  balance.
- **Every order** — in the customer dashboard, the staff order queue, the
  admin Customers directory, and the printable receipt — shows a
  `payment_status` (`unpaid` / `partial` / `paid`) and balance due
  alongside the order status, computed by the same `ORDER_SELECT` fragment
  everywhere so it can't drift between views.
- **Admin → Payments** (admin-only) is the global transaction ledger
  across every order — filterable by date range, method, and type, with
  running Total Collected / Total Refunded figures.
- **Admin → Analytics** adds an **Outstanding Balance** figure — the sum
  of every non-cancelled order's unpaid balance right now — alongside
  revenue, expenses, and net profit.
- Marking an order `completed` does **not** require the balance to be
  zero — pickup and full payment are intentionally decoupled, matching
  how the shop actually operates. Staff just see the outstanding balance
  called out wherever the order appears, as a reminder rather than a gate.

## Sales Analytics, Inventory &amp; Expenses

Admin → **Analytics** (admin-only) breaks sales down at three granularities
— daily (last 30 days), monthly (last 12 months), and yearly (all-time) —
each showing revenue, order count, expenses, and net (revenue − expenses)
for that period, plus running totals and a low-stock alert banner.

Admin → **Inventory** (admin-only) tracks laundry essentials — detergent,
fabric softener, poly bags, hangers, etc. Each item has a
`quantity_on_hand` and a `reorder_threshold`; once quantity drops to or
below the threshold it's flagged low-stock (an amber badge on the item, a
banner on Analytics, and a `low_stock_count` in the analytics payload).
Stock changes go through **Adjust Stock** (+/-) rather than editing the
quantity directly, so every change is logged to `inventory_transactions`
with who made it and why — a running audit trail, not just a number. The
starter catalog seeds nine common essentials at quantity 0 (real counts
unknown) on the first branch — record actual stock on first use. Other branches
start with an empty list and add their own items.

Admin → **Expenses** (admin-only) is a simple ledger — category,
description, amount, date — for operating costs (utilities, supplies,
wages, rent, maintenance). It feeds directly into the Analytics net-profit
figures; there's no receipt/invoice attachment or approval workflow, just
a running record an admin can add to and delete from.

## API Overview

| Method | Route                              | Auth        | Description                                   |
|--------|-------------------------------------|-------------|------------------------------------------------|
| POST   | `/api/auth/register`               | Public      | Create a customer account, returns a JWT.      |
| POST   | `/api/auth/login`                  | Public      | Log in, returns a JWT.                         |
| GET    | `/api/auth/me`                     | User        | Fetch the authenticated user's profile.        |
| POST   | `/api/auth/forgot-password`        | Public      | Request a password reset link.                 |
| POST   | `/api/auth/reset-password`         | Public      | Reset password with a valid token.             |
| PATCH  | `/api/auth/profile`                | User        | Update username/name/phone/area/language/currency/theme. |
| POST   | `/api/auth/profile/avatar`         | User        | Upload/replace profile picture (multipart).    |
| GET    | `/api/currencies`                  | Public      | List active display currencies + rates.        |
| GET    | `/api/items`                       | Public      | List active laundry items with pricing.        |
| GET/POST | `/api/admin/items`               | Admin/Super admin | List all / create catalog items.               |
| PATCH  | `/api/admin/items/:id`             | Admin/Super admin | Update an item's name, category, price/range or active state. |
| GET    | `/api/services`                    | Public      | List descriptive service categories (marketing only). |
| GET    | `/api/zones`                       | Public      | List active customer areas (informational).    |
| GET    | `/api/capacity/check?date=`        | Public      | Check remaining capacity for a drop-off date.  |
| POST   | `/api/orders`                      | User        | Create an order (cart of items + drop-off date). |
| GET    | `/api/orders/user`                 | User        | List the authenticated user's orders.          |
| GET    | `/api/orders/:id`                  | User/Staff  | Fetch one order with its line items.           |
| GET    | `/api/orders/:id/history`          | User/Staff  | Status-change audit trail.                     |
| POST   | `/api/orders/:id/cancel`           | User        | Customer self-cancel (order_received only).    |
| POST   | `/api/orders/:id/receipt/send`     | User/Staff  | Email or text the receipt.                     |
| GET    | `/api/orders/:id/invoice`          | User/Staff  | The order's active invoice.                    |
| GET    | `/api/orders`                      | Staff       | Order queue, filterable by `status`/`mine`.    |
| POST   | `/api/admin/orders`                | Staff       | Record a walk-in order for a customer.         |
| PATCH  | `/api/admin/orders/:id`            | Staff       | Advance status (role-gated per transition).    |
| PATCH  | `/api/admin/orders/:id/pickup-date`| Staff       | Assign/update when the order will be ready.    |
| PATCH  | `/api/admin/orders/:id/storage-location` | Staff | Record where the order is stored.              |
| GET/POST | `/api/orders/:orderId/garments`  | Staff       | List/tag garments for an order.                |
| PATCH  | `/api/orders/garments/:id`         | Staff       | Update a garment tag's status/notes.           |
| GET/POST | `/api/admin/staff`               | Admin/Super admin | List (admin) / create staff accounts (super admin). |
| GET/POST/PATCH | `/api/admin/zones`           | Admin       | Manage customer areas (informational).         |
| GET/POST | `/api/admin/capacity`            | Admin       | Manage daily order caps.                       |
| GET/PATCH | `/api/admin/currencies`         | Admin/Super admin | List (admin) / edit display rates (super admin). |
| GET    | `/api/admin/customers`             | Staff       | List every customer, searchable, with order counts. |
| GET    | `/api/admin/customers/:id`         | Staff       | One customer's full profile + order history.   |
| GET/PATCH | `/api/notifications`             | User        | In-app notifications, mark as read.            |
| POST   | `/api/contact`                     | Public      | Submit a contact-form message.                 |
| GET    | `/api/contact`                     | Staff       | List contact-form submissions.                 |
| PATCH  | `/api/contact/:id/read`            | Staff       | Mark a submission as read.                     |
| GET    | `/api/admin/overview`              | Admin       | Admin landing page figures and sidebar badges. |
| GET    | `/api/admin/audit-log`             | Super admin | Latest 200 audit log entries.                  |
| GET    | `/api/admin/analytics`             | Admin       | Order volume; daily/monthly/yearly revenue, expenses &amp; net; status breakdown. |
| POST   | `/api/admin/reminders/run`         | Admin       | Manually trigger the daily pickup-reminder sweep. |
| GET    | `/api/orders/:id/payments`         | User/Staff  | An order's payment history (owner or staff only). |
| GET    | `/api/orders/user/payments`        | User        | All of the authenticated user's own payments.  |
| POST   | `/api/admin/orders/:id/payments`   | Staff       | Record a payment (deposit/partial/balance/full/refund/late_fee). |
| GET    | `/api/admin/payments`              | Admin       | Global transaction ledger, filterable by date/method/type. |
| GET/POST | `/api/admin/inventory`           | Admin       | List / create laundry-essential inventory items. |
| PATCH  | `/api/admin/inventory/:id`         | Admin       | Update an item's name/category/threshold/active state. |
| POST   | `/api/admin/inventory/:id/adjust`  | Admin       | Restock or use stock (logged to `inventory_transactions`). |
| GET    | `/api/admin/inventory/:id/transactions` | Admin  | Stock-change history for one item.             |
| GET/POST | `/api/admin/expenses`            | Admin       | List (filterable by date/category) / record an expense. |
| DELETE | `/api/admin/expenses/:id`          | Admin       | Remove an incorrectly-entered expense.         |
| POST   | `/api/admin/birthdays/run`         | Admin       | Manually trigger the birthday-greeting sweep.  |
| POST   | `/api/admin/balance-reminders/run` | Admin       | Manually trigger the balance-reminder sweep.   |
| POST   | `/api/admin/invoice-reminders/run` | Admin       | Manually trigger the invoice-reminder sweep.   |
| POST   | `/api/admin/messages`              | Admin       | Message one customer or all customers.         |
| POST   | `/api/paystack/initialize`         | User/Staff  | Start an online payment.                       |
| GET    | `/api/paystack/verify/:reference`  | User/Staff  | Confirm an online payment after redirect.      |
| POST   | `/api/paystack/webhook`            | Signature   | Paystack's payment confirmation callback.      |
| GET    | `/api/branches`                    | User        | List branches.                                 |
| GET/POST | `/api/admin/branches`            | Super admin | List/create branches.                          |
| PATCH  | `/api/admin/branches/:id`          | Super admin | Update a branch.                               |
| POST   | `/api/admin/orders/:id/invoice`    | Staff       | Generate an invoice from an order.             |
| POST   | `/api/admin/invoices/bulk`         | Staff       | Generate invoices for several orders.          |
| GET    | `/api/admin/invoices`              | Staff       | Invoice queue, filterable.                     |
| PATCH  | `/api/admin/invoices/:id`          | Staff       | Update due date/notes.                         |
| POST   | `/api/admin/invoices/:id/lines`    | Staff       | Add a discount, fee, or tax line.              |
| DELETE | `/api/admin/invoices/:id/lines/:lineId` | Staff  | Remove an adjustment line.                     |
| POST   | `/api/admin/invoices/:id/send`     | Staff       | Send the customer the invoice's pay link.      |
| DELETE | `/api/admin/invoices/:id`          | Admin       | Void an invoice with no payments.              |
| GET    | `/api/invoices/:id`                | User/Staff  | Fetch an invoice with its lines.               |
| GET    | `/api/invoices/:id/pdf`            | User/Staff  | Download the invoice PDF.                      |
| GET    | `/api/invoices/:id/activity`       | User/Staff  | Invoice activity history.                      |
| POST   | `/api/invoices/:id/activity`       | Staff       | Add a note to the invoice history.             |
| GET    | `/api/invoices/public/:token`      | Token       | View an invoice from its pay link, no login.   |
| POST   | `/api/invoices/public/:token/pay`  | Token       | Start an online payment from the pay link.     |
| GET    | `/api/invoices/public/:token/verify/:reference` | Token | Confirm a pay-link payment.          |

## Notifications

`server/services/notify.js` writes an in-app notification on every order
status change, and attempts email/SMS. Email/SMS are real (Nodemailer /
Twilio) but no-op with a console log until you set `SMTP_*` / `TWILIO_*`
in `server/.env` — see `.env.example` for the full list.

## Late Pickup Fee Policy

Pickup is free for the first 7 days after an order is marked
`ready_for_pickup`. After that, a flat GHS 5/day storage fee accrues
(`server/utils/lateFee.js` — `FREE_PICKUP_DAYS`, `LATE_FEE_PER_DAY`). The
fee is computed live from `order_events` timestamps (frozen as of
`completed_at` once picked up) and returned as `late_fee`/`days_overdue` on
every order response — it is **not** added to `total_price`; staff collect
it in person, same as the rest of this walk-in shop's payments.

Staff record the money under Show payments with the **Storage Fee** type, up to
the amount still due (`late_fee_due`). These `late_fee` payments count towards
Total Collected in Admin → Payments, but they don't reduce `balance_due` or
appear in Analytics revenue, which is based on order totals.

The separate worker schedules this reminder for 9:00am in Africa/Accra and emails/texts customers whose orders are
still `ready_for_pickup`: a gentle nudge on day 3, then a reminder with the
accrued fee every 7 days once overdue. `POST /api/admin/reminders/run` fires
the same sweep on demand. `orders.last_reminder_sent_at` prevents double-
sends if the job ever runs twice in a day.

Alongside the storage fee, the shop's [Terms of Service](client/src/pages/TermsOfServicePage.jsx)
and printable [receipt](client/src/pages/ReceiptPage.jsx) both state plainly
that the business is not responsible for items left uncollected beyond that
same 7-day window — a liability boundary, not just a fee.

## Security

- Passwords are hashed with `bcryptjs` (10 salt rounds); sessions are
  short-lived JWTs (7 days) carrying `id`/`role`, verified on every request
  by `server/middleware/auth.js`.
- All database access goes through parameterized `pg` queries — no string-built
  SQL, so there's no SQL-injection surface.
- Role-based access control (`requireAuth`/`requireStaff`/`requireAdmin`) gates
  every staff/admin route server-side, independent of what the UI shows.
- `helmet()` sets standard security headers (including a default CSP) on
  every response; `express-rate-limit` caps general API traffic (300
  req/15min) and applies a tighter limit (10 req/15min) to
  `/api/auth/register|login|forgot-password|reset-password` to slow down
  credential-guessing and account enumeration.
- The JWT is kept in `localStorage` (not an httpOnly cookie) for simplicity —
  this means it's readable by any script that runs on the page, so the CSP
  from `helmet` is the main defense against token theft via injected script.
  If that trade-off ever needs revisiting, moving to an httpOnly cookie would
  require adding CSRF protection alongside it.
- **HTTPS is not handled by this app** — it's a deployment concern. Whatever
  serves this in production (a reverse proxy like Nginx, or a host with
  managed TLS like Render/Railway/Fly) must terminate TLS in front of it;
  `app.set('trust proxy', 1)` in `server.js` assumes exactly that setup.

## Backups

The database is the source of truth; back it up regularly:

```
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -d mums_love_laundry -F c -f mums_love_laundry_$(date +%Y%m%d).dump
```

Restore with:

```
"C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -U postgres -h 127.0.0.1 -d mums_love_laundry --clean mums_love_laundry_YYYYMMDD.dump
```

A daily dump (e.g. via Windows Task Scheduler) kept for at least 30 days is a
reasonable starting point. Development avatars in server/uploads/avatars/ are
not covered by database backups; include that folder in local backups. Production
avatars are stored in Cloudinary and are managed separately from PostgreSQL backups.

## Roadmap

- **v1.0**: Supabase-backed MVP.
- **v2.0**: local PostgreSQL + JWT auth, Tailwind UI overhaul, booking
  wizard, dashboard progress tracker.
- **v3.0**: expanded order lifecycle, staff roles, capacity, garment
  tagging, notification scaffolding, staff dashboard.
- **v4.0**: itemized per-garment price list replacing flat service pricing.
- **v5.0**: walk-in drop-off model — removed pickup/delivery from the
  lifecycle, roles, and booking flow to match how the shop actually
  operates today.
- **v6.0**: staff-assigned pickup date — a separate date, set once the
  order is received, telling the customer when it'll be ready to collect.
- **v7.0**: customer profile settings (username, avatar upload,
  language, theme, display currency) and an admin Customers directory with
  full per-customer order/pickup history.
- **v8.0**: security hardening (`helmet`, rate limiting on auth
  endpoints), SEO metadata on public pages, a real Contact-form → staff
  Messages channel, an admin Analytics tab, printable order receipts,
  Privacy Policy/Terms of Service pages, and an initial smoke-test suite
  (Vitest) on both server and client.
- **v9.0**: late-pickup storage fee policy (GHS 5/day after 7
  free days) surfaced live on orders/receipts, a daily email+SMS
  pickup-reminder job, real SMS wired up on every existing order
  notification, and a Framer Motion pass for more dynamic/animated widgets.
- **v10.0**: daily/monthly/yearly sales analytics with expenses
  and net profit, a laundry-essentials inventory tracker with low-stock
  alerts and an audit-logged stock-adjustment flow, an operating-expense
  ledger, and an explicit "not responsible for items after 7 days"
  liability clause on the Terms of Service and printable receipts.
- **v11.0**: payment ledger — deposits, partial/full payments, and refunds,
  with live balances across customer and staff views.
- **v12.0**: birthday greetings and birthday-order discounts.
- **v13.0**: optional Paystack online payments and order storage-location
  tracking at the shop.
- **v14.0**: reminders for orders with an outstanding balance, independent
  of pickup reminders.
- **v15.0**: invoices with frozen line items, adjustments, PDFs, public
  payment links, activity history, and due-date reminders.
- **v16.0**: multi-branch support, with branch assignment and branch-scoped
  staff operations and records.
- **v17.0**: account preferences for notification categories, birthday
  discounts, and automatic invoice generation.
- **v18.0**: enforces those preferences and branch access on single records,
  adds low-stock alerts, and records storage-fee payments.
- **v19.0 (current workspace)**: assigns inventory items and expenses that had
  no branch to the first branch, and makes a branch required on both.
- **Future**: automated Mobile Money collection beyond the current Paystack
  integration, loyalty tracking, full site translation beyond nav/footer/
  settings, live FX rates for display currency, and per-item cost-based
  inventory valuation (unit_cost exists but is not surfaced yet).