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

- `NEXT_PUBLIC_REVIEW_PIPELINE_ENABLED` — no longer read. Since phase 3b the
  catalog toasts come only from `notification_toasts` (tracker events after stock
  preflight); the old INSERT/UPDATE `items` toasts are gone. With the tracker's
  pipeline disabled there are no toasts at all.

## Review command API — phases 3a/3b

Every buyer write in the dashboard now goes through the command core. The
browser Supabase key can only read (catalog, Sniper list, realtime); migration
010 in the tracker repository revokes its writes. Leave `REVIEW_COMMANDS_ENABLED`
unset/false in production until the coordinated cutover; while it is off, the
buttons report "Команди вимкнені" and never fall back to direct writes.

Server configuration (server-only, never `NEXT_PUBLIC_`):

- `SUPABASE_SERVICE_ROLE_KEY` — the review client, created only after
  authentication and the feature gate.
- `REVIEW_COMMANDS_ENABLED=true` — enables `/api/review/*`, the Telegram review
  callbacks and the search/Sniper commands.
- `TELEGRAM_ALLOWED_USER_IDS` — comma-separated Telegram user ids allowed to
  press procurement buttons (new `rv:` buttons and legacy `zb:`/`zh:`). Empty
  means nobody: the webhook answers "Немає доступу". The sniper ACK and
  ShopParser buttons are not affected.
- `BOT_TOKEN` — also used to edit keyboards after dashboard commands.

Routes and actions:

- `POST /api/review/contexts` — `{kind: "delivery" | "event" | "listing" |
  "dispatch", target, searchId?, register?}`. `dispatch` is what Telegram URL
  buttons carry (resolved to the confirmed delivery, else the event);
  `searchId` scopes a listing ban/unban; `register` lets Sniper add a link the
  tracker has never seen.
- `POST /api/review/commands` — `{commandId, contextId, action, payload,
  source?}` with `source` `dashboard` (default) or `dashboard_toast`. After an
  applied command on an event/delivery context the origin message and its
  main-chat siblings are re-rendered from the server projection; a failed edit
  becomes a durable `telegram_ui_sync` job for the tracker.
- `POST /api/review/searches` — search configuration save: `{commandId,
  searchId, expectedVersion, config, ban, unban}`. Deltas only; a version
  conflict returns the current state instead of overwriting a Telegram ban.
- Server actions `addSearch` / `deleteSearch` use the audited create/delete RPCs.
- `/api/hideItem` and `/api/banItem` (old GET links) no longer change anything:
  they redirect to `/zhezhemon/confirm`, which applies the command with a POST.
- `/zhezhemon/history?dispatch=|delivery=|event=|link=` — the persistent card:
  messages, reactions, live state, manual outcome / correction / clear form for
  an exact message context. Stage 5 redirects confirmed deliveries into the
  board panel; event-only technical history remains here.
- `/sniper?link=&hint=&ctx=` — Save/⚡/🗑 are `set_watch`/`remove_watch`
  commands; with `ctx` a Save is a reaction to that exact message, and editing
  the link to another listing drops the binding visibly.

Telegram webhook: secret → `rv:` parse → buyer allowlist → the pressed message
must be the recorded delivery of the dispatch on the button (an `unknown` send is
reconciled by that proof) → command id derived from `callback_query.id` (a
redelivered callback is the same fact) → the RPC's context/version checks →
keyboard re-rendered from `review_delivery_view`. Menu buttons (Пауза…, Не
встиг, Ще…, Змінити результат, Назад) change nothing. Conflicts are shown as
alerts, never as success. Legacy `zb:`/`zh:` buttons apply `legacy_telegram`
commands on the listing (delivery unknown); their keyboard changes only on success.

`npm run test:review` checks the wire contract and keyboard rendering;
`npm run test:session` the owner session. `tests/authSmoke.mjs` (local server
with the dummy variables above, `REVIEW_COMMANDS_ENABLED=false`,
`TELEGRAM_WEBHOOK_SECRET=local-smoke-webhook`, empty `BOT_TOKEN` and
`TELEGRAM_ALLOWED_USER_IDS`) checks auth/origin/feature gates of the three
review routes, the legacy redirects and the webhook gates without running a
command or contacting Telegram.

