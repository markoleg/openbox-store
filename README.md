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
