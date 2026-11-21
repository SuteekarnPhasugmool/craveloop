# Group Order contracts — 20 November 2026

Primary `/` → `/group/:sessionId`. Independent ShopeeFood integration concept, all catalog/costs synthetic, no platform calls/order/payment. Legacy `/line`, `/web`, `/s` preserved.

Create existing `POST /api/sessions` with `{hostName,areaId:'bangkok_demo',mode:'delivery',expectedSize:4,experience:'group_order'}`. Host is selected but NOT opted in. New group members become selected, NOT opted in. Everyone must personally join and confirm. Cap remains five; expectedSize is a hint, not a gate.

Existing `GET /api/sessions/:id` returns SessionView plus `experience:'group_order'`, optional persistent `handoff: CartHandoff` (types in src/contracts/group-order.ts). Private canonical preferences are own-only. Public result projection strips constraintEvidence and uses generic no-match reason families without member/menu attribution for this experience.

New `POST /api/sessions/:id/meal`: `{action:'join',expectedPreferenceVersion,expectedRosterVersion}` self-only; or host-only `{action:'configure',selectedMemberIds,areaId:'bangkok_demo',expectedPreferenceVersion,expectedRosterVersion}`. Configure atomically reopens and sets selected roster, delivery-only zone, increments P/R, invalidates old ranking/votes/handoff; retains opted-in/confirmed retained members, new selected members must consent. Opening/cancelling UI setup does not mutate. Nonresponders cannot silently be dropped.

Use existing preferences/me, rank, acceptance/me, finalize routes with their existing contracts. Confirm is own-only. Rank/finalize host-only. Choice payload = `{rankingId,restaurantId,expectedPreferenceVersion,expectedRosterVersion}`. Finalize means unanimous decision, NOT ordering. Finalized edits require explicit host reopen/configure.

New `POST /api/sessions/:id/handoff`: Choice payload; host-only; requires finalized current unanimous decision, delivery, same P/R/ranking/catalog/algorithm, transactional deterministic revalidation, all costs known and exact. Returns SessionView. Same current decision with any key yields same handoff ID/items. Unknown cost rejects, never estimates.

New `POST /api/sessions/:id/checkout`: Choice payload + `handoffId`; host-only; exact current cart required. Sets handoff.status='checkout_summary' with one checkoutAt. Does NOT create any order/payment/order number. Repeated same snapshot returns same summary. Every mutation requires existing actor-scoped Idempotency-Key; stale replays fail before returning a usable cart. Central invalidation marks persistent handoff invalidated; UI never offers checkout for it.

Cart stores immutable one-item/member snapshot, fees, subtotal/fee/total integer satang, preference and roster versions, catalog, algorithm, graph and ranking IDs, and timestamps. The authoritative session document and SQL cart projection are written in one transaction. Current seed-v2 rankings use fit-60-40-v3 and thai-ingredients-v1.

### Private noodle preview

`POST /api/sessions/:id/preferences/me/noodles` accepts a proposed `confirmedPreference` and the same three expected versions as personal confirmation. The request name matches the confirmation schema. The endpoint only reads. It authenticates the cookie, checks meal participation, and simulates against confirmed peers and the current catalog. Pending peers or fewer than two meaningful choices return an empty choices array.

Each offered answer has a style and an opaque draft token bound to the actor, proposed fields, member revision, room versions, ranking ID and catalog/algorithm/graph versions. Submit the chosen style and its `noodleDraft` with the ordinary personal PUT. A different owner, changed input or superseded snapshot receives a conflict. Skip and either keep `noodle: "any"`. The public ranking contains generic rejection families. A participant's own `ingredientProofs` resolves graph edges against the current ranking snapshot.

### Optional text draft

`POST /api/sessions/:id/preferences/me/router` takes the preview fields plus up to 2,000 characters of private text. The server identifies the owner from the room cookie and reserves one turn per idempotency key before contacting the configured Responses model. The reply identifies chat, a new preference or an edit. Exact text evidence accompanies proposed changes. The server resolves a requested dish against catalog names and retains other fields. Ambiguous budgets and proposed allergy removals go into a separate required review. Confirmation uses the current `routerDraftId` and `reviewedQuestions: true` when needed. A newer turn or revision supersedes the draft.

The adapter uses the installed SDK's structured output helper. Both server settings, `OPENAI_API_KEY` and `OPENAI_MODEL`, are required. Manual entry and both noodle simulations run locally. [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

### Review a proposed graph change

`npm run kg:draft` starts with incomplete menu records and the reviewed sample recipe, looks up their recipe documents in `data/ingredient-sources.json` and follows product IDs to labels in that same corpus. The report carries the exact source line, fixture URL and scope for each triple. A contradiction is held for review. Compare the proposed and corroborated lists, review each source, then publish accepted facts in a separately versioned snapshot. The command only prints its report. Existing accepted meals need a fresh ranking and unanimous consent to use a changed snapshot.

Ownership: root contracts/server/database/migration/integration; A new delivery UI routes/components/styles only; C new group-order integration/E2E tests only; B README/master/demo docs only. No package/lockfile changes needed. AI_PIPELINE_PLAN.md is user-owned and out of scope.
