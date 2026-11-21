# Verification — actual local results

## Live extraction check — 21 November 2026

With the CraveLoop project key and `OPENAI_MODEL=gpt-6.2-sol`, `npm run ai:smoke` passed on the Thai text and bundled illustration in 4.95 seconds. A separate synthetic text input passed through the session input and extraction HTTP handlers using an in-memory SQLite room. Both returned a draft requiring confirmation with a ฿150 budget and pork excluded. These checks cover preference extraction. The private text router still has mocked-provider coverage.

## Group Order ingredient graph and guided preferences — 21 November 2026

The starting workspace passed typecheck, 98 unit tests and 61 SQLite integration tests. It already contained the ingredient graph, hard-filter traversal, noodle catalog tags and some snapshot checks. This workspace has no project .git directory, so its source branch and commit could not be verified against the reference commit.

The new tests exercise the Group Order form, preview route, authoritative ranking and simulated cart. A three-context browser case selects a broad noodle craving, skips, inspects a private hidden-shrimp path, accepts a restaurant, confirms a broth draft, and reaches a three-item cart after a fresh unanimous vote. Separate tests cover unchanged outcomes despite score changes, incomplete allergy evidence, per-person budgets, peer submissions, obsolete ranking/graph tokens and idempotent cart handoff.

| Command | Local evidence |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 105 passed, including hidden ingredients, both noodle scenarios, graph source conflicts and mock-provider routing |
| `npm run test:integration` | 64 passed with temporary SQLite, including router failure/replay and stale graph checks |
| `npm run build` | Final production build passed |
| `npm run test:e2e` | All nine cases passed against production. On the final build eight passed on the first run. Chrome reported `ERR_NETWORK_CHANGED` during local navigation in the remaining case, which passed on `npm run test:e2e -- --last-failed` in 17.2 seconds of test time. |
| `npm run eval` | 34 existing fixtures, 52 valid assignments in the assignment coverage check, plus the two three-person synthetic policy scenarios below |
| `npm run kg:draft` | Three proposed edges from recipe and label sources for formula Y, three corroborated edges for formula X, zero fixture conflicts. Output awaits human review. |

| Policy on the same two scenarios | Optional questions | Required budget clarifications | Winning restaurants | Hard violations |
| --- | ---: | ---: | --- | ---: |
| Recommend immediately | 0 | 2 | r02, r01 | 0 |
| Ask whenever both styles are available | 2 | 2 | r01, r01 | 0 |
| Ask when the simulated result changes | 1 | 2 | r01, r01 | 0 |

The simulated answer when asked was broth. No real groups participated. Acceptance rates and time to consensus remain unmeasured. The optional router used a mocked provider in tests. A server model was not configured for live verification. The ingredient worker read local fixture documents and the explainer used versioned templates.

The earlier development-server run passed both Group Order cases and timed out in two unrelated legacy chat/home interactions. Those two cases passed on the production server. Browser runs used installed Chrome, temporary SQLite and three separate contexts for the guided demo. The local tsx runner required Windows profile access for the evaluation, graph worker and browser bootstrap.

## Screenshot-reference delivery home — 20 November 2026

The user supplied a real ShopeeFood mobile screenshot. The primary home now follows its orange location/search header, rounded two-row scrolling shortcuts, horizontal orange/cream catalog rail, concept banners and fixed four-item navigation. Group Order/CraveLoop remains the entry to the existing decision layer. All food art is labeled native SVG illustration; card names and prices come from existing synthetic delivery fixtures. No personal screenshot address, real merchant promotion, discount, review, sales count or provider API was added.

Actual checks on the new home source:

