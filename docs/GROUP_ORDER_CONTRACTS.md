# Group Order contracts — 20 November 2026

Primary `/` → `/group/:sessionId`. Independent ShopeeFood integration concept, all catalog/costs synthetic, no platform calls/order/payment. Legacy `/line`, `/web`, `/s` preserved.

Create existing `POST /api/sessions` with `{hostName,areaId:'bangkok_demo',mode:'delivery',expectedSize:4,experience:'group_order'}`. Host is selected but NOT opted in. New group members become selected, NOT opted in. Everyone must personally join and confirm. Cap remains five; expectedSize is a hint, not a gate.

Existing `GET /api/sessions/:id` returns SessionView plus `experience:'group_order'`, optional persistent `handoff: CartHandoff` (types in src/contracts/group-order.ts). Private canonical preferences are own-only. Public result projection strips constraintEvidence and uses generic no-match reason families without member/menu attribution for this experience.

New `POST /api/sessions/:id/meal`: `{action:'join',expectedPreferenceVersion,expectedRosterVersion}` self-only; or host-only `{action:'configure',selectedMemberIds,areaId:'bangkok_demo',expectedPreferenceVersion,expectedRosterVersion}`. Configure atomically reopens and sets selected roster, delivery-only zone, increments P/R, invalidates old ranking/votes/handoff; retains opted-in/confirmed retained members, new selected members must consent. Opening/cancelling UI setup does not mutate. Nonresponders cannot silently be dropped.

Use existing preferences/me, rank, acceptance/me, finalize routes with their existing contracts. Confirm is own-only. Rank/finalize host-only. Choice payload = `{rankingId,restaurantId,expectedPreferenceVersion,expectedRosterVersion}`. Finalize means unanimous decision, NOT ordering. Finalized edits require explicit host reopen/configure.

New `POST /api/sessions/:id/handoff`: Choice payload; host-only; requires finalized current unanimous decision, delivery, same P/R/ranking/catalog/algorithm, transactional deterministic revalidation, all costs known and exact. Returns SessionView. Same current decision with any key yields same handoff ID/items. Unknown cost rejects, never estimates.

New `POST /api/sessions/:id/checkout`: Choice payload + `handoffId`; host-only; exact current cart required. Sets handoff.status='checkout_summary' with one checkoutAt. Does NOT create any order/payment/order number. Repeated same snapshot returns same summary. Every mutation requires existing actor-scoped Idempotency-Key; stale replays fail before returning a usable cart. Central invalidation marks persistent handoff invalidated; UI never offers checkout for it.

Cart stores immutable one-item/member snapshot, fees, subtotal/fee/total integer satang, P/R/catalog/algorithm/ranking, timestamps. Authoritative aggregate + SQL cart_handoffs projection in same transaction, migration004. No SDK, private APIs, live discovery or simulated claims of AI. Core scoring unchanged fit-60-40-v1.

Ownership: root contracts/server/database/migration/integration; A new delivery UI routes/components/styles only; C new group-order integration/E2E tests only; B README/master/demo docs only. No package/lockfile changes needed. AI_PIPELINE_PLAN.md is user-owned and out of scope.
