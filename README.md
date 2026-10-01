# 🛍️ OPENBOX-STORE

A modern dashboard built using **Next.js 15** (App Router) on top of a shared **PostgreSQL** database used by the backend parser.

---

## ⚡ Key Features

- 🔄 **Live updates** of parsed items via **Supabase Realtime**.
- 🔍 **Display of search parameters** and their corresponding items.
- 🙌 Ability to **hide** or **like** items without reloading the page.
- 🚨 Dashboard **automatically reflects**:
  - new items,
  - price changes,
  - status updates (hidden, liked),
  - all **without user intervention**.

---

## 🚀 Technologies Used

- **Next.js 15** App Router
- **TypeScript** + CSS
- **Supabase**:
  - Realtime Channels for reactive UI updates
  - PostgreSQL for persistent storage
- **React Server Components** + Client Components (`useEffect`, `useTransition`, etc.)
- **React Toastify** for real-time user feedback

---

## 🧠 Architecture Highlights

- 💡 **Reactive Context API**:
  - `ItemsProvider`, `useItems` & `useItemsLoading` custom hooks.
  - Ensures components auto-update when data changes in Supabase
- 🧾 **Search Form**:
  - Built with **server actions** and `FormData`
  - Securely stores and updates search parameters
- 🗑️ **Item Deletion & Updates**:
  - Handled via **server actions**
  - No need for client-side mutation logic

---

🔗 GitHub Repository: [markoleg/openbox-store](https://github.com/markoleg/openbox-store)

## Environment

- `PASSWORD` — existing owner password (server-only).
- `PASSWORD_COOKIE_NAME` — existing cookie name (letters/digits/underscore/hyphen).
- `OWNER_SESSION_SECRET` — **new, required before deploying phase 1**: a random
  server-only signing secret of at least 32 characters, preferably 32 random bytes
  encoded as base64. Do not use a `NEXT_PUBLIC_` variable or commit it.
  Without this configuration login fails closed. Old `true` cookies are rejected;
  the owner must sign in again after deployment. Rotating the secret invalidates
  all signed sessions. Login sets a signed, expiring HttpOnly cookie; logout is a
  same-origin POST that clears it. Clearing a stateless cookie does not revoke a
  separately copied token; rotate the secret if a session is compromised.

New review server routes/actions must call `lib/server/owner.ts` before accessing
private history. Middleware alone does not authorize API routes. Telegram continues
to use its existing separate webhook authentication and sniper ACK branch. Migration 010 revokes legacy browser writes; current operational tables and
RPCs deny anonymous/authenticated roles.

Validation: `npm run test:session` (Node 22.18+ or 24), `npm run build`.
For HTTP auth smoke tests, start a **local-only** server on `127.0.0.1:3217`
with `PASSWORD=local-smoke-password`, `PASSWORD_COOKIE_NAME=local_smoke_owner`,
and a disposable `OWNER_SESSION_SECRET` of at least 32 characters, then run
`node tests/authSmoke.mjs`. These tests never use real credentials or procurement
mutation endpoints; do not use their dummy configuration in production.

- `ITEM_PRESENCE_GRACE_SECONDS` — must match the tracker setting (default:
  `300`). It is passed to the transactional search-deletion RPC when choosing
  an active replacement owner for a listing.

- `NEXT_PUBLIC_REVIEW_PIPELINE_ENABLED` — no longer read. Since phase 3b the
  catalog toasts come only from `notification_toasts` (tracker events after stock
  preflight); the old INSERT/UPDATE `items` toasts are gone. With the tracker's
  pipeline disabled there are no toasts at all.

## Zhezhemon notification processing

Requires tracker migrations **025 → 026 → 027**, after the existing 001–024
schema. Coordinate both consumers with writers paused and a verified backup;
027 deletes assessment data and the reaction journal. See the tracker
`docs/STAGE1_ROLLOUT.md` for deployment order and restore instructions.

`/zhezhemon/processing` is one queue of confirmed main notifications: new only,
two columns on desktop and one on mobile. `/zhezhemon/processed` is the editable
processed journal. Additional Sniper deliveries are excluded. Results are bought
(ERP only), missed (no reasons), funds, bug (note required), hidden, paused and
banned. Opening, liking or watching a listing does not process its card. Pause
supports 1/3/5/7 days. Live hide/pause and search-specific ban compose independently.

The server keeps pinned delivery snapshots, historical stock, sanitized seller
HTML, photos and part numbers. Main card IDs are stable event IDs. Legacy links
resolve the original dispatch/delivery; they never guess the latest card.
Part-number edits still use the private version-checked owner API.

The ERP integration treats parser `purchased_at` as email time, approximately
30–40 minutes after checkout. The preceding 60-minute window plus its previous
main notification, bounded by 72 hours, determines possible cards. A single
candidate can be assigned approximately; several candidates stay new until the
owner assigns an existing ERP fact in the panel. Multiple purchases per card
are supported. Trusted pending purchase drafts show bought with a draft label;
promotion keeps identity. Unknown quantities stay unknown. Purchase counts do
not infer remaining listing stock. Cancellation restores the underlying manual
result, or returns the card to new. Legacy manual bought is labeled separately.

All writes use signed owner-session, same-origin APIs and
`REVIEW_COMMANDS_ENABLED=true` (exact string, no trailing whitespace). Telegram
commands additionally require the webhook secret and allowlisted buyer identity.
Do not expose service-role keys in public environment variables. Anonymous and
authenticated browser database roles cannot write operational state. Commands
and purchase assignments check both current versions and command idempotency.
The new queue polls every 30 seconds while visible, and refreshes on returning
to the tab. The processed journal retains private Realtime invalidation. Both
preserve loaded pages and unsaved panel text; the toolbar shows loading without
moving the cards. Durable ERP keyboard jobs use current state before sending.
Sniper ACK and call cancellation remain separate from processing decisions.

Inactive assessment form/route/contracts live as text in
`archive/listing-assessment`; delete that directory independently if the project
closes. Assessment/reporting routes and reaction-history components are removed.

Validation: `npm run test:review`, `npm run test:session`,
`npm run test:dependencies`, `npm run test:boards`, `npm run build`.
`tests/integration/reviewFlow.spec.ts` is exercised by the tracker's opt-in
real PostgreSQL/PostgREST integration fixture. Never run that fixture alongside
a Next build/dev server using this same checkout. Local fixtures use dummy keys
and block external browser assets; hosted Supabase Realtime transport needs a
separate release acceptance check.