## Processing boards — stage 5 (local, not deployed)

Requires tracker migration `011_review_boards.sql` after 006–010. The existing
`REVIEW_COMMANDS_ENABLED` gate and signed owner session protect all new APIs;
no flags or production migrations are changed by building this repository.

- ZheZhemon horizontal navigation: **Оголошення / Опрацювання / Не надіслано**.
  `ItemsProvider` and notification toasts remain mounted; the catalog aside is
  only rendered for `/zhezhemon` and `/zhezhemon/<searchId>`.
- `/zhezhemon/processing?tab=review|notifications`: one page, two boards.
  `review=<uuid>` or `delivery=<uuid>` opens the persistent card directly.
  Each tab stores its filters in URL keys prefixed with `review.` or
  `notifications.`. Cursor pagination loads 50 rows per column; counts cover
  the complete filtered set. Background refresh is every 30 seconds while the
  page is visible, plus window focus; it does not fetch eBay or reload raw details.
- The card panel is full-screen on mobile. Snapshot data and the current live
  state are separate. Raw seller HTML is escaped text, never injected as HTML.
  Photographs use the pinned eBay source URLs with an explicit unavailable state.
  Own storage/serving is optional; it is not required for this release.
- Six scores 1–5 and explanations, explicit draft save, submission, optional
  photo notes keyed by snapshot source URL, and explicit revision with a reason.
  No background getItem. Missing source data prevents submission, not draft save.
  Version conflicts retain the local form; an uncertain transport response has
  a retry button using the same command UUID. Submitted snapshots and decisions
  stay frozen; previous versions are immutable.
- `/zhezhemon/history?link=…` offers **Про оголошення загалом** separately from
  choosing a particular notification. A general result updates the training
  draft but never resolves a delivery or invents Telegram reaction timing.
- `/zhezhemon/not-sent`: paginated technical dispatch log, including unknown,
  failed, suppressed, cancelled and pending states. No resend controls.
- `GET /api/review/boards` serves private lightweight board projections or a
  separately requested card. `POST /api/review/assessments` accepts only a
  command UUID, review UUID, expected version, action and validated fields.

Checks: `npm run test:review`, `npm run test:session`, `npx tsc --noEmit`,
`npm run build`. Browser checks: `npx playwright install chromium`, then
`npm run test:boards`. Playwright starts its own localhost:3217 dev server with
dummy credentials and no production database/Telegram access. UI data is mocked;
auth/origin/disabled-gate requests hit real local routes. PostgreSQL integration
tests for the RPCs live in the tracker repository. Screenshots/test artifacts
are kept under ignored `node_modules/.cache/`.

The card's delivery preview contains up to 100 rows; the complete selection is
available via the board's link filter. Assessment decision choices include the
recent 200 reactions plus the exact frozen decision even if older. The separate
reaction journal now paginates through all older rows (stage 6a below).

## Reporting and training exports — stage 6a (local, not deployed)

Requires tracker migration `012_review_reporting.sql`. On the same processing
page, below the active tab's filters, expandable **Аналітика сповіщень** covers
the full operational selection; **Експорт навчальних оцінок** exports eligible
completed training reviews. There is no third board or separate app.

`GET /api/review/reporting?report=statistics|history|export` uses the owner
session and rollout flag; `POST /api/review/reporting` additionally requires
same-origin. The `report` selector is separate from the event `kind` filter.
The statistics period means delivery send time, with current outcomes and
calendar reaction/first-decision timings. General listing actions, shared
closures and event-context closures are not fabricated direct responses.

