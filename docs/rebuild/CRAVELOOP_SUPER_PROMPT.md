# CraveLoop — copyable rebuild prompt

Prepared **21 November 2026, Asia/Bangkok**, from the pre-existing prototype at commit **`6a93979`**, whose application was developed **18–20 November 2026**. This file and its adjacent [CRAVELOOP_REBUILD_SPEC.md](CRAVELOOP_REBUILD_SPEC.md) are a technical reconstruction packet derived from that existing work. They are not evidence that the product or implementation originated during an event.

**Preparing these files does not run a rebuild.** To use them for a personal rebuild, supply both files, the referenced visual assets, and an absolute fresh destination in a new implementation request. The prompt below is the instruction to copy; keep its provenance and eligibility paragraph intact.

**Competition restriction:** the rule supplied for this request permits ideas and excludes prebuilt work. This packet contains technical material derived from a prebuilt implementation. Do not assume that rewriting code from the packet makes it eligible. For competition use, obtain explicit organizer permission covering this technical packet and the intended reuse first. Without that permission, do not use the technical packet to implement a competition entry. Do not hide its origin, rewrite history, or present newly generated source as proof of eligibility. Personal rebuilding is a separate use. This is a factual boundary, not a claim of organizer approval or competition compliance.

## Copy this complete prompt

