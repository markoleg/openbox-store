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
to use its existing separate webhook authentication and sniper ACK branch. The old
anon-writable tables and legacy mutation routes are still scheduled for the command
migration; signed login does not itself secure those database paths.

Validation: `npm run test:session` (Node 22.18+ or 24), `npm run build`.
For HTTP auth smoke tests, start a **local-only** server on `127.0.0.1:3217`
with `PASSWORD=local-smoke-password`, `PASSWORD_COOKIE_NAME=local_smoke_owner`,
and a disposable `OWNER_SESSION_SECRET` of at least 32 characters, then run
`node tests/authSmoke.mjs`. These tests never use real credentials or procurement
mutation endpoints; do not use their dummy configuration in production.

- `ITEM_PRESENCE_GRACE_SECONDS` — must match the tracker setting (default:
  `300`). It is passed to the transactional search-deletion RPC when choosing
  an active replacement owner for a listing.

- `NEXT_PUBLIC_REVIEW_PIPELINE_ENABLED` — phase-2 rollout gate, default off.
  Build with `true` **before** enabling the new tracker notification pipeline.
  While enabled, `ItemsProvider` still updates catalog data in realtime but does
  not produce the old INSERT/UPDATE toasts or sounds: these happen before getItem
  and could announce an out-of-stock listing. Event-based contextual toasts are
  part of phase 3, not implemented by this gate. This is a build-time variable;
  changing it without rebuilding will not affect the browser bundle. The two
  kanbans/navigation also remain a later phase. No production flags were changed.

## Review command API — phase 3a

This backend foundation is **not yet wired to the catalog, Telegram, Sniper or
SearchForm buttons**. Leave `REVIEW_COMMANDS_ENABLED` unset/false in production.
Before controlled activation, apply tracker migrations 005–009 and configure
`SUPABASE_SERVICE_ROLE_KEY` as a server-only secret (never `NEXT_PUBLIC_`). The
server client is created only after authentication and the feature gate.

- `POST /api/review/contexts` takes `{kind: "delivery" | "event" | "listing", target}`
  and returns a pinned snapshot/context ID, observation time, scope and versions.
  A listing target must already exist; it is not bound to the latest message.
- `POST /api/review/commands` takes `{commandId, contextId, action, payload}`.
  Reuse the UUID commandId only for a retry of that same request. After a conflict,
  fetch/display current context and ask for a new explicit decision, not an automatic
  replay against changed state. Successful commands also require refreshing context
  before the next versioned decision.
- Both routes independently verify the signed owner session, require the public
  same-origin Host/Origin, validate payloads and fail closed when disabled or missing
  server configuration. Actor/source/time are not accepted from the browser.
  Database deadlock retries use the same command ID and perform no external send.

`npm run test:review` checks the pure wire contract; `npm run test:session` checks
the owner session. The local `tests/authSmoke.mjs` now checks review-route auth,
forged-cookie, Origin and disabled-feature gates as well. Run that server with
`REVIEW_COMMANDS_ENABLED=false` plus the dummy auth variables above; the smoke test
does not execute procurement commands or contact eBay/Telegram.

Remaining phase 3 work: connect all buttons to this service, add watch/search
commands and Telegram context authorization/reconciliation, then remove old direct
mutations and complete event-based toast/UI synchronization. The sniper ACK and
ShopParser branches are unchanged. Do not interpret these new routes as a completed
security cutover of the old endpoints or public database tables.