Export POST accepts `{id: UUID, query: "tab=review&…filters"}` and freezes a
24-hour manifest. GET pages use `id` and exclusive ordinal `after`. The client
checks stable manifest, ordinals, count and completion before downloading JSONL
(manifest → training examples → complete footer). Retry reuses the manifest;
**Новий зріз** creates a fresh one. Filter/tab changes cancel the current fetch.
The browser caps downloads at 100 MiB; a larger or incomplete export is never
silently saved as complete. Narrow filters for larger sets. Only photo URL/hash/
archive status is exported, not photo bytes. Late archive timing is explicit.
Own photo storage/serving is an optional future feature, not a release gate.
The baseline is URL-only; `url_only` entries do not need a hash to be exported.

`npm run test:review` includes export-integrity contracts. `npm run test:boards`
also verifies statistics filters, a two-page JSONL download, history pagination
and real auth/origin/flag gates. UI data remains mocked; SQL integration tests
run against real isolated PostgreSQL in the tracker repository.
Do not push: push triggers deployment.

## URL-only photos and real local integration — stage 6b

The card renders saved eBay URLs with an explicit failure state and a source
link. It does not promise immutable remote bytes or show optional-storage absence
as an archive error. `snapshot_photos` URL/order and photo notes remain useful;
tracker migration 013 distinguishes new URL-only entries from legacy archive jobs.
Migration 014 fixes nested snapshot search names, preserving them after edits or
deletion. A search with no title is shown by ID, not falsely marked as deleted.

`playwright.integration.config.ts` is separate from the mocked UI suite. Start
it through `zhezhemon/tests/test_dashboard_integration.py` (see tracker README).
It uses real Next routes, real PostgREST with dummy role JWTs and an isolated
PostgreSQL fixture, plus a transparent URL-prefix proxy. There are no mocked
database/API responses. Browser external requests are blocked; Telegram is
disabled. This checks real login, permissions, card data/search corridor,
outcome, six-score submission, statistics, JSONL and concurrent revision fences.
It does not replace hosted Supabase/Realtime or production smoke checks.
Do not run concurrently with another build/dev/Playwright suite in this checkout.

## Dependency security checkpoint — 2026-09-12

Next stays on 15.x (`15.5.25`) and Supabase stays on 2.x (`2.50.5`, with
auth-js 2.70.0). These direct versions are pinned for a reviewed upgrade, not
automatically moved to the latest SDK with a different Node requirement.
`package-lock.json` also resolves lodash 4.18.1 and ws 8.21.3 within their
parents' supported ranges. Install reproducibly with `npm ci`; do not discard
the lockfile or run a blanket `npm audit fix --force`.

Two overrides are scoped to Next: PostCSS 8.5.28 and sharp 0.35.4. Next 15.5.25
still pins old PostCSS and allows the older sharp branch, so updating Next alone
does not ensure patched transitive packages. Revisit/remove these overrides when
Next's own dependencies resolve patched implementations. On this checkpoint,
`npm audit --json` reports zero known vulnerabilities; this is not a complete
security assessment or a guarantee about future advisories.

Realtime channels are owned per effect via `ownedRealtimeChannel`: independent
catalog/sidebar consumers and Strict Mode remounts get distinct topics and clean
up only their own listeners. Table/event filters and notification behavior are
unchanged. Do not use the initial 2.50.0 candidate: its realtime-js 2.11.10 can
remove unrelated channels during cleanup; 2.50.5 includes realtime-js 2.11.15.
The local socket test checks that a sibling remains joined after one is removed.

The sharp update requires Node >=20.9.0. Local checks use Node 24.14.0, including
its native TypeScript support for the existing Node test setup. Production Node must
be checked before rollout; this change does not alter Vercel/project runtime
settings, environment variables, deployment flags or database permissions.

`npm run test:dependencies` tests the actual resolved Next PostCSS/sharp and
Supabase/ws dependencies: CSS transformation/source-map chaining, in-memory
JPEG/PNG resizing to WebP, and Realtime join/postgres-payload/unsubscribe using
a loopback protocol peer. That peer is **not** hosted Realtime or a real database
change feed. The browser suite also checks the real Next image optimizer with
a local placeholder and renders the existing Recharts graph with fixture data.
Run review/session tests, TypeScript, build, browser tests, and the separate
tracker real-PostgREST integration test after changing these dependencies.