- `npm run typecheck`: PASS, including final fixture-loader correction.
- `npm run build`: PASS, new production home compiled and served with `npm start` on localhost:3000. Application source stayed frozen during the browser checks.
- `npm run test:e2e`: **8/8 PASS in 1.8 minutes** against that production server. New home case4.7s; three-context Group Order20.7s; six preserved legacy cases passed. The new test reads seed independently, checks displayed source menu names/prices, searches a real catalog restaurant, verifies empty-result recovery and vegetarian evidence filtering, chooses the single demo zone, and verifies malformed group-link recovery. Group Order still completed personal preferences→no-match/recovery→budget replan→unanimity→cart→checkout/refresh.
- Mobile390px and desktop1440px/520px-centered visual QA: screenshots inspected by A and root, zero observed page errors or horizontal overflow, one Group Order start action and four bottom tabs. Captures: `.local/delivery-home-reference-mobile.png`, `.local/delivery-home-reference-desktop.png`, `test-results/delivery-home-reference-mobile.png`.
- `git diff --check`: PASS. The only initial new-test failures were TypeScript JSON-union inference and Node JSON import-attribute handling; corrected in the test's typed fixture loader before the successful suite. No runtime behavior was weakened.

Core unit98/integration61 and offline34/52 results below remain the earlier same-day backend checks; those suites were not rerun just for this visual-only home change. No commit, deployment, live AI, real ShopeeFood request, order or payment was made. The Group Order/legacy services and catalog data were preserved.

## Current Group Order verification — 20 November 2026

Local macOS, Node 22.23.1, npm 10.9.8; Next 16.4.6 production runtime on `http://localhost:3000`. Catalog `seed-v1`, scoring `fit-60-40-v1`. No source commit, deployment, live AI or food-platform call was made in this task. Earlier results below are historical.