```text
Rebuild CraveLoop from the adjacent CRAVELOOP_REBUILD_SPEC.md and its supplied
visual/reference assets into the fresh destination I specify below. Build the
working application, not just a plan or UI mockup. Treat the specification as the
source of truth for the current prototype's observable behavior and contracts.

DESTINATION: <ABSOLUTE_FRESH_DESTINATION>
PURPOSE: <PERSONAL_REBUILD or ORGANIZER_APPROVED_COMPETITION_USE>
ORGANIZER PERMISSION, only for competition use: <EXPLICIT_PERMISSION_AND_SCOPE>

0. Authorization, provenance and destination

This packet was prepared on 21 November 2026 from pre-existing commit 6a93979,
whose application was developed on 18–20 November. Retain this provenance in the
new README and build log. It is not fresh competition-day design or a statement
of platform partnership. The supplied competition rule permits ideas and excludes
prebuilt work: using this technical packet for a competition implementation
requires explicit organizer permission covering this material and intended reuse.
If this is competition use and that permission is absent or does not cover the
packet, DO NOT implement the competition entry from this technical packet.
Explain the specific eligibility conflict; offer only separately permitted
nonimplementation assistance. Rewriting from a spec, a new repository, new
commit timestamps or a new language does not establish eligibility. Never conceal
this source, erase provenance, rewrite history or claim organizer approval.
For an authorized personal rebuild, proceed without introducing an event-approval
step. Do not invent a purpose or approval from silence.

This prompt becomes an implementation instruction only when the user explicitly
invokes the rebuild. Merely reading or preparing the packet is not authorization
to start rebuilding, deploy anything or modify an existing working application.

Use only the absolute fresh destination supplied for this rebuild. Do not assume
that the current prototype directory is the destination. If the destination or
purpose is missing, request the necessary information while doing only safe
read-only inspection that does not depend on it. If the path already contains
unrelated work, inspect and preserve it; do not delete, overwrite, reset or silently
repurpose it. Never delete or alter the source prototype. Do not clone/download the
old repository, copy its implementation files, database, tokens, keys or session
records unless the user separately authorizes that reuse and it is permitted for
the stated purpose. The supplied catalog snapshot and reference assets are explicit
inputs; reconstruct from those inputs rather than importing the old application.
Use a fresh database, fresh APP_SECRET and newly created demo identities.

Once scope and destination are authorized, make routine reversible development
decisions yourself, record assumptions and keep working. Ask only for information
that is necessary and cannot be discovered. Missing AI or hosted credentials must
not block the complete local manual flow. Do not request permission repeatedly for
already authorized ordinary development. Do not commit, push, deploy, publish or
submit unless the user explicitly asks for that additional action.

1. Read everything and freeze contracts before splitting work

Read CRAVELOOP_REBUILD_SPEC.md in full, including data/catalog snapshot, SQL,
visual appendix, API/version/idempotency semantics, privacy, tests, limitations and
provenance. Inspect every supplied reference image and determine which screen/state
it depicts. Read applicable AGENTS.md in the destination and its parent hierarchy.
Preserve unrelated work. If a supplied document or image is missing, identify the
specific gap and continue independent work using available contractual detail;
do not invent a missing restaurant fact, platform response or completed feature.

Default fidelity is FULL CURRENT-PROTOTYPE PARITY: primary Group Order flow,
legacy web and LINE-simulation pages/endpoints, optional private extraction adapter,
persistence, migrations, reproducible seed/evaluation, errors and documentation.
Deliver the primary vertical slice first, then finish the remaining parity work.
Do not silently reduce the request to primary UI only. If the user explicitly
narrows scope, record which parity requirements were cut.

The adjacent rebuild spec is the operative contract; historical source test counts
and upstream version observations are context, not results of this new build. If a
contract is internally inconsistent, make the smallest explicit resolution, explain
it and add a meaningful regression. Do not weaken constraints to make a demo pass.
The future AI_PIPELINE_PLAN.md is not an instruction to implement its backlog.

Before parallel work, create shared TypeScript types, strict validation schemas,
HTTP success/error envelopes, version snapshots and module interfaces. Define
which returns are redacted public views and which records remain private. Freeze
these contracts and ownership in a short integration document. One owner integrates
and approves contract changes. Never let parallel tasks independently redefine
money, actor identity, consent or stale-result semantics.

If the current user request authorizes subagents and tools support them, use bounded
A/B/C/D ownership after the shared contracts exist:
A: consumer routes, mobile screens, forms, results/cart UI and visual parity;
B: server-only extraction, rules drafts, evaluation fixtures and uncertainty;
C: supplied catalog, pure costs/feasibility/ranking and deterministic tests;
D/integration owner: contracts, authentication, migrations, transactional APIs,
meal/consensus/handoff services, integration/browser tests and final evidence.
Specify exact owned files; D owns central routes, shared schemas and lockfile.
Otherwise implement these slices sequentially with the same interfaces. Development
subagents are not autonomous product/runtime agents. Do not add an agent framework.

2. Bootstrap a reproducible local application

Use Next.js + TypeScript with one Node backend and npm unless the destination has
an authorized constraint requiring preservation. Read the relevant guides in the
installed Next.js documentation before writing framework-dependent code, as required
by AGENTS.md. Do not assume training-era APIs still apply. The packet's package
versions are a source snapshot, not a claim of latest compatibility. Prefer its
reproducible versions where available; verify any necessary substitution, pin the
selected versions in the lockfile and record why behavior remains compatible.
Consult current official OpenAI documentation before implementing its adapter.
Never silently choose an unverified model; OPENAI_MODEL must be explicit.

Implement all required scripts from the rebuild spec, including installation,
db:migrate, seed, dev, typecheck, unit tests, integration tests, E2E, offline eval,
build/start, cleanup and AI smoke. Do not create empty scripts that report success.
Prepare .env.example without secrets and boot-time environment validation.

Use actual persistent SQLite for a reproducible local run with a fresh database.
Prepare the replaceable direct PostgreSQL/Supabase connection path and SQL migrations
as specified. Preserve the authoritative aggregate plus normalized projections in
the same transaction. PostgreSQL needs its actual locking/creation semantics;
SQLite needs durable transactional serialization. An in-memory map or browser local
storage is not shared persistent session state. Do not call an untested PostgreSQL
adapter or ephemeral SQLite deployment production-ready.

3. Primary vertical slice: consent to a real computed recommendation

Implement / -> create experience:"group_order", delivery-only -> /group/:id.
Show the independent ShopeeFood integration-concept and synthetic-data labels.
No real platform SDK, private API, login, external messaging or ordering is involved.

Create/share/join with opaque browser capabilities and separate actor identities.
Group membership, selected participants, personal meal opt-in and canonical
preference confirmation are four different things. Host/new group joiners may be
selected but are never automatically opted in. Every selected active participant
must personally join and confirm. Include selected nonresponders in readiness.
Do not silently drop a disconnected person. Bystanders and the bot never enter
fee allocation, fit, votes or consensus. A host can coordinate without voting.
The cap is five active group humans; expectedSize:4 is only a historical hint.

First wire manual private preference confirmation through persistence end to end.
Distinguish hard ingredient exclusions, verified diet requirements, allergies
requiring absence plus cross-contact evidence, and soft dislikes. Budget is the
maximum inclusive total per person. Blank/null means no maximum, not a zero budget.
An editable draft or chat message cannot mutate canonical preferences. Never let
one member edit/confirm/accept on another member's behalf.

Use exactly the supplied synthetic catalog snapshot: 12 restaurants and 60 menus,
stable IDs, known/unknown costs, ingredients/completeness and declared evidence.
Do not fabricate extra restaurant names, menu facts, prices, ingredients, proof,
platform URLs or live availability. “Verified” fixture evidence is not medical
safety certification. Preserve dataOrigin/catalogVersion and explicit demo labels.

Keep the domain engine pure deterministic TypeScript. Hard filtering precedes
soft scoring. Every returned restaurant must have exactly one feasible catalog
menu for every selected active participant. Unknown prices/fees fail finite
budgets; incomplete ingredients cannot prove an exclusion absent; unsupported
restrictions fail closed. Dietary evidence and allergy absence/cross-contact
evidence must be explicit. A model cannot override these checks.

Money is safe integer satang. Delivery total is known item price plus allocated
known delivery/service quote. Split fee by floor division; allocate remainders by
ascending participant ID so totals reconcile exactly. Never substitute zero for
an unknown fee or allocate to bystanders. Keep the one-item, quantity-one scope.

Implement cuisine/flavor/texture weights .50/.30/.20 with overlap fractions,
omitting empty families and renormalizing. Neutral fit is 50 when all are empty.
Soft-tag dislikes subtract 20 per distinct match, capped at 40; clamp to [0,100].
Choose each member's highest-fit feasible menu, then known/lower total and menu ID.
Group score = .6 * mean + .4 * minimum, algorithm fit-60-40-v1. Restaurant ties use
higher minimum, known/lower group cost, known/lower distance, then ID. Compare
unrounded values; display rounded values. Return up to three feasible options,
or structured no_match with no hidden relaxation. No LLM reranking, embeddings,
new fairness modes, diversity shuffling or invented alternatives.

Group Order public views remove private constraintEvidence and collapse rejection
attribution to the specified generic reason families. Internal ranking records
must retain exact proof for deterministic revalidation. Peer full preferences,
private inputs/images and drafts must not leak through alternate legacy URLs,
cache responses, error messages or transcript. Public menu/cost/fit and identities
still exist: do not claim anonymity or that choices reveal nothing about needs.

Gate: at least separate browser identities can create/join, personally opt in,
confirm manual needs and receive persisted computed per-person catalog assignments.
Then continue to the full slice; do not stop at this checkpoint.

4. Adaptation, atomic setup and current unanimous agreement

Implement host POST /meal configure as atomic reopen + selected roster/zone update.
Opening/cancelling its UI must not write. Retained participants keep confirmed
fields and consent; newly selected/reselected people must join and confirm. Explicit
removal is different from a disconnected browser. Finalized edits require explicit
host reopen/configure. Group Order stays delivery; reject a dine-in bypass.

Use the spec's P/R/member revisions and current ranking UUID, not timestamps alone.
Confirmed changes invalidate prior ranking, ALL acceptances and downstream cart.
When a closed previously ranked meal remains ready, replan automatically; first
ranking and post-roster-change ranking are explicit host operations. Every ranking
gets a fresh UUID even with identical P/R or choices. Polling GET never ranks/uses AI.

Implement initial/changed/unchanged feedback over the specified comparison fields.
A new calculation may honestly return the same restaurants/menus/costs/scores. Show
fresh version/time and unchanged feedback; never shuffle to make the demo dramatic.
“Other options” navigates the current set, not live discovery or hidden relaxation.

One current acceptance per participant. Host finalizes only when every selected
active person is ready and personally accepted the same current option/ranking.
Revalidate the loaded catalog option and commit unanimity/final state atomically.
No majority shortcut, host proxy vote, disconnected-member removal or stale vote.
Concurrent finalization must create one committed final outcome/event.

5. Separate persistent simulated cart and checkout summary

Finalize records a decision, NOT a cart, order or payment. Implement the separate
host handoff mutation after finalized current unanimity, then checkout-summary
mutation for the exact handoff. Use the spec's local simulated platform boundary.
Copy immutable one-item/member assignments, menu IDs/names, exact item/fee totals,
P/R/ranking/catalog/algorithm snapshot and timestamps. Every monetary field must
be known, safe and exact; reject null cost and mismatched totals, never estimate.

Use the cart_handoffs projection in the same transaction as the private aggregate.
A current decision with repeated/new idempotency keys yields the same cart/items;
checkout sets one checkoutAt. Replays must return the current view, not regress
checkout_summary to an old cart view. Before serving even cached success, check
current actor/host, expected P/R, ranking, catalog/algorithm, finalized choice,
readiness/unanimity and deterministic option equality. Checkout also verifies the
current handoff ID/snapshot. Central invalidation makes old handoff unusable.

Persist refresh/reconnect. Status cart -> checkout_summary is simulation only;
reopen/change invalidates it. Do not create a provider order number, collect money,
invoke a merchant/payment endpoint or display fabricated platform success.

6. Robustness, authorization and privacy

Use strict body schemas and the exact success/error envelopes/status contracts.
Every mutation requires actor authorization and scoped Idempotency-Key; repeated
same body returns its authorized outcome, different body conflicts. Versioned
writes reject stale P/R; canonical preference changes also reject stale member
revision. Inputs/extractions use their own revisions. Validate host/member/meal
ownership server-side on every reference, not only by hiding UI buttons.

Keep keys/credentials server-side. Store hashes of opaque capability tokens; use
room-scoped HttpOnly/SameSite cookies and Secure on configured HTTPS. Invite URLs
never contain host/member tokens. Use fresh secrets/identities and retain the
prototype's limited recovery model; do not import original session capabilities.

Implement streamed body/MIME/decoded-image/size/dimension/frame bounds, text limits,
Origin checks, room/image expiry, safe provider/database errors and process-local
rate limits as specified. Describe their limits honestly: no distributed limiter,
full account identity or application encryption is implied. Private database image
storage is not Supabase Storage. Implement trusted cleanup, document scheduling
and derived cached evidence/backup/provider retention accurately.

Show loading, retry, stale conflict, offline/reconnect, expired room, pending
participant, no-match and manual recovery states. If a test/build fails, inspect
actual diagnostics, fix the cause and rerun the affected checks. Continue within
scope rather than treating a transient tool/install/UI failure as completion.
Use bounded retries and safe fallbacks for unavailable external services. Do not
weaken validation, skip failing invariants or claim unrun checks passed.

7. Mobile visual parity after the functional slice

Use the supplied visual appendix/screenshots as screen-state references, not as
live provider UI. Match the primary mobile hierarchy, orange/white delivery-concept
surface, typography, spacing, cards, navigation, private review, readiness and cart
states. Keep concept/synthetic disclaimers readable; no implied affiliation or real
platform functionality. Preserve the specified product wording and three-person
example. Use supplied assets lawfully; do not scrape remote logos/photos or download
old implementation assets merely because a link is present.

Render actual app states at the specified mobile viewport(s), inspect screenshots,
and iterate on clipping, overflow, contrast, keyboard/focus, scroll and loading/error
layout. Compare equivalent states with the reference; do not call an unmatched home
or static card “visual parity.” Verify underlying buttons mutate real persistent
state. A pleasant screenshot cannot substitute for consent/concurrency/cart tests.

8. Optional private AI adapter and complete legacy parity

Primary Group Order remains manual-first. Implement the retained private text/image
extraction adapter and typed unavailable/failure/manual path for parity, but do not
turn the primary flow into a new LLM chat router. Missing OPENAI_API_KEY/MODEL means
manual mode, never simulated inference. Use server OpenAI Responses structured
output, validated schema, explicit configured vision-capable model, bounded timeout
and at most one transient retry as specified. Credentials being present is not a
successful smoke test. Keep provider calls outside long DB locks; late responses
must not overwrite newer explicit edits or restore removed participants.

Every inference is an editable draft requiring the owner's confirmation. Images
cannot prove ingredient absence, allergy/cross-contact safety or certification.
The draft schema's allergy limitations must be visible; canonical explicit allergy
fields remain authoritative. Preserve explicit-form precedence and input revision
checks. No autonomous tools/URL following, fabricated evidence or live result label
for fixtures. Live smoke/evaluation only when configured and appropriate for the
user's authorized environment; otherwise report NOT RUN with concrete setup steps.

Finish retained /legacy-line, /line/:id, /web and /s/:id and their endpoint parity.
Legacy group text uses the labeled deterministic rules helper, not AI; it may create
an author-only draft, never canonical values. Keep bot invitation/chat/meal opt-in
and legacy rooms without meal metadata behavior as specified. Keep primary-specific
server gates effective even when an alternate legacy URL/API is used. Do not discard
legacy parity just because primary Group Order passes. Do not implement the separate
future AI pipeline, video ingestion, KG, embeddings, mediator or platform connector.

9. Meaningful verification and reproducible evidence

Write and run behavior tests, not tests that merely mirror helper internals.
Cover inclusive budget boundaries, unknown item/fee/ingredient data, unsupported
restrictions, verified diet/allergy requirements, fairness trade-off, neutral/tag
renormalization/dislike caps, deterministic ties and exact fee remainders.
Cover personal consent/ownership, selected nonresponders, subsets/bystanders,
idempotency conflict/retries, optimistic changes, stale ranks/acceptances, current
unanimity, concurrent finalize, atomic configure, preserved retained constraints,
late extraction, privacy projections, cart reconciliation, concurrent handoff/
checkout, stale cart replay, expiry and durable reconnect/restart.

Run the complete primary E2E with THREE independent browser contexts:
May: spicy, inclusive maximum 180 baht.
Nat: mild, hard pork exclusion, inclusive maximum 150 baht.
Ploy: vegetarian evidence requirement, inclusive maximum 120 baht.
Each joins personally, reviews/confirms, receives a real catalog assignment, changes
own preference when demonstrating replan, accepts the same current option, then host
finalizes, creates simulated cart and records checkout summary. Assert exact catalog
references/costs, stale acceptance/cart invalidation and persistence after refresh.
Do not promise the older four-person fixture winner for this three-person scenario.
If quote fee is 4,000 satang for three participants, shares must be 1,334/1,333/1,333
by ascending actual member ID, not by display name or screen order.

Also exercise no-match/manual recovery, missing-AI behavior and appropriate legacy
flows, including independent contexts for preserved dine-in/delivery behavior where
required. Inspect narrow mobile screenshots and browser errors. If browsers cannot
run, state exactly why and what remains untested; still run independent available
checks. Historical source had recorded tests; DO NOT copy their counts as results
of this new build. Never report hosted or real-provider success from mocked tests.

Run reproducible migrations/seed, typecheck, unit suite, integration suite, offline
evaluation and production build, plus browser suite where supported. Stop dev and
browser QA before production build; do not race multiple processes against .next.
Test actual production start after build. Repeat/broaden checks when new changes or
unresolved failures warrant it. Record commands, exit results, denominators, runtime,
version/config facts without secrets, defects found/fixed and untested external work.

10. Deliver the finished local rebuild and an honest handoff

Provide all connected source, lockfile, shared schemas/contracts, migrations and
reproducible supplied seed, .env.example, README installation/run/test/deployment
steps, meaningful tests/evaluation fixtures, screenshot comparison artifacts,
assumptions/decisions, actual Codex build log and known limitations. Include a
prepared 3–4 minute three-person demo from create/invite/consent through current
unanimity and the separate persistent simulated cart/checkout summary.

Summarize what changed, exact commands to run, actual check outcomes, completed vs
incomplete vs externally unverified work, and concrete configuration the user must
supply for PostgreSQL/hosting/live AI. No routine permission stop at a mockup or
unintegrated module: persist until the authorized local parity scope is completed
or a real blocker is precisely identified with independent work finished.

Keep provenance in deliverables: reconstruction packet prepared 21 November from
pre-existing 18–20 November prototype commit 6a93979. Record this rebuild's actual
dates separately. Do not claim competition eligibility, organizer permission,
platform affiliation, safety certification, measured adoption/time savings,
submission, real order/payment, live inference or deployment without actual evidence.
Do not commit/push/deploy/publish/submit unless separately requested.

Start by briefly summarizing the understood scope, personal/approved purpose and
fresh destination. Then read the entire supplied spec/assets and begin the scoped
implementation immediately when the necessary authorization/context is present.
```

The adjacent rebuild specification supplies the complete catalog and visual context; this prompt is the operational instruction, not a substitute for reading that specification. Keep the files together when sharing them.