Verified on this checkpoint: 41 Node tests (29 review + 9 session + 3 dependency),
13 browser scenarios, TypeScript, production build, and the real local
PostgREST/PG browser scenario. `tests/authSmoke.mjs` now also includes boards,
assessments and reporting gates, but its separate run against `next start` was
not completed: the execution tool rejected starting that extra server. The
successful browser/API tests above used Next dev, not production-serving mode.
That historical limitation was resolved on 2026-09-15: the owner ran the local
`next start` / `tests/authSmoke.mjs` procedure and supplied the successful result
for session, origin, protected page, review API gates, legacy redirects, webhook
gates and logout. A fresh production build and all 41 Node tests also passed.

## Production review cutover — 2026-09-15

Migrations 006–014 were applied in the tracker database after a verified fresh
backup and stopping the old sender. The initial dashboard deployment was made
with `REVIEW_COMMANDS_ENABLED=false`; hosted signed login/logout and disabled
API gates passed. The new tracker then started all 37 searches with its shared
budget enabled, safety 5%, reserve 150, and URL-only photos on one 256 MiB VM.
Search intervals were not changed.

The final command-enable deployment is triggered by the GitHub push containing
this documentation update. Validate owner-only reads of both boards/reporting
and actual deliveries before ending the buyer maintenance window. This is not
a claim that production procurement mutations or Telegram callbacks were
synthetically executed. Keep the per-step deployment/backup evidence and final
acceptance status in the tracker repository's gitignored unified plan.

Feature flags use exact string comparison: `REVIEW_COMMANDS_ENABLED` must be
exactly `true` or `false`, without a trailing CR/LF. PowerShell's string pipeline
adds a newline when supplying a value to `vercel env add`; use stdin bytes with
no newline or the provider's value editor. The runtime correctly fails closed
for `true` followed by whitespace. Changed provider env requires a new deployment.

## Historical quantity on review boards (local follow-up)

Before deploying this dashboard change, apply tracker migration
`015_review_stock_projection.sql` through the coordinated release process. It
adds private snapshot ID/time/availability evidence to the board projection;
it does not rewrite deliveries, reviews or snapshots. Do not rerun 006–014.

Follow it with `016_delivered_review_eligibility.sql` before deploying the new
tracker. Any delivered condition-1000 link can then receive its one assessment,
including legacy/manual links; repeats never reset an existing assessment.
016 also backfills missing cards from recorded deliveries without resending or
deleting history. The history page no longer interprets the old registration-time
`training_eligible` flag as current eligibility. Apply both migrations only as
part of the separately approved release, with backup and producer coordination.

Both tiles and card details use that same historical snapshot, not the latest
listing state. The server returns only a compact quantity and observation time
to tiles (no raw getItem response); detail views retain the original evidence.
Missing/unverified quantities display «Кількість невідома». Thresholds such as
MORE_THAN are displayed as «понад 10 шт.». No eBay call is made by board reads.

## Compact ZheZhemon workspace (local UI follow-up)

At 1024px and wider, section navigation lives in the main header; below that it
uses one compact row beneath it. Both placements share one route definition and
only appear inside ZheZhemon. The catalogue search list and item pane scroll
independently on desktop. The mobile search panel reserves the navigation and
bottom-toggle space.

Processing keeps its tabs, filter toggle, refresh and export together. Filters
start collapsed, show an active count and retain their independent URL values.
Export help/new snapshot live in a keyboard/touch-accessible native popover;
retry retains the same export ID, with existing completeness and size checks.
Desktop columns fill the remaining viewport and scroll independently. Expanded
filters/analytics have a bounded scroller while tabs/actions remain available.
Mobile columns retain 65dvh height and horizontal swiping. Card details scroll
below a fixed header; draft/conflict checks, focus return and close confirmation
remain in place. This change does not replace polling yet; private realtime is
the next stage. No new dependencies, API calls or rollout flags are required.