| Command / check            | Actual result                                                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:migrate`       | PASS on durable local SQLite, including migration 004. Existing rooms retained.                                                                                                                                             |
| `npm run seed`             | PASS: repeatable 12 synthetic restaurants / 60 menus.                                                                                                                                                                       |
| `npm run typecheck`        | PASS after UI integration; production build also ran TypeScript successfully.                                                                                                                                               |
| `npm test`                 | 98 / 98 passed. Existing budget/unknown data/diet/allergy/fairness/integer fee and mocked extraction/participation checks remain passing.                                                                                   |
| `npm run test:integration` | 61 / 61 passed across five files, including 16 new Group Order tests.                                                                                                                                                       |
| `npm run eval`             | PASS: 34 authored fixtures, 17 exact ranking scenarios and repeat checks, 52 / 52 feasible assignments, zero detected hard violations. No provider calls.                                                                   |
| `npm run build`            | PASS. Production routes include `/group/[sessionId]`, `/legacy-line`, preserved `/line`, `/web`, `/s` and API routes.                                                                                                       |
| `npm start`                | Started successfully; used for all seven browser cases.                                                                                                                                                                     |
| `npm run test:e2e`         | **7 / 7 passed in 1.6 minutes**, Chromium mobile, one worker, actual local production server.                                                                                                                               |
| Visual QA                  | A completed an additional actual one-person mobile path through cart/checkout; root inspected landing/cart screenshots. Mobile 390px and desktop 1440px checked; no page errors or horizontal overflow in completed checks. |

New three-independent-context Group Order E2E passed in **18.3 seconds**: May spicy / 180; Nat mild, pork exclusion / 150; Ploy vegetarian / initial zero-budget no-match, recovered to 120. All personally opted in and confirmed. Unanswered selected participant blocked search. Options had one catalog item/person with exact inclusive money. Open/cancel setup preserved P/R/ranking/votes. May accepted then changed her nonbinding budget 180→175; fresh unchanged ranking cleared the vote, retained her preference and rejected an old-ranking HTTP acceptance with409. All three accepted the new result; host finalized, separately created the cart, and recorded checkout summary. Same/different-key concurrent cart replays returned one handoff ID, without duplicate items. All three reloads retained separate identities, current acceptances and the exact checkout snapshot. No order/payment identifiers exist.

New integration tests additionally verify nonhost/anonymous/actor-injection denials; host cannot grant someone else's consent; current unanimity; delivery-only and legacy-chat bypass rejection; known exact item/fee/group reconciliation (4,000 satang split across three); unknown-price handoff rejection even with unlimited budget; atomic roster reconfiguration; newly added participants block readiness; finalized edits require reopen; persisted cart invalidation; stale same-key handoff/checkout rejection; obsolete handoff ID with fresh ranking/version rejection; catalog/algorithm changes; and database reconnect persistence. Existing boundary/unknown/dietary/score/concurrency tests were retained.

Six legacy production E2E cases also passed: four-context LINE simulation (24.9s), selected subset/no-match/recovery/add-member (16.3s), visible unchanged-replan feedback (2.6s), four-context web dine-in (14.8s), four-context web delivery (16.6s), web no-match recovery (1.0s). Only their entry URL changed to `/legacy-line` where needed.

Screenshots: ignored `test-results/group-order-checkout-mobile.png` and `.local/group-{home,preferences,results,cart,checkout}-mobile.png`, plus `.local/group-home-desktop.png`. Browser trace/report paths follow Playwright config. These contain synthetic test identities, not a human usability study. No physical-device/venue, PostgreSQL, public HTTPS deployment, live OpenAI or real ShopeeFood integration was verified. No timed human demo rehearsal or live ordering/payment claim is made.

## Historical verification — 18–19 November

18–19 November 2026, Bangkok time. Host Node22.23.1/npm10.9.8, macOS. Catalog seed-v1; algorithm identifier exported in src/domain/ranking.ts. No hosted URL/commit/submission exists.

| Command / check                  | Observed result                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm install                      | Installed and locked dependencies: Next16.4.6, React19.3.1, TypeScript5.x, Zod4.6.7, OpenAI7.59.0, better-sqlite3 13.2.0, pg8.x, sharp0.35.5, Vitest5.1.1, Playwright1.65.1. Exact transitive versions in lockfile.                                                                                                       |
| npm run db:migrate               | PASS on local SQLite, repeated successfully.                                                                                                                                                                                                                                                                              |
| npm run seed                     | PASS repeatedly; stable12synthetic restaurants/60menus.                                                                                                                                                                                                                                                                   |
| npm run typecheck                | PASS.                                                                                                                                                                                                                                                                                                                     |
| npm test                         | 98 unit tests PASS: 34 ranking + 15 mocked extraction + 28 chat draft + 21 meal participation tests.                                                                                                                                                                                                                      |
| npm run test:integration         | 45 integration tests PASS using isolated durable SQLite: 19 base + 10 chat + 12 meal flow + 4 replan feedback tests.                                                                                                                                                                                                      |
| npm run test:e2e (dev server)    | 3tests PASS in38.9s. Two full four-independent-context flows (dine-in and delivery), image upload in manual mode, preference confirmation, menu/cost evidence, Ton200→110 replan, stale acceptance cleared, unanimous finalize, copy-summary UI and refresh persistence; third test zero-budget no-match→manual recovery. |
| npm run eval                     | 34authored cases processed;17exact ranking scenarios,1fairness score fixture,17determinism checks;52/52feasible assignments independently checked,0detected hard violations.14extraction fixture schemas checked;0real extraction calls.                                                                                  |
| npm run build                    | PASS after final server/UI edits; static home plus dynamic room/API routes.                                                                                                                                                                                                                                               |
| npm run cleanup                  | PASS; observed0expired rooms/images in local demo database at execution time. Expiry access and no-image-read-route tested separately.                                                                                                                                                                                    |
| npm run ai:smoke                 | NOT RUN/exit1: no OPENAI_API_KEY or OPENAI_MODEL. This is intentional truthful failure, not AI integration success.                                                                                                                                                                                                       |
| npm audit --omit=dev             | 0production vulnerabilities reported at this run. Full audit still reports5high findings through development test dependencies (picomatch/tinyglobby/Vite/Vitest). Registry currently supplies picomatch4.0.7; no forced dependency downgrade applied.                                                                    |
| Browser static bundle inspection | No OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY or host_token_hash strings found in .next/static. This is a bundle inspection, not a penetration test.                                                                                                                                                                       |

Production-runtime browser retest: **3/3 PASS in39.1s** against `npm start` on localhost:3000 (not the dev server). Both four-context flows and no-match/manual recovery repeated successfully. Final boot-only environment validation was then added; build and server boot checked separately. A production start with APP_SECRET empty logged a failed instrumentation hook; the configured server starts successfully. Existing finalized four-member room and all four acceptances survived server restart.

## Revised meal flow —19 November2026

The updated UI and server separate group membership, host-selected meal participants, each person's explicit opt-in, and their private confirmed preferences. New chat groups use the gated flow; legacy groups offer setup while preserving existing API compatibility. The bot never becomes a voting participant.

- Unit suite: **98/98 passed**; integration suite: **41/41 passed**. New meal tests verify unjoined selected people remain in readiness, host cannot consent for others, bystanders cannot edit/vote or alter recommendations, subsets receive correct delivery fee allocation, coordinating hosts may exclude themselves, additions invalidate old votes while retaining confirmed restrictions, and late AI responses cannot restore a removed participant.
- Both updated browser scenarios passed on dev: full four-context setup→self-opt-in→private confirmation→rank→budget replan→unanimous finalize/copy, and a three-context selected subset→no-match→budget recovery→add participant scenario.
- A strengthened browser regression verified that **opening and cancelling meal setup leaves ranking, votes and versions intact**. Only final host confirmation reopens the decision and changes the roster. That targeted run passed in22.6s.
- Mobile390px setup, opt-in, private form and pending readiness screenshots inspected by A and root. No clipping/horizontal overflow or browser page errors in completed checks.
- Migration003 applied locally and production build/typecheck passed after final code changes. Shared zone remains the single synthetic catalog area; no live location, LINE integration or clip/reels processing was added.
- **Final production E2E: 5/5 passed (1.4 minutes)** against `npm start`. Updated four-context meal chat28.6s; selected-subset/no-match/addition/cancel-regression16.1s; preserved web dine-in18.8s, delivery16.5s, no-match recovery987ms. Final current source passed all five scenarios, including actual clipboard and refresh persistence.

Historical results from previous implementation phases follow; the counts above supersede the old suite totals. PostgreSQL/hosting and live OpenAI remain unverified for lack of configured access.

## Follow-up LINE simulation phase

The user explicitly requested a LINE-style simulation only, superseding the original web-first interface. Current default `/` and `/line/:id` use simulated group chat; `/web` and `/s/:id` preserve the original working interface and API. No LINE channel, webhook, credentials or external messaging was created.

- **77 unit tests passed** (34 ranking + 15 mocked extraction + 28 chat draft helper).
- **29 integration tests passed** (19 original + 10 chat). New cases cover host-only bot invite, owner identity/no spoof, shared messages before invite, author-only draft and no canonical mutation, concurrent idempotent retries, budget-only merge, actual status/ranking/consensus events, durable reconnect and real HTTP envelopes.
- Targeted four-context chat E2E passed after a clean dev restart. A strengthened run additionally focused the host and granted clipboard permission, then **asserted the actual clipboard contains the final restaurant summary** (1 test passed,25.6s). The earlier run tested the copyable text/fallback only; it did not establish successful clipboard write.
- Mobile390×844 screenshots inspected by A and root: green own messages, separate CraveLoop bubbles, readable simulation/catalog notice, private review drawer and real menu cards. No horizontal overflow or browser page errors in completed runs.
- Production build and typecheck passed after all application edits. A fresh result scrolls to its first option; older rank messages remain text history and only the current snapshot has actionable cards.
- **Full final production E2E suite: 4/4 passed in59.6s** against `npm start` on localhost:3000. Includes the four-context LINE-style chat flow with real clipboard assertion, preserved web dine-in and delivery flows, and zero-budget manual recovery. No real LINE connection or external messaging occurred.

A failed browser attempt encountered repeated HMR page reloads while root ran a production build alongside dev QA. Root stopped dev, moved its generated cache to ignored `.local/dev-cache-before-chat`, restarted clean and stopped making source edits during QA; the chat E2E then passed. Subsequent production build/start and browser tests run sequentially. This was recorded as a development/test orchestration failure, not a successful browser run.

## Measured and bounded claims

C's standalone local seed ranking sample:100delivery runs,4members, mean0.765ms; this excludes database/network/UI. Offline eval observed17individual ranking samples with max2.213ms/mean0.405ms in the saved [offline report](evaluation.offline.json). These are small local timing samples, not hosted latency benchmarks. Polling uses2seconds; venue-network3second roster freshness and live extraction10second target remain unmeasured.

The synthetic four-member scenarios yield r01,r04,r02 initially in both modes; after Ton110 they yield r01,r02,r03. The winner staysr01. No UI winner is hard-coded. Fairness trade-off fixture [100,100,100,20] has mean80/composite56, whereas [75,75,75,75] has mean75/composite75. It is an injected numerical test, not a user study.

Integration covers duplicate create/join/mutation, same key/different body conflict, membership capacity, wrong actor, unconfirmed roster, optimistic concurrent updates, stale preference/ranking rejection, acceptance upsert/withdraw, no-consensus rejection, concurrent finalize exactly once, catalog availability recheck, finalized reopen/removal, mode/fee replan, AI timeout/manual recovery, late extraction rejection, room expiry, malformed JSON/origin/schema, SVG/decoded-image failures, streamed body cap, expired private images and persistence reconnect. PostgreSQL-specific locking/SQL has not run here.

## Failures found and corrected

- tsx default CommonJS rejected top-level await: package now declares type:module.
- In-progress UI syntax plus two narrow TypeScript union errors fixed by owning agents.
- Sharp initial version vulnerable: updated to0.35.5 before final build.
- Initial E2E exact button locators omitted decorative arrows. Trace identified the mismatch; corrected locators.
- Background browser tabs correctly pause polling. Test attempted confirmation with an old roster version and received409. Tests now activate each independent context and wait for fresh visible snapshot before acting; server stale-write protection remains enabled.
- Formatting command included .env.example, which Prettier cannot parse; source formatting completed, environment sample intentionally kept as dotenv text.

## Not verified / remaining setup

- PostgreSQL/Supabase migrations/transactions and multi-instance hosting: no database credentials; local Docker daemon unavailable.
- Real OpenAI text/image extraction, model availability, accuracy or provider latency: no configured credentials/model. Tests mock adapter failures and outputs, and do not establish real inference quality.
- Hosted four-device demo, venue network behavior, scheduled cleanup service, timed pitch rehearsal and competition submission.
- Database backup/provider retention, distributed rate limiting and account-based identity are outside the local prototype. Private DB image cleanup must be scheduled by deployer.

Local P0 manual flow is implemented and verified. The full master-spec hosted+live-AI definition of done is **not yet met**. Follow README deployment steps and run the actual hosted flow and AI smoke test before claiming it is met.

## Replan feedback correction —19November2026

Currentroom history confirmed automatic reranking after edited preferences, with identical actual recommendations. Added explicit unchanged/changed feedback, currentversion/calculationtime and a scroll handoff fix. Existing room reads receive comparisonfeedback without canonical-state/history writes. The user's own room was read only; no preferences or votes were changed by the investigation.

Actualchecks:98unit tests passed,45integration tests passed, typecheck and productionbuild passed. New integration tests prove a nonbinding budget edit returns a fresh ranking with unchangedchoices and clearsoldvotes; bindingbudget can produce no-match; differentcuisine/mode can change actualscores/costs; oldsavedroom comparisons are read-only. Final production browser suite: **6/6 passed (1.5 minutes)**. The new visible-unchanged-feedback regression passed in2.4s and asserts the update notice is in the viewport after save and survives reload; the existing four-context chat, selected-subset meal and three legacy flows also passed.
