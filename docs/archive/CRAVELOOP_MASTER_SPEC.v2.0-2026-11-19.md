# CraveLoop Master Specification

**Version 2.0 · Updated 19 November 2026 · Timezone: Asia/Bangkok**  
Working language: English technical contracts, with Thai product copy and examples.

**Current product:** a working, persistent **LINE-style group-chat simulation** for choosing a shared meal. The group invites a simulated CraveLoop companion, the host selects actual group members for a meal, each selected person opts in and confirms their own preferences, and deterministic code recommends catalog-backed meals before unanimous agreement.

**Current boundary:** this is an independent web simulation. It does not connect to LINE, create a LINE Official Account, send external messages, place orders, or discover live restaurants. All 12 restaurants, 60 menus, prices, distances and dietary evidence are explicitly synthetic. Group chat understanding currently uses a labeled rule-based helper; an optional server-side OpenAI extraction adapter exists, but real model access and inference have not been verified in this workspace.

This document replaces the version 1.0 planning baseline. It consolidates approved product changes, actual implementation contracts, recorded verification, known limitations and future work. **Implemented**, **verified locally**, **implemented but externally unverified**, and **planned** are different statuses throughout. A statement of desired behavior is not evidence that a hosted service or external integration passed.

The complete original is preserved at [Version 1.0 archive](docs/archive/CRAVELOOP_MASTER_SPEC.v1.0-2026-11-18.md). Historical plans there do not override the current flow here.

## Contents

1. [Provenance, decisions and current status](#1-provenance-decisions-and-current-status)
2. [Vision, users and product boundaries](#2-vision-users-and-product-boundaries)
3. [Scope and acceptance criteria](#3-scope-and-acceptance-criteria)
4. [Roles, group membership and meal consent](#4-roles-group-membership-and-meal-consent)
5. [Complete user flow and screen behavior](#5-complete-user-flow-and-screen-behavior)
6. [States, versions, replanning and consensus](#6-states-versions-replanning-and-consensus)
7. [Preferences, chat understanding and image extraction](#7-preferences-chat-understanding-and-image-extraction)
8. [Deterministic feasibility, costs and fairness](#8-deterministic-feasibility-costs-and-fairness)
9. [Architecture, modules and persistence](#9-architecture-modules-and-persistence)
10. [Data schema and aggregate contracts](#10-data-schema-and-aggregate-contracts)
11. [HTTP API contracts](#11-http-api-contracts)
12. [Authorization, privacy, retention and failure recovery](#12-authorization-privacy-retention-and-failure-recovery)
13. [Catalog, fixtures and evaluation](#13-catalog-fixtures-and-evaluation)
14. [Tests, recorded results and definition of done](#14-tests-recorded-results-and-definition-of-done)
15. [Installation, configuration, operation and deployment](#15-installation-configuration-operation-and-deployment)
16. [Demo, pitch and competition readiness](#16-demo-pitch-and-competition-readiness)
17. [Team ownership and actual Codex evidence](#17-team-ownership-and-actual-codex-evidence)
18. [Explicit continuation instructions for Codex](#18-explicit-continuation-instructions-for-codex)
19. [Limitations, roadmap, sources and decision register](#19-limitations-roadmap-sources-and-decision-register)

## 1. Provenance, decisions and current status

### 1.1 Source history

- Original idea/strategy conversation: “Hackathon Idea Analysis”, ID `6accfdd6-4734-83ec-ba22-e475a5fce99d`.
- Historical companion deck: [Google Slides](https://docs.google.com/presentation/d/1RE-IMUoV-MsFLomiLgVyf68iZPFtpLOjMn6k5IlEJgs/edit). Version 1 records a blank native title slide when inspected on 18 November; it was not re-inspected for this update. The deck is not the implementation contract.
- Version 1.0, 18 November: proposed a shareable mobile web flow, Supabase/OpenAI adapters, synthetic catalog and `0.6 × mean + 0.4 × minimum` ranking.
- Initial implementation, 18 November: Next.js/TypeScript, durable local SQLite, PostgreSQL adapter, manual preferences, catalog ranking, private extraction adapter, replanning and consensus.
- User clarification, 18 November: the intended experience is a companion invited into a group, analogous to the user's description of Khun Thong. The user explicitly requested **simulation only**, without a real LINE connection. The primary UI became a chat simulation; original web routes remain available.
- Revised flow, 19 November: host selection is separate from personal opt-in; common area/mode are set for the meal; every selected person reviews their own private preferences; unreadiness never silently removes someone from the denominator.
- Replanning correction, 19 November: an inspected room had already recalculated after a preference change, but the recommendations remained identical. The app now explicitly acknowledges fresh calculations, reports unchanged results truthfully and keeps the update notice visible during the save-to-chat refresh handoff.

Version 1's recovered strategy had truncation/source limitations. Its detailed schemas, fixtures and schedule were proposed specification work, not recovered user statements. Earlier assistant-authored biography/competition claims are not independently verified and must not become product or pitch facts.

### 1.2 Current implementation status

| Capability                                                   | Current status                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Primary `/` and `/line/:sessionId` experience                | Implemented; local browser flow verified                                                       |
| Group creation, invite link, independent member identities   | Implemented; transactional persistence and ownership verified locally                          |
| Simulated bot invitation and persistent group transcript     | Implemented; no LINE API involved                                                              |
| Host-selected meal roster, common zone/mode, personal opt-in | Implemented; server-side gates and subset behavior verified                                    |
| Manual private preference review and confirmation            | Implemented; allergies/hard exclusions/soft dislikes distinguished                             |
| Rule-based Thai/English chat draft helper                    | Implemented and labeled as rules; limited vocabulary, not general language understanding       |
| Deterministic catalog feasibility, costs, fit and top three  | Implemented; defined tests/evaluation passed                                                   |
| Adaptive replanning and stale acceptance invalidation        | Implemented; changed and unchanged outcomes verified                                           |
| Unanimous current-option finalization and copyable summary   | Implemented; four-context flow, refresh and clipboard behavior verified locally                |
| Private image upload, validation and manual fallback         | Implemented; local upload path verified                                                        |
| Optional OpenAI text/image draft extraction                  | Implemented; mocked adapter tests passed; **no real extraction/model-access success verified** |
| Local SQLite persistence                                     | Implemented; file durability, reconnect and restart checked                                    |
| PostgreSQL/Supabase connection adapter and SQL migrations    | Implemented/prepared; **PostgreSQL execution and hosted concurrency unverified**               |
| Cleanup command                                              | Implemented and executed locally; **no recurring cleanup worker provisioned**                  |
| Public/hosted deployment and venue-network measurements      | Not performed/verified                                                                         |
| Real LINE, live discovery, payments, video/reels ingestion   | Not implemented; outside current scope                                                         |

Latest recorded checks before this documentation-only revision: **98 unit tests, 45 integration tests, 6 E2E tests, typecheck and production build passed**. The full final browser suite ran against local `npm start`, not a hosted deployment. Offline evaluation checked 52/52 feasible assignments with zero detected hard violations in those fixtures. See section 14 for denominators and limits.

### 1.3 Source precedence

1. The user's current explicit instructions and accepted product decisions.
2. This version's current requirements and clearly labeled implementation contracts.
3. Actual shared Zod/TypeScript contracts, SQL migrations and server behavior for exact executable details.
4. Focused integration notes and historical plans.

If implementation and a requirement differ, record the discrepancy and resolve it explicitly; do not describe a planned guarantee as implemented. Historical ownership/contract notes may describe an earlier phase. This document was checked against current files, not just those notes.

## 2. Vision, users and product boundaries

**Vision:** help a group agree on what to eat while giving every participating person a workable catalog meal.

**Problem hypothesis:** different cravings, budgets, dietary needs and dining modes cause repeated negotiation in group chats. No measured reduction in decision time, market size, adoption or satisfaction has been established.

**Value proposition:** keep the coordination experience in a familiar group-chat setting; gather individually confirmed needs; present up to three restaurants with a feasible menu for each participant; explain the trade-off; revise the result when confirmed conditions change.

Initial demo: four friends or colleagues choosing one meal in the single `bangkok_demo` area. The hard group cap is five active human members. `expectedSize:4` is a UI/demo expectation, not a rule requiring four people before ranking. One, two or three selected participants can complete a meal if all required people consent and confirm.

### Current simulation versus long-term vision

- The **companion/group-chat interaction** is current product direction.
- The **real LINE-integrated distribution channel** remains a possible future adapter, not part of this simulation. No LINE login, LIFF, webhook or channel setup is required now.
- The browser simulates the chat surface; decisions and persistence use the actual backend. It is not a static conversation mockup.
- Anonymous browser capabilities are prototype identity, not LINE identities or production accounts.
- One room holds one revisable meal. “เริ่มมื้อใหม่” configures that room's meal; there is no independent multi-meal history, parallel meal sessions or historical fairness rotation.
- The app helps choose; it does not order, reserve, collect money or provide a dietary safety certification.

Fit scores are algorithmic preference-fit estimates, not measured human happiness. The 60:40 formula is transparent and testable, not a proof of universal fairness.

## 3. Scope and acceptance criteria

### 3.1 Current P0

1. Create a simulated group and share a link; friends join independently without account registration.
2. Invite CraveLoop through an explicit host action; persist the invitation, bot greeting and group messages.
3. Host chooses actual active group members, shared catalog area and dine-in/delivery in one setup confirmation.
4. Each selected member, including the host if selected, individually opts into that meal.
5. Each reviews an editable private preference form/draft and confirms their own canonical values.
6. Show readiness and pending people by name for **all selected active participants**, including nonresponders.
7. Host requests the initial ranking only after everyone required has joined and confirmed.
8. Deterministic code returns up to three feasible catalog options, each with one assigned menu per participant, costs, fit and evidence.
9. A confirmed preference/mode change invalidates old results/votes and automatically replans when the closed meal remains ready.
10. A new calculation can legitimately return the same choices; show time/version and an explicit unchanged acknowledgement.
11. Separate personal edits from adding/changing participants; cancellation of setup must preserve the existing decision.
12. Every participant accepts a current option personally; host finalizes only after unanimity and server feasibility revalidation.
13. Provide copyable invite/summary and restore state after refresh; handle loading, disconnection, errors, no-match and manual fallback.
14. Preserve original web routes for compatibility; new primary groups use the explicit meal gates.

### 3.2 Acceptance matrix

`Local verified` below means recorded local checks, not a claim of venue-network or hosted verification.

| ID  | Required behavior                                                                                             | Current evidence/status                                                     |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| R01 | Separate browsers join one persisted group; no host token in invite link                                      | Local verified                                                              |
| R02 | Bot invitation is explicit and idempotent; ordinary pre-invite chat works                                     | Local verified                                                              |
| R03 | Select only real active group members and shared area/mode                                                    | Local verified; single synthetic area                                       |
| R04 | Host cannot opt in or confirm on another person's behalf                                                      | Local verified, including direct API bypass attempts                        |
| R05 | Selected nonresponders remain in readiness; bystanders/bot do not count                                       | Local verified                                                              |
| R06 | Preferences require personal confirmation and survive refresh                                                 | Local verified                                                              |
| R07 | Every ranked option has one feasible catalog assignment per selected active participant                       | Tests/evaluation verified for defined inputs                                |
| R08 | Finite inclusive budget and dietary/allergy evidence are enforced before scoring                              | Defined deterministic tests passed                                          |
| R09 | Changed confirmed preferences create a new ranking and clear stale votes                                      | Local verified when auto-replan preconditions hold                          |
| R10 | Same recommendations after recalculation are acknowledged honestly                                            | API and in-viewport browser regression passed                               |
| R11 | Adding participants preserves retained constraints/consent, requires new opt-in and invalidates old agreement | Local verified                                                              |
| R12 | Opening/cancelling setup changes no ranking, votes or versions                                                | Browser regression passed                                                   |
| R13 | Finalize requires unanimous current choice and rechecks current catalog                                       | Local integration/E2E verified                                              |
| R14 | No-match explains actual rejection reasons without hidden relaxation                                          | Local verified                                                              |
| R15 | Image upload validates type/size/dimensions; inference is an editable draft only                              | Upload/manual path verified; live inference unverified                      |
| R16 | AI timeout/refusal/invalid response preserves canonical preferences                                           | Mocked adapter/integration checks; not live-provider reliability evidence   |
| R17 | Dine-in/delivery and exact fee allocation affect feasibility                                                  | Unit/integration and legacy four-context delivery verified                  |
| R18 | Secrets remain server-side; public views exclude peer private forms/images                                    | Implemented and focused checks passed; not a penetration-test certification |
| R19 | Copyable summary and persisted transcript/result survive refresh                                              | Local browser verified; clipboard permission/focus exercised                |
| R20 | Hosted four-device flow and configured live AI smoke test                                                     | Outstanding; no hosted/live success claim                                   |

### 3.3 P1/P2 and cuts

Future, separately scoped: richer preference clarification, more accessible/private-form polish, distributed abuse limits, hosted verification, real-data provenance adapters, optional evidence-only generated explanations, QR invites, actual catalog availability update workflow, then real LINE integration if requested.

Not current: payments/orders, LINE bot/LIFF, live restaurant discovery or delivery quotes, discounts/deals, social scraping, video/reels processing, nationwide catalogs, merchant dashboards, accounts/recovery, trained recommendation models, remembered cross-meal preferences or fairness history.

Keep image/screenshot upload as the P0 media scope. A reel screenshot is an uploaded image, not ingestion of its video or URL. Never sacrifice hard constraints, ownership, persistence, version correctness or truthful labels for optional features.

## 4. Roles, group membership and meal consent

### 4.1 Four distinct concepts

| Concept               | Representation                               | Meaning                                                             |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Group membership      | `members` with `active:true`                 | Can speak in the simulated group with the member capability         |
| Selected meal roster  | `chat.meal.selectedMemberIds`                | Host intends these actual group members to participate in this meal |
| Personal consent      | `chat.meal.joinedMemberIds`                  | That selected person explicitly clicked “เข้าร่วมมื้อนี้”                 |
| Confirmed preferences | Member `confirmed`, `revision`, `preference` | Canonical values personally reviewed and saved                      |

Selection is not consent; consent is not preference confirmation. The bot has no human member row and never becomes a scoring/voting participant.

For new gated rooms:

```text
participants = active group members whose IDs are selected
ready = participants is nonempty
        AND meal.phase == collecting
        AND every participant's ID is self-joined
        AND every participant is confirmed with a non-null preference
```

Do not filter the denominator to just people who replied. Disconnection does not remove a person. The host must visibly reconfigure the roster if someone will not participate.

### 4.2 Permissions

| Action                                         | Host                                      | Selected + self-joined member | Group bystander | Invite-link reader     |
| ---------------------------------------------- | ----------------------------------------- | ----------------------------- | --------------- | ---------------------- |
| Read redacted room/transcript/results          | Yes                                       | Yes                           | Yes             | Yes, until room expiry |
| Send group message with member capability      | Yes                                       | Yes                           | Yes             | No                     |
| Invite simulated bot                           | Yes                                       | Only if host                  | No              | No                     |
| Start/reconfigure meal                         | Yes, with versions/open room              | No                            | No              | No                     |
| Opt into meal                                  | Own selected identity only                | Own identity                  | No              | No                     |
| Confirm preferences/upload/extract/accept      | Only if personally selected and joined    | Own identity only             | No              | No                     |
| Rank/finalize/reopen/remove group member/trace | Yes, subject to state/readiness/consensus | No                            | No              | No                     |

A coordinating host may exclude themself from the meal. They still orchestrate rank/finalize, but cannot submit a meal vote as an excluded participant. Their absence does not block selected people's consensus.

### 4.3 Compatibility

`POST /api/sessions` with `experience:"chat"` creates `meal.phase:"setup"` and empty selected/joined arrays. The new home always sends this value. These gates apply even through the older web API routes.

Older rooms without `chat.meal` retain the original all-active-group-members behavior. The chat UI offers meal setup; an explicit first setup switches that room to the gated model and requires selected people to opt in/reconfirm. Merely opening an old room must not silently rewrite its preferences, ranking history or consent.

## 5. Complete user flow and screen behavior

### 5.1 Primary route sequence

```text
/ create simulated GROUP
→ /line/:sessionId invite/share and independently join group
→ host adds CraveLoop
→ host opens “เริ่มมื้อใหม่”
→ selects actual members + common zone + dine-in/delivery
→ “ยืนยันและเริ่มมื้อ”
→ EACH selected person clicks “เข้าร่วมมื้อนี้”
→ opens own private form or sends craving text for an editable draft
→ personally reviews and confirms
→ readiness includes all selected people
→ host clicks “หาให้หน่อย”
→ catalog-backed cards in chat
→ accept / edit own needs / inspect other current option
→ all selected participants accept same current option
→ host “สรุปร้านนี้”
→ persisted summary, copy and refresh
```

The group record is infrastructure; the meal setup is a later product step. There is no automatic popup forced onto other browsers: each person opens their own private form after opt-in.

### 5.2 Screens/components

- **Home `/`:** a clearly labeled example conversation explains the experience, followed by the real name/group-create form. Example speakers are not presented as live members. Initial infrastructure mode is dine-in; actual common mode is selected in meal setup.
- **Chat `/line/:sessionId`:** LINE-style header, simulation/synthetic notices, actual member list, persistent shared transcript, bot bubbles, Flex-style recommendation cards, composer and quick actions.
- **Bot invitation:** “เพิ่ม CraveLoop เข้ากลุ่ม” is a host-only backend action, not a LINE request. Repeated invitations do not duplicate the greeting.
- **Meal setup:** “ตั้งค่ามื้อนี้” lists actual group member checkboxes, “โซนที่นัดกัน” (`bangkok_demo` only) and “รูปแบบมื้ออาหาร”. No live geolocation or inferred personal location.
- **Meal readiness:** selected names show waiting-for-opt-in, waiting-for-preferences or ready. A bystander sees “คุณไม่ได้ร่วมมื้อนี้” and remains able to chat.
- **Private review:** inclusive baht budget, controlled cuisine/flavor/texture tags, hard ingredient exclusions, dietary requirements, allergies needing cross-contact evidence and soft dislikes; explicit review checkbox and confirmation.
- **Optional private image/form drawer:** reuses the existing `PreferenceForm`. Some of this older form's labels remain English. It is not an image attachment to the public group transcript.
- **Results:** up to three fictional venue cards with each participant's actual assigned menu ID/name, item price, allocated fee, total, fit, tags and expandable catalog evidence; group mean/minimum/composite; version, calculation time and update feedback.
- **Agreement:** one active choice per participating member/current ranking. Host finalize is enabled only after the same option has all required acceptances.
- **Final:** chosen menu plan, total, mode, synthetic disclaimer, copyable summary and host reopen control. No real navigation/order buttons.

### 5.3 Personal edit versus roster edit

**Personal edit:** “แก้ความต้องการของฉัน” edits only the current member. A rule draft merges unmentioned current values. Saving invalidates previous results/votes; automatic replan applies under section 6. Editing a draft or typing a message alone does not change canonical constraints.

**Roster edit:** “เพิ่มผู้ร่วมมื้อ” selects existing group members. An outsider first joins the group through its invite link. Unselecting someone removes them from this meal, not from the group. Removing a group member is a distinct host action. There is no self-leave-meal endpoint.

Opening/closing/cancelling setup is local UI state and makes no server write. On final confirmation, if closed/finalized, the UI first calls host reopen and then posts the reviewed setup with refreshed versions. **These are two sequential mutations, not one atomic combined transaction.** If setup fails after reopen, the room can remain reopened with old agreement already cleared; show the error and retry deliberately. The separate roster-menu “เปิดกลุ่มใหม่” control commits reopen immediately.

Retained selected participants keep their confirmed values and consent on a roster-only reconfiguration. Newly selected/reselected people must join and confirm. First setup resets selected confirmations and increments their revisions while preserving old personal values as editable starting values.

### 5.4 Search/alternatives behavior

- Initial search and post-roster-change search are explicit host actions after readiness.
- “หาให้หน่อย” is a **button invoking the rank API**. Typing those words into chat is not a hidden rank command; it can produce guidance.
- “ดูตัวเลือกอื่น” scrolls to another card in the **current** ranked set. It does not run live discovery, rotate restaurants, loosen constraints or fetch the next page. With only one feasible card there is no new candidate to reveal.
- Soft preference changes need not change the winner. Do not shuffle or invent a candidate to make the UI look adaptive.

### 5.5 Failure/recovery behavior

| Situation                                     | Required/current response                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Selected person has not opted in or confirmed | Keep them named in readiness; block rank                                                          |
| Bystander sends craving text                  | Shared chat only; do not create a meal draft/vote for them                                        |
| Ambiguous phrase/image                        | Editable draft/question; explicit form/manual correction                                          |
| No feasible restaurant                        | `no_match`, no chosen venue, actual rejection evidence; user chooses a change                     |
| Unknown price/fee under finite budget         | Exclude; do not estimate a price                                                                  |
| AI unavailable/refuses/times out              | Safe error; preserve confirmed state; retry/manual entry                                          |
| Stale version/revision/ranking                | 409, refresh/review; never apply stale consent                                                    |
| Disconnect/hidden tab                         | Preserve membership and last state; polling backs off/pauses                                      |
| Browser refresh                               | Cookie-backed own identity and persistent room/transcript/result                                  |
| Lost cookie                                   | No account recovery; host may reopen/remove inaccessible seat; do not expose token recovery links |
| Expired room                                  | Reject access; create a new room; not an indefinite rejoin                                        |
| Finalized room edit                           | Explicit host reopen required                                                                     |

The chat UI currently disables ordinary composition after finalization. The backend can still accept a group text and reply with reopen guidance; it does not alter the finalized meal. Do not describe unrestricted post-finalization chatting as a completed UI feature.

## 6. States, versions, replanning and consensus

### 6.1 State model

- Group/session `status`: `collecting | ranking | voting | finalized`.
- Meal `phase`: `setup | collecting`. Readiness is derived; there is no stored `ready` meal phase.
- `membershipOpen` determines whether group membership/meal roster can be changed without reopen.
- `currentRankingId` identifies the only actionable ranking; older records/messages are history.
- `finalizedOptionId` is populated only by successful unanimous finalization.

Typical progression:

```text
collecting + meal.setup
→ collecting + meal.collecting + pending opt-ins/preferences
→ ready (derived, still collecting)
→ ranking (inside the transaction)
→ voting + currentRankingId
→ finalized + finalizedOptionId
```

Ranking is computed synchronously under the room transaction/lock. Its intermediate `ranking` state is not normally observable by polling. A failed transaction rolls back rather than committing a half-ranked room. This is not an asynchronous ranking-job/CAS implementation, although the locked immutable snapshot provides the required stale-write protection.

### 6.2 Version changes actually implemented

`P = preferenceVersion`, `R = rosterVersion`, `M = own member revision`.

| Operation                                                  | Version behavior                                               | Invalidation                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Create group                                               | `P=0`, `R=1`, host `M=0`                                       | Empty initial state                                                                      |
| New group member joins                                     | `R+1`                                                          | Current ranking/votes/final choice cleared                                               |
| Invite bot / ordinary message / save input / extract draft | No P/R increment                                               | No canonical-result invalidation merely for a draft/message                              |
| `start_meal`                                               | `P+1`, `R+1`; first/new selected member `M+1`, confirmed false | Clear result/votes/final choice; retain prior preference values                          |
| First personal `join_meal`                                 | `R+1`; no P increment                                          | Clear result/votes/final choice                                                          |
| Repeat own join with fresh versions                        | No additional consent/version increment                        | No duplicate join event                                                                  |
| Confirm preferences                                        | `M+1`, `P+1`                                                   | Clear current result, all votes and final choice, even if submitted values are identical |
| Any valid nonempty session PATCH                           | `P+1`                                                          | Clear result/votes/final choice                                                          |
| PATCH `action:"reopen"`                                    | Additionally `R+1`                                             | Open membership, collecting                                                              |
| PATCH remove group member                                  | Additionally `R+1`; remove their selected/joined IDs           | Inactive member excluded; personal stored history retained until expiry                  |
| Combined reopen + removal PATCH                            | R increments for both operations                               | Do not assume exactly one R increment per PATCH                                          |
| Explicit rank / automatic replan                           | Fresh ranking UUID; no independent P/R bump                    | Close membership, replace actionable ranking, clear all votes                            |
| Accept / withdraw / finalize                               | No P/R increment                                               | Acceptance changes or final choice stored transactionally                                |

Therefore **P/R alone cannot identify a ranking**: a manual rerank can have the same P/R but a different ranking UUID, and old acceptances must still be rejected.

### 6.3 Automatic versus explicit replanning

On confirmed preference save:

1. Validate capability, participation, expected P/R, expected M and optional current owned draft.
2. Replace that member's complete canonical preference, increment M/P and invalidate current results/votes.
3. Automatically compute a fresh ranking only when there is prior ranking history, membership is still closed and `mealReady()` is true.
4. Commit the preference and fresh result together in the transaction.

Mode PATCH uses equivalent readiness/closed-history conditions for automatic replan. Initial confirmation does not start the first search automatically. Reopen/roster reconfiguration leaves membership open and requires a deliberate host search after required people are ready. No polling GET invokes ranking or AI.

Typing “เปลี่ยนงบเหลือ110บาท” creates a draft only. The member must review and confirm it. Unmentioned confirmed hard constraints remain in the proposed draft; no hidden reset of another person's data.

### 6.4 Changed versus unchanged results

```ts
type RankingUpdate = {
  outcome: "initial" | "changed" | "unchanged";
  previousRankingId: string | null;
};
```

`ranking-feedback.ts` compares result status, ordered restaurant IDs, group scores/totals, and per-person menu IDs, scores, item/fee/total costs and matched tags. It ignores ranking UUID/timestamp, explanatory wording, rejection details and evidence-only changes. Different roster or catalog versions are treated as `initial`, not a like-for-like comparison.

- `initial`: no comparable previous ranking.
- `changed`: comparable recommendation choices/costs/scores changed. It does not necessarily mean the top restaurant changed.
- `unchanged`: the compared recommendation fields remained the same after a fresh calculation. New constraints/evidence can still have been evaluated.

Current cards show the latest preference version and Bangkok calculation time. For unchanged feasible results, show that the restaurants/menus/prices/scores remain the same and another search click is unnecessary. A no-match still shows its actual reasons. The UI maintains the result notice in view through the preference-save response followed by transcript refresh.

Old stored ranking records without `update` receive a derived comparison in the read view; that read does not rewrite canonical state/history. Do not fabricate movement or randomize winners to suggest adaptation.

### 6.5 Current-option acceptance and finalization

A choice references `rankingId`, `restaurantId`, expected P and expected R. Server checks:

1. Actor owns their member capability; accept/withdraw additionally require selected personal opt-in.
2. Ranking is the current one, with current P/R and catalog version.
3. Restaurant is among its current options and room is voting.
4. Upsert/withdraw only the actor's choice, never another member's.
5. Finalization is host-only; all selected active participants must be ready and have accepted this same restaurant in this same ranking.
6. Recompute the deterministic result using the loaded current catalog; compare the chosen option exactly against its published option.
7. Commit final status/choice/event in the same transaction. Concurrent finalize calls cannot create two final events; an idempotent replay returns the original outcome.

No majority shortcut, host override of consent, disconnected-member removal, or stale/removed-participant vote is allowed. A changed catalog that fails revalidation returns conflict rather than silently finalizing stale evidence.

## 7. Preferences, chat understanding and image extraction

### 7.1 Canonical preference contract

Executable validation: [shared contracts](src/contracts/index.ts). Canonical money is **integer satang**, not floating-point baht.

```ts
type Preference = {
  cuisinePreferences: (
    "thai" | "japanese" | "korean" | "chinese" | "western" | "indian" | "other"
  )[];
  flavorTags: ("spicy" | "savory" | "sweet" | "sour" | "mild")[];
  textureTags: (
    "crispy" | "brothy" | "grilled" | "creamy" | "fresh" | "chewy"
  )[];
  dislikes: string[];
  budgetMaxSatang: number | null;
  excludedIngredients: string[];
  dietaryRequirements: string[];
  allergies: string[];
};
```

- Budget: integer `0..10_000_000` satang (up to ฿100,000); null explicitly means no maximum, not zero or unknown finite budget.
- Controlled arrays: maxima 7 cuisine, 5 flavor, 6 texture entries. Scoring deduplicates requested tags.
- Each free-form list: at most 30 trimmed nonempty strings, each 1–80 characters, lowercased and deduplicated. Allergies default to `[]`.
- Empty preference: all arrays empty, budget null. It can be explicitly confirmed and yields neutral soft fit before dislikes.
- Dietary flags require canonical exact evidence keys, e.g. `vegetarian`; arbitrary/ambiguous labels must not be assumed equivalent. Ingredient normalization has a controlled alias/family implementation, not universal food-language translation.

Three separate meanings must be visible in review:

| Field family                         | Meaning                                           | Algorithm                                      |
| ------------------------------------ | ------------------------------------------------- | ---------------------------------------------- |
| Hard exclusions/dietary requirements | Cannot accept a menu lacking required evidence    | Filter out before scoring                      |
| Allergies                            | Require strict absence and cross-contact evidence | Filter out unless both explicit records exist  |
| Soft dislikes                        | Prefer to avoid matching catalog soft tags        | Score penalty only; never a safety restriction |

### 7.2 Current chat rules path

`POST .../chat` with a message uses `buildChatDraft(text, currentPreference)`, not OpenAI. Only an eligible participant receives a meal draft; everyone with access can see the deliberately sent group message itself.

```ts
type ChatDraft = {
  preference: Preference; // complete proposed values, not saved canonical state
  questions: string[];
  source: "rules";
  recognized: boolean;
};
```

Implemented conservative behavior:

- Thai demo inputs and budget shorthand such as `งบ180`, `เปลี่ยนงบเหลือ110บาท`.
- English budgets need explicit baht/THB/฿ context. Unrelated bare numbers are not a budget.
- Currency ambiguity, conflicting amounts/ranges, malformed numbers, negative values, too much precision or unsupported currency keep the previous budget and ask for manual clarification.
- Explicitly mentioned soft families replace that family's old values; unmentioned families remain unchanged.
- Recognized hard exclusions/diets/allergies are added; removal is left to explicit form editing and confirmation, not silently inferred.
- `ไม่เผ็ด` / low-spice wording proposes mild; negated vegetarian wording does not add vegetarian.
- Noodles alone can propose chewy, not invented broth.
- `เจ`, vegan, halal and generic no-meat wording require clarification, not inferred dietary certifications.
- Compound ingredient exclusions can be only partially recognized; a completeness question tells the member to inspect every exclusion/allergy.
- Limited ingredient vocabulary and regex negation handling are not general Thai/English comprehension. Extra questions or imperfect drafts are possible; personal confirmation remains mandatory.

Examples:

| Group text                        | Proposed draft behavior                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `อยากกินกรอบ ๆ รสกลมกล่อม งบ180`    | Crispy/savory cues and ฿180; review before confirm                  |
| `ไม่กินหมู ขอรสอ่อน งบ160`            | Pork hard exclusion, mild and ฿160                                  |
| `กินมังสวิรัติ อยากกินน้ำซุปเส้นหนึบ งบ150` | Vegetarian, broth/chewy and ฿150                                    |
| `อยากกินเผ็ด งบ200`                 | Spicy and ฿200                                                      |
| `เปลี่ยนงบเหลือ110บาท`               | Replace proposed budget only; retain unmentioned prior constraints  |
| `ไม่กินหมูและกุ้ง`                     | May only parse part of the list; require manual completeness review |

Ingredient words can appear in a soft-dislike draft, but the current ranking penalty matches **catalog cuisine/flavor/texture tags**, not ingredient lists. A soft dislike of an ingredient is not enforced like a hard ingredient exclusion.

### 7.3 Optional OpenAI draft path

This separate path is available only when server `OPENAI_API_KEY` and `OPENAI_MODEL` are configured:

```text
own private input → POST /inputs → owned input/revision
→ POST /extractions → editable draft
→ explicit private review → PUT /preferences/me
```

`ai.available` means those two values are nonblank. It is not proof of valid credentials, supported model features, service health or measured access. No model name is silently selected. The configured model must be checked with the smoke test before demonstrating live inference.

```ts
type Evidence = {
  field: string;
  source: "text" | "image" | "explicit_form";
  quote: string | null;
  confidence: number; // 0..1 heuristic, not calibrated probability
};
type PreferenceDraft = {
  cuisinePreferences: string[];
  flavorTags: string[];
  textureTags: string[];
  dislikes: string[];
  budgetMaxBaht: number | null; // draft uses baht, canonical confirmation uses satang
  excludedIngredients: string[];
  dietaryRequirements: string[];
  evidence: Evidence[];
  needsConfirmation: boolean;
  questions: string[];
};
```

The model-facing schema has no dedicated allergies field; the explicit form owns final allergy requirements. Its budget schema is nonnegative nullable baht without the canonical upper bound; confirmation enforces the final money bound. Additional adapter limits include at most 30 free-form restriction/dislike entries of at most 80 characters, 40 evidence records and 10 questions.

Actual adapter behavior:

- Node/server-only usage; OpenAI Responses `responses.parse()` with `zodTextFormat`, no tool execution/URL following.
- Model from `OPENAI_MODEL`, image `detail:"auto"`, `store:false`, output limit 1,800 tokens.
- SDK retries disabled; at most two attempts. Retry only connection errors/timeouts, HTTP 429 or HTTP ≥500, with 75–199 ms jitter.
- Each attempt has a 4,500 ms SDK timeout and abort signal. Approximately 9.2 seconds is a nominal maximum upstream wait, **not a verified end-to-end/provider latency guarantee**.
- Refusal, incomplete output or invalid schema return typed errors; no model response writes canonical preferences automatically.
- Successful results force `needsConfirmation:true` even if the provider omitted the intended meaning.
- Input ownership/participation and revisions are checked before work; the member revision/latest input and participation are checked again before committing a late response.
- An old AI response cannot overwrite a newer explicit form or restore a removed meal participant. A client edit-generation guard also discards an old response when the form changed meanwhile.

Prompt intent: treat user text, screenshots and captions as untrusted data; ignore instructions within them; do not invent venues, menus, prices, ingredients or dietary certification; separate visible craving cues from explicitly stated constraints; preserve uncertainty. “ไม่กินหมู” is a proposed hard exclusion, not a soft dislike; seeing pork in a photo does not mean the user accepts pork. Photos do not prove ingredient absence, allergen safety, price or dietary certification.

Prompt/schema compliance is not factual correctness or proof against prompt injection. Evidence quotes/provenance/confidence are proposed fields, not independently audited truths.

### 7.4 Upload limits and storage

- Private input text: at most 2,000 characters; group message text separately has the same character maximum.
- One selected JPEG/PNG/WebP source per input. Client accepts source up to 25 MiB, resizes the longest edge to at most 1,600 px and encodes JPEG, requiring the result to be at most 5 MiB.
- Server independently checks file MIME, nonempty file ≤5 MiB, decoded JPEG/PNG/WebP format, a single frame, longest edge ≤1,600 and Sharp input-pixel limit 2,560,000; then re-encodes WebP.
- Full mutation envelope is capped at 6 MiB using both Content-Length and streamed byte checks.
- Reject SVG, video, arbitrary remote image URLs and clip/reel scraping. No social login/downloader.
- Images are private base64 data in the server-only room aggregate/database, not public transcript attachments or Supabase Storage objects. There is no public image-read endpoint.
- Manual confirmation may save the uploaded input without interpreting it. Do not label that as image understanding.

## 8. Deterministic feasibility, costs and fairness

Implementation: [costs](src/domain/costs.ts), [feasibility](src/domain/feasibility.ts), [ranking](src/domain/ranking.ts), [participation](src/domain/meal.ts). Catalog `seed-v1`; algorithm **`fit-60-40-v1`**.

### 8.1 Inputs and hard feasibility

Use only the selected active meal roster (legacy: all active members), with all required personal opt-ins/confirmations. Snapshot contains area, mode, preference version, roster version, catalog version and each member's confirmed preference.

For each member `i` and restaurant `r`, build `F(i,r)` from catalog menus satisfying all relevant requirements:

1. Restaurant catalog version, area, availability and channel match.
2. Menu is available. Item price and assigned fee must be known for a finite budget.
3. Seed prices are inclusive. `priceIncludesFees:false` is rejected as unknown cost; the current adapter does not estimate missing tax/service charges.
4. Finite budget: assigned total `<= budgetMaxSatang`, with exact integer boundaries.
5. Hard ingredient exclusion: known excluded ingredient/family is absent and the ingredient list is complete. Incomplete data cannot prove absence. Unsupported restriction IDs fail closed.
6. Required diet: `menu.dietaryEvidence[requirement]` has `verified:true` and a nonempty evidence ID.
7. Allergy: also require `dietaryEvidence["absence:" + canonicalAllergen]` and `crossContactEvidence[canonicalAllergen]`, both explicitly verified with evidence IDs.

Ingredient aliases include unambiguous Thai names such as หมู→pork, กุ้ง→shrimp and ถั่วลิสง→peanut. Families include seafood, shellfish, nuts/tree nuts, pork products, milk products, soy/tofu and gluten grains. The exact supported identifiers/family members live in `SUPPORTED_EXCLUSIONS`/`ingredientFamilies`; they are not a comprehensive food ontology. Unknown restrictions must not become assumed absence. Exact dietary flag IDs are a separate mechanism.

A restaurant is feasible only if `F(i,r)` is nonempty for **every participant**. An LLM, offer or majority vote cannot override this. Relaxation requires an explicit new user-confirmed preference version.

One menu item per person, quantity one. No shared dishes, bundle discounts, minimum baskets, stock quantities shared between members or joint optimization. Adding a shared constraint later requires joint assignment feasibility, not independent best-menu selection.

### 8.2 Inclusive costs and fee allocation

All calculations use nonnegative safe integer satang. Currency is THB; baht is presentation/input conversion only. Not every numeric payload repeats a currency field; the quote/catalog/application money contract is THB.

```text
dine_in total = known inclusive channel price + 0 allocated fee
delivery total = known delivery channel price + exact allocated quote fee
quote fee = deliveryFeeSatang + serviceFeeSatang
```

For `n` participating IDs sorted ascending:

```text
base = floor(quote fee / n)
remainder = quote fee % n
first remainder sorted IDs receive base + 1 satang
other IDs receive base
sum of assigned fees == quote fee exactly
```

Do not allocate to group bystanders or the bot. Example: a 4,000-satang quote is 1,000 each for four participants and 2,000 each for two, even if four people are in the group.

Missing/invalid price or delivery quote under a finite budget excludes the option (`PRICE_UNKNOWN`). With budget null, unknown costs may remain feasible with explicit warnings and null totals; known costs sort ahead of unknown costs in ties. Never substitute zero for an unknown quote. `priceIncludesFees:true` prevents extra restaurant charge estimation; it does not absorb/double-count the separately allocated delivery quote.

### 8.3 Individual fit

For each requested feature family, deduplicate tags and compute matching requested tags / requested tags count:

| Family  | Base weight |
| ------- | ----------- |
| Cuisine | 0.50        |
| Flavor  | 0.30        |
| Texture | 0.20        |

Omit unrequested families and renormalize the rest. Unknown menu tags earn no overlap. If no family is requested, base fit is 50. Subtract 20 per distinct disliked matching **soft catalog tag**, capped at 40; clamp the result to `[0,100]`.

```text
S_i(r) = max fit(i,m), m ∈ F(i,r)
menu tie-break = higher fit → known/lower assigned total → ascending menu ID
```

Use unrounded values for comparisons; round only in display. Ingredient dislikes do not match ingredient lists through this soft-tag score; use explicit hard exclusions for a prohibition.

### 8.4 Group fit and deterministic ordering

```text
mean = average participant score
minimum = lowest participant score
G(r) = 0.6 × mean + 0.4 × minimum
```

Restaurant order: higher composite → higher minimum → known/lower total group cost → known/lower supplied distance → ascending restaurant ID. Return at most three feasible options; return one/two if that is all that passes. Deals do not modify the current score.

Every selected participant has equal weight. This heuristic partly protects the lowest fit; it does not guarantee equal satisfaction, incentive compatibility or cross-meal fairness.

Numerical fixtures, not measured people:

- A `[95,95,95,20]`: mean 76.25, min 20, composite 53.75.
- B `[78,80,82,84]`: mean 81, min 78, composite 79.8.
- C `[50,60,65,80]`: mean 63.75, min 50, composite 58.25.
- Stronger trade-off: `[100,100,100,20]` has mean 80/composite 56; `[75,75,75,75]` has mean 75/composite 75. Balanced B wins composite while A wins mean-only. This is an injected algorithm fixture, not a user study.

### 8.5 Rejections and pipeline

Actual rejection codes include:

`CATALOG_VERSION_MISMATCH`, `RESTAURANT_UNAVAILABLE`, `AREA_UNAVAILABLE`, `CHANNEL_UNAVAILABLE`, `NO_AVAILABLE_MENU`, `PRICE_UNKNOWN`, `BUDGET_EXCEEDED`, `UNKNOWN_RESTRICTION`, `EXCLUSION_PRESENT`, `INGREDIENTS_UNKNOWN`, `DIET_UNVERIFIED`, `ALLERGEN_ABSENCE_UNVERIFIED`, `CROSS_CONTACT_UNKNOWN`.

Records identify restaurant and, where relevant, member/menu. The output retains actual failed checks even when other menus make a restaurant feasible; counts are not counts of distinct restaurants or a proven minimal conflict set. UI-only legacy labels do not imply additional engine codes exist.

```text
authorize + validate versions + require all selected people ready
lock/load one room snapshot
load imported versioned catalog
for each restaurant:
  compute exact participating fee allocation
  for each participant: check each menu; retain failures and feasible evidence
  require one best feasible assignment per participant
  compute mean/minimum/composite and known total
sort deterministically and retain up to 3
create fresh ranking ID + versions + outcome comparison
invalidate old acceptance set, publish result/event, commit atomically
```

No-match is `status:"no_match"`, empty options and structured reasons. Do not invent a chosen restaurant or relax a constraint to fill three slots.

## 9. Architecture, modules and persistence

### 9.1 Runtime architecture

```text
Mobile/desktop browser
  / and /line/:id: LINE-style simulation (React + custom CSS)
  /web and /s/:id: retained original web experience
  own-cookie fetch + local form/draft state + polling
       ↓
Next.js Node route handlers /api/sessions/...
  shared validation + request envelope + capability/participation checks
  chat service / session service / deterministic transaction
       ├─ imported synthetic catalog + pure TS costs/feasibility/fit
       ├─ SQLite file OR direct PostgreSQL connection
       └─ optional server OpenAI Responses draft extraction
```

There is one TypeScript app. No second backend language, runtime autonomous-agent framework, Supabase browser SDK, external LINE bridge or websocket server. Existing Codex subagents were a development collaboration technique, not a product/runtime dependency. Generated explanations currently use deterministic text over actual results, not a separate LLM explanation service.

### 9.2 Current file ownership map

| Area                            | Actual files                                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Shared API/domain types         | `src/contracts/index.ts`, `src/contracts/chat.ts`                                                                                   |
| Primary chat screens            | `app/page.tsx`, `app/line/[sessionId]/page.tsx`, `src/components/line/{LineRoom,MealSetup,ReviewDrawer,ChatShared}.tsx`, `line.css` |
| Original web screens            | `app/web/page.tsx`, `app/s/[sessionId]/page.tsx`, `src/components/{Room,PreferenceForm}.tsx`                                        |
| Client fetch/money presentation | `src/components/api.ts`                                                                                                             |
| Route entry points              | `app/api/sessions/route.ts`, `app/api/sessions/[...path]/route.ts`                                                                  |
| Server orchestration            | `src/server/{session-service,chat-service,chat-events,http,state}.ts`                                                               |
| Environment/auth/database       | `src/server/{env,auth,database,seed,errors}.ts`, root `instrumentation.ts`                                                          |
| Deterministic domain            | `src/domain/{meal,chat-draft,costs,feasibility,ranking,ranking-feedback}.ts`                                                        |
| Catalog/AI adapters             | `src/adapters/catalog.ts`, `src/adapters/openai.ts`                                                                                 |
| Schema                          | `supabase/migrations/001_initial.sql`, `002_chat_simulation.sql`, `003_meal_participation.sql`                                      |
| Data/evaluation                 | `data/catalog.seed.json`, `data/evaluation.json`, `tests/fixtures/`                                                                 |
| Scripts                         | `scripts/{migrate,seed,generate-catalog,evaluate,cleanup,ai-smoke}.ts`                                                              |
| Evidence/tests                  | `tests/unit/`, `tests/integration/`, `tests/e2e/`, `docs/CODEX_LOG.md`, `docs/VERIFICATION.md`, `docs/evaluation.offline.json`      |

Names like a standalone `consensus.ts`, runtime `orchestrator.ts` or `adapters/supabase.ts` in version 1 were proposed layout, not files currently present. Consensus/orchestration are implemented in the session service; PostgreSQL is accessed through `pg`.

### 9.3 Durable transaction model

The authoritative room is `sessions.document`, a private JSON aggregate. In the **same transaction**, the server updates session columns and replaces the room's normalized relational projections. Do not edit projection rows directly to change application behavior.

- SQLite: `.local/craveloop.sqlite` by default; WAL, foreign keys, busy timeout 10,000 ms and `BEGIN IMMEDIATE` serialization. This is durable local disk storage, not an in-memory map.
- PostgreSQL: pooled `pg` connections; transaction-level advisory lock keyed by room ID, then `SELECT ... FOR UPDATE`, aggregate/projection write and commit. The advisory lock also serializes creation before a row exists.
- Mutation callback runs synchronously against the locked snapshot. Successful state and idempotent result commit together; thrown errors roll back.
- OpenAI calls occur **outside** the long room lock. Owned input/member revision/participation are checked again before their draft commit.
- Concurrent duplicate extraction requests can still issue more than one upstream call before the transactional cache resolves; committed application state remains idempotent. Do not claim exactly-once provider billing.

PostgreSQL-specific SQL/locking and hosted multi-instance behavior are prepared but unverified here. SQLite on a durable single installation does not establish ephemeral/serverless or multi-instance persistence.

### 9.4 Catalog source and polling

The ranker reads the imported checked-in `data/catalog.seed.json`, validated by `CatalogSchema`; SQL restaurants/menus are seeded projections. Editing SQL catalog rows alone does not change runtime recommendations. Update the seed, version/schema as needed, tests and deployment together. Availability revalidation uses the loaded catalog; there is no live merchant/provider update worker.

Chat polling normally runs every two seconds, pauses work when hidden and backs off on failure; visibility return refreshes. Original web polling has similar backoff. Client mutation generations suppress polling responses that began before a mutation. GETs never perform extraction/ranking.

The room GET emits a hash ETag and `Cache-Control:no-store`; conditional `If-None-Match`/304 handling is not implemented. The chat GET is an ordinary no-store snapshot. Do not claim subscription/realtime guarantees or a measured three-second venue-network freshness SLA.

## 10. Data schema and aggregate contracts

### 10.1 SQL schema source

The migrations define **14 tables**, with UUID IDs except readable catalog IDs. PostgreSQL uses JSONB/timestamptz/boolean; the local loader translates relevant types to SQLite TEXT/INTEGER/REAL. Money is integer satang; timestamps are UTC ISO values at application boundaries and displayed in Bangkok time.

| Table               | Columns/key constraints relevant to this implementation                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions`          | `id` PK; `area_id`, `mode`, `status`, `host_token_hash`, `preference_version`, `roster_version`, `current_ranking_id`, `finalized_option_id`, `expires_at`, `created_at`, authoritative `document`            |
| `members`           | `id` PK; `session_id` FK; `display_name` length 1–40; `member_token_hash`, `active`, `confirmed`, `created_at`                                                                                                |
| `inputs`            | `id` PK; session/member FKs; `kind`, `raw_text`, `private_storage_key`, bigint `input_revision`, `state`, `created_at`                                                                                        |
| `preferences`       | `member_id` PK/FK, `session_id`, `revision`; cuisine/flavor/texture/dislikes/exclusions/diets/**allergies** JSON arrays; nullable nonnegative `budget_max_satang`, `confirmed_at`, nullable `source_input_id` |
| `restaurants`       | readable `id` PK; `name`, `area_id`, JSON `channels`, `available`, `distance_m`, `fee_quote`, `catalog_version`, `data_origin` constrained to synthetic                                                       |
| `menus`             | readable `id` PK; restaurant FK; `name`, JSON channel prices/ingredients/dietary evidence/cross-contact evidence/tag families; `ingredients_complete`, `available`, `price_includes_fees`                     |
| `rankings`          | UUID `id` PK; session FK, preference/roster/catalog versions, `status`, JSON `options`/`rejections`, `created_at`                                                                                             |
| `acceptances`       | session/member/ranking FKs, restaurant FK, `accepted_at`; PK `(session_id,member_id,ranking_id)`                                                                                                              |
| `events`            | UUID PK, session FK, `event_type`, preference `version`, sanitized JSON `payload`, `created_at`                                                                                                               |
| `tool_runs`         | UUID PK, session FK, `name`, `snapshot_version`, `status`, `duration_ms`, JSON `evidence_ids`, nullable `error_code`, `created_at`                                                                            |
| `idempotency_keys`  | session FK, text `actor_id`, `key`, request hash, JSON response, expiry; composite PK `(session_id,actor_id,key)`                                                                                             |
| `chat_messages`     | UUID PK, session FK, nullable member FK, `kind` system/text/bot, `text`, `created_at`, nullable `ranking_id`                                                                                                  |
| `meal_settings`     | session PK/FK; `phase` setup/collecting                                                                                                                                                                       |
| `meal_participants` | session/member FKs; `joined` boolean; PK `(session_id,member_id)`                                                                                                                                             |

All relevant child rows cascade on room deletion. PostgreSQL RLS is enabled with no browser/public policies; only the trusted server database connection should access tables. SQLite relies on server authorization rather than database RLS.

Group cap and meal ownership/consent invariants are enforced transactionally in the service, not completely expressible by the SQL constraints alone. Relational projections are rebuilt each room write: projection `confirmed_at`/`accepted_at` are regenerated, `source_input_id` is currently null, and `private_storage_key` can be a `private-db:<inputId>` marker rather than a Storage address. Use aggregate/event records for authoritative application history; do not describe these projection timestamps as immutable occurrence times.

Migration loading sorts/replays the idempotent SQL files; there is no separate applied-migration history ledger. Future schema changes need explicit new migration work, not assumptions that `CREATE TABLE IF NOT EXISTS` alters an existing table.

### 10.2 Aggregate-only state

`StoredSession` additionally carries `expectedSize`, `membershipOpen`, all member revisions/preferences/clientJoinIds, input bytes/expiry/drafts, ranking history/feedback, acceptance set, idempotency response map, chat bot state, meal selected/joined lists, events and actual run records.

The document is private and not returned wholesale. It contains token **hashes**, not raw member/host tokens. It is not application-encrypted. `Ranking.update` and `botJoined` are document metadata rather than dedicated projection columns.

### 10.3 Shared chat and meal types

```ts
type MealState = {
  phase: "setup" | "collecting";
  selectedMemberIds: string[];
  joinedMemberIds: string[];
};
type ChatMessage = {
  id: string;
  kind: "system" | "text" | "bot";
  memberId: string | null;
  text: string;
  createdAt: string;
  rankingId?: string;
};
type ChatState = {
  botJoined: boolean;
  messages: ChatMessage[]; // latest 200
  meal?: MealState; // missing means legacy semantics
};
```

Messages are React-escaped plain strings, not executable HTML. Group message text is explicitly shared. Bot status messages are emitted from actual committed service actions; no fabricated participants, read receipts, live model calls or “agent thoughts”.

### 10.4 Ranking and public room view

```ts
type Ranking = {
  id: string;
  preferenceVersion: number;
  rosterVersion: number;
  catalogVersion: string;
  algorithmVersion: string;
  createdAt: string;
  status: "ok" | "no_match";
  options: Option[];
  rejections: Rejection[];
  update?: RankingUpdate;
};
type MemberView = {
  id: string;
  displayName: string;
  active: boolean;
  confirmed: boolean;
  revision: number;
};
type SessionView = {
  id: string;
  areaId: string;
  mode: "dine_in" | "delivery";
  status: "collecting" | "ranking" | "voting" | "finalized";
  expectedSize: number;
  membershipOpen: boolean;
  preferenceVersion: number;
  rosterVersion: number;
  meal?: MealState;
  members: MemberView[]; // group roster, NOT just selected participants
  me: (MemberView & { preference: Preference | null }) | null;
  isHost: boolean;
  ranking: Ranking | null;
  acceptances: { memberId: string; rankingId: string; restaurantId: string }[];
  finalizedOptionId: string | null;
  lastChange: string | null;
  ai: { available: boolean; model: string | null };
  expiresAt: string;
  dataOrigin: "synthetic";
  catalogVersion: string;
};
type ChatResponse = {
  session: SessionView;
  chat: ChatState;
  draft?: ChatDraft;
};
```

Only `me` includes that browser's own canonical preference; peer members do not expose their private forms. Meal/cost/fit and relevant constraint evidence are deliberately group-visible. `draft` is returned only to the author of the qualifying message response; chat GET does not return another person's private draft or raw images. `ai.model` is configuration metadata, not a secret or proof of access.

### 10.5 Option payload fields

```ts
type Assignment = {
  memberId: string;
  menuId: string;
  menuName: string;
  fitScore: number;
  itemCostSatang: number | null;
  allocatedFeeSatang: number | null;
  totalCostSatang: number | null;
  matchedTags: string[];
  constraintEvidence: { field: string; evidenceId: string }[];
};
type Option = {
  restaurantId: string;
  restaurantName: string;
  dataOrigin: "synthetic";
  catalogVersion: string;
  meanScore: number;
  minimumScore: number;
  groupScore: number;
  totalGroupCostSatang: number | null;
  distanceM: number | null;
  assignments: Assignment[];
  warnings: string[];
  explanation: string;
};
type Rejection = {
  code: string;
  restaurantId: string;
  memberId?: string;
  menuId?: string;
};
```

For a known total, `item + allocated fee == per-person total` and the participant totals sum to group total. Every option must reference existing catalog items and exactly the intended participants. An explanation never supplies missing price/ingredient facts or a ranking decision.

## 11. HTTP API contracts

### 11.1 Common transport

Next.js Node route handlers; same-origin JSON, except private multipart input. Local HTTP is supported; deployed credentials/traffic should use the correctly configured HTTPS origin.

```json
{ "data": {}, "requestId": "request-uuid" }
```

```json
{
  "error": {
    "code": "STALE_VERSION",
    "message": "Safe message",
    "details": []
  },
  "requestId": "request-uuid"
}
```

Mutations require `Idempotency-Key`, 8–128 letters/numbers/underscore/hyphen. A matching actor/scope/key/JSON body returns its original stored result; conflicting reuse returns 409. The request hash includes operation/body; the identity comes from the room cookie, never a supplied member ID. A cached replay can return its original historical view; clients refresh the latest snapshot after mutation.

Versioned writes include `expectedPreferenceVersion` and `expectedRosterVersion`; preference confirmation also includes `expectedMemberRevision`. Message/invite/input/extraction contracts use their own relevant identity/input revisions rather than pretending every route requires P/R.

| HTTP status     | Meaning/examples                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 201             | Group create, group join or saved input                                                                                                  |
| 200             | Read or successful mutation view                                                                                                         |
| 400             | Malformed JSON/multipart or missing/invalid idempotency header                                                                           |
| 401             | Missing/invalid active capability or expired room                                                                                        |
| 403             | Wrong actor/host, nonselected meal member, denied Origin                                                                                 |
| 404             | Unknown room/object/route; no public image read route                                                                                    |
| 409             | Stale P/R/M/input/draft/ranking, closed/finalized state, missing consent/setup, conflicting idempotency, no consensus or changed catalog |
| 410             | Expired owned image extraction                                                                                                           |
| 413             | Request envelope too large                                                                                                               |
| 422             | Zod/body validation or semantically impossible request, invalid image, empty input, group full, members not ready                        |
| 429             | Process-local request limit                                                                                                              |
| 502 / 504 / 503 | Invalid/refused/incomplete/upstream AI failure / timeout / unavailable AI configuration                                                  |
| 500             | Sanitized unexpected server error                                                                                                        |

### 11.2 Session/member endpoints

All paths below are under `/api/sessions`.

| Method / path               | Request                                                                                                                | Success `data` / behavior                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /`                    | `{hostName,areaId:"bangkok_demo",mode,expectedSize:4,experience?:"chat"}`                                              | 201 `{sessionId,joinUrl,memberId,versions}`; HttpOnly room capability cookie                 |
| `POST /:id/join`            | `{displayName,clientJoinId:UUID}`                                                                                      | 201 `{memberId,versions}` and own cookie; stable clientJoinId avoids double join             |
| `GET /:id`                  | Room invite ID, optional member cookie                                                                                 | `SessionView`; anonymous link reader receives redacted view                                  |
| `POST /:id/inputs`          | Multipart `{memberId,kind:"text"                                                                                       | "image"                                                                                      | "screenshot",text?,image?,inputRevision}` | 201 `{inputId,inputRevision}`; own input only; increasing positive safe integer revision; no confirmation |
| `POST /:id/extractions`     | `{inputId:UUID,inputRevision:positive integer}`                                                                        | `{draftId,draft,sourceRevision}`; own latest eligible input, expiry and late-response checks |
| `PUT /:id/preferences/me`   | `{confirmedPreference,expectedMemberRevision,expectedPreferenceVersion,expectedRosterVersion,draftId?:UUID}`           | `SessionView`; own eligible canonical confirmation; invalidation/optional replan             |
| `PATCH /:id`                | `{mode?,areaId?:"bangkok_demo",action?:"reopen",removeMemberId?:UUID,expectedPreferenceVersion,expectedRosterVersion}` | `SessionView`; host only; nonempty patch; explicit state/roster rules                        |
| `POST /:id/rank`            | `{expectedPreferenceVersion,expectedRosterVersion}`                                                                    | `SessionView` containing `ranking.id`, options/reasons; host and all required ready          |
| `PUT /:id/acceptance/me`    | `{rankingId:UUID,restaurantId,expectedPreferenceVersion,expectedRosterVersion}`                                        | `SessionView`; upsert own current choice                                                     |
| `DELETE /:id/acceptance/me` | Same current choice schema, including restaurantId and versions                                                        | `SessionView`; withdraw own choice                                                           |
| `POST /:id/finalize`        | Same current choice schema and versions                                                                                | `SessionView`; host, current unanimity and revalidation                                      |
| `GET /:id/trace`            | Host cookie                                                                                                            | `{runs,events}` sanitized actual executions/actions                                          |

This corrects version 1's abbreviated response contracts: rank/patch/confirm/accept/finalize return the full current `SessionView` envelope, not a standalone `rankingId` top-level object. `joinUrl` uses `/line/:id` for `experience:"chat"`; otherwise `/s/:id` for compatibility. Names are trimmed 1–40 characters; active group cap is five. Anonymous readers cannot mutate; already-joined browsers cannot silently create a second seat through a new join identity.

### 11.3 Chat endpoint and actions

`GET /:id/chat` returns `{session,chat}` with no private draft. `POST /:id/chat` validates one strict discriminated action and returns `ChatResponse`:

```ts
type ChatAction =
  | { action: "invite_bot" }
  | { action: "message"; text: string }
  | {
      action: "start_meal";
      selectedMemberIds: string[];
      areaId: "bangkok_demo";
      mode: "dine_in" | "delivery";
      expectedPreferenceVersion: number;
      expectedRosterVersion: number;
    }
  | {
      action: "join_meal";
      expectedPreferenceVersion: number;
      expectedRosterVersion: number;
    };
```

- `invite_bot`: host only; once per group; persists simulated invitation/greeting; no LINE access.
- `message`: active authenticated group member; trimmed 1–2,000 characters; persists the public text. Before invite there is no bot draft/reply. In a gated meal, nonselected/nonjoined people receive guidance rather than meal drafts. Recognized eligible text returns an author-only rules draft and a public review instruction. No canonical write.
- `start_meal`: host, invited bot, open membership, nonfinalized room, exact P/R; 1–5 unique selected UUIDs must be actual active group members. First/new selection resets those confirmations/revisions while retaining their old personal values; retained selected consent/confirmation can persist. Clear old result/agreement.
- `join_meal`: exact P/R, selected active actor, configured collecting meal; records only that actor's consent. No body can name another member to opt in. Retry rules prevent duplicate state/version bumps.

Unknown extra actor fields are rejected by strict action schemas, not trusted. API chat state is persistence, not proof of external LINE delivery or an LLM call.

### 11.4 Important error codes

State/ownership examples: `CAPABILITY_REQUIRED`, `HOST_REQUIRED`, `WRONG_ACTOR`, `ROOM_EXPIRED`, `ROOM_FINALIZED`, `MEMBERSHIP_CLOSED`, `ROOM_FULL`, `MEAL_NOT_STARTED`, `MEAL_NOT_SELECTED`, `MEAL_NOT_JOINED`, `BOT_NOT_INVITED`, `INVALID_MEAL_ROSTER`, `MEMBERS_NOT_READY`, `STALE_VERSION`, `STALE_MEMBER_REVISION`, `STALE_INPUT`, `STALE_DRAFT`, `STALE_EXTRACTION`, `STALE_RANKING`, `UNKNOWN_OPTION`, `NO_CONSENSUS`, `CATALOG_CHANGED`, `IDEMPOTENCY_CONFLICT`.

AI examples: `AI_UNAVAILABLE`, `AI_TIMEOUT`, `AI_INVALID_DRAFT`, `AI_REFUSED`, `AI_INCOMPLETE`, `AI_UPSTREAM_ERROR`. Domain rejection codes are result evidence, not necessarily HTTP errors. Treat `requestId` as a safe support correlation identifier; do not return raw provider/database errors.

## 12. Authorization, privacy, retention and failure recovery

### 12.1 Capability model

- Browser access goes through server routes, not anonymous SQL tables.
- Host/member tokens are HMAC-derived 256-bit hex capabilities; stored room state contains SHA-256 hashes. The host is the member whose token also matches `hostTokenHash`, not a browser-supplied role flag.
- Room IDs are opaque UUID-shaped HMAC-derived identifiers with two fixed hex nibbles (approximately 120 variable bits); do not repeat a precise 128-bit invite-entropy claim. The invite ID conveys redacted read/join access, not write authority over existing members.
- Room cookie: `cl_<sessionId>`, HttpOnly, SameSite=Lax, scoped to `/api/sessions/:id`, maximum age from room TTL. Secure is enabled when the configured public app URL uses HTTPS. Configure that origin correctly; it is not inferred as an independent hosting security guarantee.
- Host tokens never appear in invite URLs. Raw capabilities are not returned in public room views, group messages or traces.
- Stable create/join retries derive identities using the server secret and idempotency/clientJoinId scope. `clientJoinId` is private aggregate metadata, not another person's public recovery token.
- Production requires a stable shared `APP_SECRET` at least 32 characters. Development creates a random `.local/secret` file with restricted permissions. No secrets belong in source control or NEXT_PUBLIC variables.

There is no registration, verified real-world identity, LINE user mapping, account recovery or cross-device seat migration. Anyone obtaining a raw capability can act as that prototype identity; cookie hygiene is part of this access model.

### 12.2 Shared versus private data

| Data                                                                            | Visibility                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Typed group message, author name, system/bot transcript                         | Invite-link group readers; deliberately shared                             |
| Roster, selected/joined state, readiness, current choices                       | Redacted room/group readers                                                |
| Menu assignment, total cost, fit, matched tags and relevant constraint evidence | Group-visible; evidence can reveal aspects of a restriction                |
| Full canonical preference form                                                  | Matching own member view only                                              |
| Private input text/image bytes, private extraction drafts                       | Server/owned workflow; not a public image endpoint                         |
| Rule draft returned from message POST                                           | Author's response only, not chat GET                                       |
| Events/run trace                                                                | Host endpoint; IDs/status/timing and sanitized payload/evidence references |
| Token hashes/idempotency cache/database credentials                             | Private server storage, never public aggregate dump                        |

Do not promise that dietary needs are completely hidden when an evidence row explicitly reflects a relevant exclusion/allergen. The review form discloses group-visible menu/cost/fit/evidence. A user typing a restriction directly into the group has chosen to share that text; it is not retroactively a private form submission.

### 12.3 Limits and expiry

- Mutation Origin, when supplied, must match request origin or configured app origin. A missing Origin is accepted; this is not a universal CSRF/authentication proof.
- Fixed-window, **process-local** request buckets use room+cookie/IP fallback. General mutation checks allow 80/minute; extraction checks allow 8/minute **against the same shared counter**, not a separate independent quota. GET reads are not rate-limited by this implementation. Multi-instance/public deployment needs an ingress/distributed strategy if required.
- Default room TTL: 24 hours; configuration permits positive values up to 168 hours. Access checks reject expired rooms even before physical cleanup.
- Default/max configured upload TTL: 60 minutes. Expired image extraction is denied; room expiry also denies access. The application does not provision an automatic deletion scheduler.
- `npm run cleanup` must run from a trusted worker/manual operation. It removes expired image bytes and input draft/draft ID, then deletes expired rooms and cascaded projections.
- **Cached extraction responses in `requests` can retain derived draft/evidence after image-byte cleanup until room deletion.** Do not claim every image-derived field disappears after one hour.
- Deletion here is logical application/database deletion. Backups, filesystem remnants and provider logs have separate retention; `store:false` is not a guarantee of erasure from every OpenAI record.
- Aggregate data is not application-encrypted. Do not describe database-only image privacy as end-to-end encryption or Supabase Storage security.

### 12.4 Recovery expectations

Preserve previously confirmed values on AI failure; allow retry/manual editing. Preserve required participant count across disconnects. Refresh on conflict before retrying a versioned action. Keep obsolete rank messages as text history but expose actionable controls only for the current ranking.

A session transaction failure commits neither a half-update nor duplicate votes. The UI's confirmed reopen-then-roster-change sequence remains a two-operation limitation described in section 5. Provider call deduplication, complete secret-loss recovery, distributed rate limits and production security review remain separate work.

## 13. Catalog, fixtures and evaluation

### 13.1 Reproducible synthetic catalog

Runtime source: [catalog.seed.json](data/catalog.seed.json), validated by [catalog adapter](src/adapters/catalog.ts). Generator: [generate-catalog.ts](scripts/generate-catalog.ts). SQL seeding upserts stable records; generation does not invent fresh venue IDs on refresh.

| ID  | Exact fictional venue       | Fixture purpose                                      |
| --- | --------------------------- | ---------------------------------------------------- |
| r01 | Demo Mixed Kitchen          | Balanced compatible meals                            |
| r02 | Demo Vegetarian Comfort     | Vegetarian/affordable alternatives                   |
| r03 | Demo Rice & Grill           | Compatible affordable alternatives                   |
| r04 | Demo Premium Bowls          | Feasible initially, removed by demo budget reduction |
| r05 | Demo Spicy Pork             | Ingredient-exclusion failures                        |
| r06 | Demo Delivery Kitchen       | Delivery-only channel                                |
| r07 | Demo Dine-in Plates         | Dine-in-only channel                                 |
| r08 | Demo Closed Hotpot          | Unavailable restaurant                               |
| r09 | Demo Unknown Prices         | Unknown-cost evidence                                |
| r10 | Demo Incomplete Ingredients | Incomplete ingredient evidence                       |
| r11 | Demo Mild Noodle Bar        | Mild/broth preferences                               |
| r12 | Demo Mixed Curry            | Cuisine/texture alternatives                         |

Five items each, total 60, all in `bangkok_demo`, all `dataOrigin:"synthetic"`, catalog `seed-v1`. Exact prices/tags/fees/evidence are in the checked-in JSON, not a marketing text or an LLM completion. No real order, booking or navigation URLs. `verified` on a fixture means the fixture declares evidence; it is not real restaurant safety verification.

Representative actual menu `r01-m01`: Crispy tofu rice, ingredients tofu/rice/soy/oil, complete ingredients, vegetarian fixture evidence; Thai, savory/mild, crispy; dine-in 8,000 and delivery 9,000 satang; inclusive restaurant price. The synthetic r01 delivery quote is 4,000 satang delivery fee plus zero service fee. Full records and exact schemas are linked rather than maintaining a divergent second copy of 60 menus here.

Real catalog/field provenance is future schema work: current Zod/types/env accept synthetic data only. Do not merge made-up menu facts into a real venue or assume setting `CATALOG_MODE=live` enables an adapter.

### 13.2 Four-person demo scenario

These are demo roles, not measured customer behavior or automatically created chat members. Create independent contexts and have each person act personally.

| Member | Text example                      | Confirmed values                                |
| ------ | --------------------------------- | ----------------------------------------------- |
| May    | `อยากกินกรอบ ๆ รสกลมกล่อม งบ180`    | Crispy + savory; max ฿180; optional owned image |
| Nat    | `ไม่กินหมู ขอรสอ่อน งบ160`            | Pork exclusion + mild; max ฿160                 |
| Ploy   | `กินมังสวิรัติ อยากกินน้ำซุปเส้นหนึบ งบ150` | Vegetarian + brothy/chewy; max ฿150             |
| Ton    | `อยากกินเผ็ด งบ200`                 | Spicy; max ฿200, then confirm ฿110              |

For these exact confirmed fixture preferences in both modes:

- Initial top three: **r01, r04, r02**.
- After Ton's ฿110 confirmation: **r01, r02, r03**.
- The winner remains r01. r04 leaves and r03 enters; do not claim a changed winner or hard-code one in the UI.

Different confirmed tags/participants can produce different truthful results. When testing one person, do not promise the four-person ordering. Images in `tests/fixtures/` are self-authored illustrations with provenance, not a photo-recognition benchmark or cached live extraction.

### 13.3 Evaluation corpus and metrics

[data/evaluation.json](data/evaluation.json): 34 authored cases:

- 14 extraction expectation/schema cases: Thai/English budgets, pork, vegetarian, ambiguous เจ/currency, spicy input, empty preferences, text injection, crispy/broth illustrations, irrelevant image, image injection and explicit-form/image conflict.
- 13 small exact ranking fixtures: budget boundary/one-satang excess, unknown prices, incomplete ingredients, known pork, missing diet/cross-contact evidence, inclusive delivery boundary/remainder/unknown quote, no feasible group, changed budget and unavailable channel.
- 4 full-seed scenarios: initial/changed budget in dine-in/delivery. Thus **17 total ranking scenarios**.
- 1 numerical fairness fixture.
- 2 delegated verification cases: stale acceptance and upstream timeout, exercised in integration/mocked adapter suites rather than pretending offline evaluation called a provider.

Latest saved [offline report](docs/evaluation.offline.json):

| Metric                                       | Recorded result                                        |
| -------------------------------------------- | ------------------------------------------------------ |
| Authored cases processed                     | 34                                                     |
| Exact ranking scenarios / determinism checks | 17 passed / 17 passed                                  |
| Numerical score fixture                      | 1 passed                                               |
| Independently checked feasible assignments   | 52/52 valid                                            |
| Detected hard violations in those checks     | 0                                                      |
| Extraction fixture schemas                   | 14 checked                                             |
| Image references / unique illustration files | 5 / 4                                                  |
| Real extraction calls                        | **0**                                                  |
| Ranking-only local timing sample             | 17 samples; max ~2.213 ms, mean ~0.405 ms in saved run |

`npm run eval` does not establish live extraction accuracy. `--live` explicitly attempts labeled provider extraction when configuration exists, with hard-field exact-match denominators, soft-tag precision/recall counts, clarification correctness, failures and caveats. No real-inference accuracy result is available here. Keep extraction metrics separate from deterministic feasibility/fit tests.

Timing samples are small local computations, not API/database/UI latency or venue-network benchmarks. A separate recorded 100-run pure ranking sample averaged ~0.765 ms; do not combine sample sets as one benchmark.

## 14. Tests, recorded results and definition of done

### 14.1 Latest recorded checks

These results were actually obtained during implementation on 18–19 November, before this documentation-only update. This edit does **not** claim a fresh test/deploy/model-access run. Detailed chronology is in [VERIFICATION.md](docs/VERIFICATION.md) and [CODEX_LOG.md](docs/CODEX_LOG.md); older smaller totals in historical sections are superseded below.

| Check                                                           | Latest recorded result                                                                                        | Scope                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run typecheck`                                             | Passed                                                                                                        | Current TypeScript/Next checks                                                   |
| `npm test`                                                      | **98 passed**                                                                                                 | 34 ranking + 15 mocked extraction + 28 chat draft + 21 meal participation        |
| `npm run test:integration`                                      | **45 passed**                                                                                                 | 19 base + 10 chat + 12 meal + 4 replan feedback                                  |
| `npm run test:e2e`                                              | **6 passed**, reported 1.5 minutes                                                                            | Final local production `npm start`, Chromium mobile project                      |
| `npm run eval`                                                  | Passed, 34 cases / 52 checked assignments                                                                     | Offline, zero provider calls                                                     |
| `npm run build`                                                 | Passed                                                                                                        | Production compilation/page generation                                           |
| `npm run db:migrate`, `npm run seed`                            | Passed locally, repeatable                                                                                    | SQLite; 12/60 synthetic catalog                                                  |
| `npm run cleanup`                                               | Executed locally                                                                                              | Observed zero expired records in that execution; no recurring worker provisioned |
| `npm run ai:smoke`                                              | **NOT RUN successfully; exit 1 for absent config**                                                            | Honest unavailable state, not an AI success                                      |
| Browser bundle inspection                                       | No named server credential/hash fields found in `.next/static` at check                                       | Limited inspection, not a penetration test                                       |
| Dependency audit                                                | Last recorded production-only audit: 0 reported; full audit had 5 high findings through dev test dependencies | Dated observation, not a current security guarantee                              |
| Hosted PostgreSQL / public deployment / venue devices / live AI | **Not verified**                                                                                              | No hosted/live success claim                                                     |

Do not sum historic test totals as additional independent current tests. Test inventory changes require updating this table and evidence with actual commands/results.

### 14.2 Six E2E cases

1. Four independent contexts: simulated chat, bot invite, actual meal setup, personal opt-ins, four private reviews, catalog rank, budget replan, current unanimity, summary/copy and reload identity/persistence.
2. Three-context selected subset: no-match at budget zero, own-budget recovery without losing pork exclusion, bystander cannot vote/contribute, opening/cancelling setup preserves state, adding the bystander requires their own opt-in/confirmation and rerank.
3. Replan feedback: nonbinding budget edit creates a fresh ranking even though options remain identical; current update notice is in the viewport and survives reload.
4. Original web dine-in flow with four independent contexts, private image upload/manual labels, evidence, replan, finalization and refresh.
5. Original web delivery equivalent, inclusive costs and four-context consensus.
6. Original web zero-budget no-match/manual recovery.

Clipboard success was explicitly exercised with host focus and browser clipboard permission; earlier fallback-only checks were not called successful clipboard verification. Local browser contexts are not four physical venue devices.

### 14.3 Required regression invariants

- Budget exactly ฿150 passes; ฿150.01 fails at that maximum. No floating money drift.
- Unknown item/quote cannot pass a finite budget. Delivery satang remainders reconcile exactly.
- Pork presence/incomplete ingredients/unknown restrictions fail relevant hard exclusions.
- Missing verified diet, allergen absence or cross-contact proof fails strict eligibility.
- One feasible assignment for every selected active participant; no bystander fee subsidy or bot vote.
- Neutral preferences, family renormalization, soft-dislike cap, numerical fairness trade-off and stable menu/restaurant ties.
- Duplicate join/write and same-key/different-body conflict; actor cannot edit another person.
- Host selection never substitutes for personal opt-in; selected nonresponders block rank; coordinator need not vote.
- Old extraction cannot override newer explicit inputs or re-add a removed participant; polling never invokes AI.
- Roster change invalidates results/votes while retaining existing people's confirmed hard fields/consent as specified.
- Fresh ranking ID matters even with identical P/R and identical recommendations; stale vote rejection persists.
- Current unanimity, availability revalidation and one committed finalize under concurrency.
- Refresh/reconnect persistence, room/image expiry, no public image route, malformed JSON, Origin/body limits and manual recovery.
- Setup preview/cancel performs no server write; confirmed two-step reopen limitations remain visible.

### 14.4 Completion criteria

**Current local prototype acceptance:** new chat meal flow, manual/rules confirmation, deterministic synthetic recommendations, replanning, subset consent, persistent unanimous finalization and defined local tests are implemented/verified as recorded.

**Full hosted/live-AI definition of done is not met:** it additionally requires an actual deployed PostgreSQL-backed four-device flow, scheduled cleanup, configured/smoke-tested live extraction with a reviewed real draft, provider/venue-network checks and actual deployment evidence. These are remaining verification/setup requirements, not silently completed features.

Usability/hypothesis work remains: test with real groups without a facilitator, comprehension of trade-offs and evidence sharing, dietary-form clarity, consent flow completion, no-match recovery and whether unanimous approval fits real use. Do not call fixture scores or a successful demo a user study.

## 15. Installation, configuration, operation and deployment

### 15.1 Dependencies and reproducibility

Node.js 22.12+ recommended; recorded host 22.23.1/npm 10.9.8. Use npm and preserve `package-lock.json`. Locked direct runtime/tool versions at this update:

| Package                     | Lockfile version          |
| --------------------------- | ------------------------- |
| Next.js / React / React DOM | 16.4.6 / 19.3.1 / 19.3.1  |
| TypeScript / Zod            | 5.9.3 / 4.6.7             |
| OpenAI SDK                  | 7.59.0                    |
| better-sqlite3 / pg / Sharp | 13.2.0 / 8.23.1 / 0.35.5  |
| Vitest / Playwright         | 5.1.1 / 1.65.1            |
| tsx / dotenv / Prettier     | 4.23.15 / 17.4.2 / 3.10.1 |

These are inspected installed/locked versions, not promises of latest upstream versions. `package.json` ranges and lockfile are authoritative for a future install.

### 15.2 Local bootstrap

```sh
npm install
cp .env.example .env
# Set a random APP_SECRET in .env for production; generate with:
openssl rand -hex 32
npm run db:migrate
npm run seed
npm run dev
```

Open `http://localhost:3000`, create a simulated group and share its `/line/:id` URL into independent contexts. For multiple devices, use a reachable configured origin; secure-browser features such as clipboard/photo handling may require HTTPS outside localhost.

Generate a secret and save it privately; never paste it into a tracked document/log. An existing configured `.env` should not be overwritten blindly. Development can create its local secret automatically, but production intentionally rejects missing/short `APP_SECRET` through boot instrumentation/runtime validation.

Production locally: stop dev, run `npm run build`, then `npm start`. **Do not build concurrently with an active dev/browser QA run**: this project previously encountered repeated HMR navigation/reloads. Wait for source edits to settle before E2E; run build/start and tests sequentially.

### 15.3 Environment contract

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
PERSISTENCE_DRIVER=sqlite
SQLITE_PATH=.local/craveloop.sqlite
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
APP_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=
CATALOG_MODE=synthetic
DEMO_MODE=true
SESSION_TTL_HOURS=24
UPLOAD_TTL_MINUTES=60
```

| Variable                                    | Actual interpretation                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                       | Public invite/cookie-Origin configuration; valid URL, default localhost; not a secret                                           |
| `PERSISTENCE_DRIVER`                        | sqlite/postgres; if omitted choose postgres when DATABASE_URL is nonempty, otherwise sqlite; explicit value overrides inference |
| `SQLITE_PATH`                               | Default durable local file `.local/craveloop.sqlite`                                                                            |
| `DATABASE_URL`                              | Required for postgres; trusted server connection/pooler URL with provider-appropriate TLS                                       |
| `APP_SECRET`                                | Stable shared HMAC secret; production minimum 32 characters                                                                     |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Unused/reserved placeholders for a future integration; **not required by the current direct-pg adapter**                        |
| `OPENAI_API_KEY`, `OPENAI_MODEL`            | Optional draft extraction configuration; no model default; presence does not establish access                                   |
| `CATALOG_MODE`, `DEMO_MODE`                 | Only synthetic / true currently accepted                                                                                        |
| `SESSION_TTL_HOURS`                         | Positive number, max 168, default 24                                                                                            |
| `UPLOAD_TTL_MINUTES`                        | Positive number, max 60, default 60                                                                                             |

Only deliberately public app configuration belongs in NEXT_PUBLIC variables. Validate environment at Node server boot via `instrumentation.ts`; this validates configuration, not DB/model connectivity. The application rejects SQLite when `VERCEL` is present. No LINE credentials are needed or consumed.

### 15.4 Commands

```sh
npm run db:migrate              # sorted SQL files, configured driver
npm run seed                    # idempotent synthetic catalog upsert
npx tsx scripts/generate-catalog.ts
npm run dev
npm run typecheck
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run eval                    # offline default
npm run eval -- --live          # explicit provider calls, configuration required
npm run ai:smoke                # live text+owned illustration sample, or honest failure
npm run cleanup                # trusted worker/manual use
npm run build
npm start
```

Integration tests use isolated temporary SQLite files. Browser tests create demo rooms in the running local database; use disposable/safe demo data. Playwright reuses a server on port 3000 when not CI, otherwise can bootstrap migrate/seed/dev. `CI=1` does not authorize reusing an occupied server. Screenshots/traces/reports in ignored `test-results`/`playwright-report` may contain test conversation data.

`ai:smoke` checks a configured sample's schema/explicit fields, not broad photo accuracy, allergy safety or SLA. Offline fixtures/illustrations may not be represented as a live response or a live network outage recovery result.

### 15.5 PostgreSQL/Supabase and hosting checklist

Prepared path, not a deployment claim:

1. Provision trusted PostgreSQL, optionally a Supabase project. Set explicit postgres driver, DATABASE_URL, stable shared secret and the real HTTPS public origin. Apply provider TLS/pooler requirements.
2. Run migrations and seed against that actual connection; validate RLS/server-role access. SQL projections are private; never expose service/database credentials to browsers.
3. Deploy the Node Next.js app. Do not use an ephemeral SQLite filesystem as hosted multi-instance persistence. The current adapter does not require a Supabase JS client or Storage bucket.
4. Configure model/key only if real extraction is wanted; run smoke and labeled live checks against actual access.
5. Provision a trusted recurring cleanup worker, e.g. every five minutes with the same driver/connection. This interval is an operational recommendation, not a scheduler already created by the repo. No public cleanup endpoint is shipped.
6. Run actual HTTPS multi-device meal setup/opt-in/ranking/replan/consensus, expiry and privacy checks. Measure venue-network freshness and extraction latency separately.
7. Record deployment URL, source revision/commit if available, environment/capacity facts without secrets, test results, catalog/algorithm versions and limitations.

No Git commit, public deployment, hosted verification or competition submission was created/verified by the recorded work. Merely having migrations and an adapter is not proof the hosted database works.

## 16. Demo, pitch and competition readiness

### 16.1 Current 3–4 minute storyboard

Use an actual shared simulated group and four independent participant contexts. Prepare contexts/owned illustration before the timed slot. This is a suggested script; no successful timed rehearsal or hosted demo is claimed.

| Elapsed   | Action                                                               | Observable evidence                                                               |
| --------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 0:00–0:30 | Explain four distinct needs, create/share group and invite CraveLoop | Simulation label, real independent identities/transcript                          |
| 0:30–1:00 | Host selects actual four people, common zone/mode and confirms setup | Combined setup; host selection is not consent                                     |
| 1:00–1:35 | Each joins the meal personally, reviews and confirms their values    | Named readiness, inclusive budget and explicit restrictions                       |
| 1:35–2:00 | Host searches; inspect recommendation card                           | Catalog IDs, one feasible menu/person, exact cost and fit                         |
| 2:00–2:35 | May accepts; Ton changes ฿200→฿110 and confirms                      | Fresh version/ranking, old vote cleared, r04 removed/r03 enters; r01 stays winner |
| 2:35–3:10 | All accept r01; host finalizes, copy and refresh                     | Current unanimity, persistent conversation/result                                 |
| 3:10–3:45 | Explain algorithm, Codex evidence and current limits                 | Actual test record; rules/manual versus optional AI clearly distinguished         |

If demonstrating unchanged output, use a genuinely nonbinding budget edit and point to the new version/time plus unchanged acknowledgement. Do not press search repeatedly expecting randomized alternatives. Optional second scenario: two selected people in a three-person group, budget zero no-match, own-budget recovery preserving exclusion, then add the bystander and require their consent/confirmation.

Use [DEMO_MEAL_FLOW.md](docs/DEMO_MEAL_FLOW.md) for the current meal script. [DEMO_CHAT.md](docs/DEMO_CHAT.md) and [DEMO.md](docs/DEMO.md) describe earlier phases and omit some current setup gates; they are historical companion material, not the primary flow contract.

### 16.2 Truthful opening and explanation

Suggested Thai opening:

> กลุ่มเพื่อนอยากกินไม่เหมือนกัน และแต่ละคนมีงบกับข้อจำกัดต่างกัน CraveLoop เป็นผู้ช่วยในแชทจำลอง ให้ทุกคนยืนยันความต้องการของตัวเอง แล้วเสนอร้านพร้อมเมนูที่ผ่านเงื่อนไขให้ทุกคน วันนี้ร้าน เมนู และราคาเป็นข้อมูลสมมติครับ

Current technical explanation:

> ตัวช่วยในแชทใช้กฎเพื่อเสนอร่างที่แก้ไขได้ ส่วนโค้ดตรวจข้อห้าม งบรวมค่าธรรมเนียม และจัดอันดับด้วย 60% ค่าเฉลี่ยบวก 40% คะแนนต่ำสุด ทุกคนต้องยอมรับร้านเดียวกันในผลล่าสุด จึงสรุปได้ เราเตรียม OpenAI สำหรับอ่านข้อความและภาพในฟอร์มส่วนตัวไว้ แต่ยังไม่ได้ยืนยันการเรียกจริงในสภาพแวดล้อมนี้

Only describe actual live model extraction after a successful configured call. Keep recording/cached/fixture/manual labels explicit. Do not claim real LINE delivery, live menus, safety certification, ordering, partnerships, user adoption, reduced decision time or competition success.

Q&A positions:

- **Why a chat companion?** Match the team's intended coordination context; the current independent browser simulation tests that interaction without an external platform dependency.
- **Why deterministic ranking?** Confirmed hard constraints, inclusive cost and tie-breaks must be testable and cannot be overridden by model prose.
- **Why synthetic data?** Test menu-level group feasibility honestly while verified real-data sourcing remains unresolved.
- **Why 60:40?** Transparent prototype trade-off, not a universal optimum or user study.
- **Why unanimity?** Every participating person has both a feasible assignment and an explicit current acceptance; bystanders/bot do not decide for them.
- **What did Codex contribute?** Point to actual bounded tasks, code changes, failures, fixes and recorded tests; distinguish agent review from human review.

### 16.3 Event context and work provenance

Version 1 records an organizer page checked on **18 November 2026**: [event page](https://luma.com/39zve8ph?locale=th). It recorded 21 November, Bangkok, hacking 10:00 and freeze/submission 17:00; teams of 3–4; judging problem framing, build quality, depth of thinking and effective Codex use. It also recorded existing projects allowed as starting points, with new significant development during the event judged. These organizer details were **not revalidated for this document update**; recheck before relying on them.

This implementation, fixtures and tests were actually created on **18–19 November, before that recorded event date**. Treat them as pre-existing work. The earlier “planning only before event” proposal is not a claim of what happened. Do not represent these files/tests as new competition-day development. Maintain a baseline and clearly log later permitted event work; no submission or organizer approval is implied.

### 16.4 Proposed seven-hour event-day readiness plan

Historical time window only, subject to actual organizer rules/updates and what preparation is permitted. Unlike the original greenfield schedule, the baseline now exists; this is **proposed future work**, not an executed agenda.

| Bangkok time, 21 November | Focus                                                                      | Exit evidence                                                  |
| ------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 10:00–10:20               | Record pre-existing baseline, actual permissions and remaining scoped work | Reproducible current contracts/run; no misattributed prep      |
| 10:20–11:10               | Resolve actual persistence/deployment access and blockers                  | Real configured environment or clearly retained local fallback |
| 11:10–12:00               | Verify four-device meal setup/consent/current recommendations              | Actual network/device evidence, not only contexts              |
| 12:00–12:45               | Smoke-test optional text/image AI if configured                            | Reviewed real draft or explicitly manual demo                  |
| 12:45–13:30               | Replan/unchanged/no-match/consensus/cleanup checks                         | No hard violations or stale consent in required scenarios      |
| 13:30–14:30               | Fix usability and real hosted/environment gaps                             | Stable primary flow; evidence/retention labels match behavior  |
| 14:30–15:15               | Regression/security and feature freeze                                     | Required checks passed; optional work cut                      |
| 15:15–16:15               | Timed rehearsal and factual evidence package                               | Actual rehearsal results; final known issues                   |
| 16:15–17:00               | Allowed final fixes, packaging and submission                              | Actual revision/URL/submission acknowledgement if performed    |

Cut live discovery, bot integration, deals and optional generated explanations first. If AI remains unavailable, demonstrate rules/manual honestly. Never cut participant consent, hard checks, persistence or versioned consensus to add a showcase feature.

## 17. Team ownership and actual Codex evidence

One integration owner controls shared contracts, schema, package/lockfile and central routing. Freeze module interfaces before independent edits; notify dependents of changes. Prefer small reviewed integration slices and isolated ownership; preserve unrelated work. Use worktrees/branches when available and appropriate, but do not claim these were used when the actual work shared one workspace.

| Owner    | Current development responsibility                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------ |
| A        | Primary chat/home UI, setup/review/results, mobile behavior and accessible action labels               |
| B        | Draft understanding/AI adapter/evaluation or isolated participation helpers, depending on bounded task |
| C        | Catalog/ranking tests and later focused integration/E2E verification, depending on bounded task        |
| D / root | Contracts, authorization, persistence, APIs, integration, final verification and documentation         |

These are task owners, not asserted human teammate biographies. Actual delegated boundaries changed per phase and are recorded in [CODEX_LOG.md](docs/CODEX_LOG.md), [CONTRACTS.md](docs/CONTRACTS.md), [CHAT_CONTRACTS.md](docs/CHAT_CONTRACTS.md) and [MEAL_FLOW_CONTRACTS.md](docs/MEAL_FLOW_CONTRACTS.md). The older notes are context; current source/current master resolve contract evolution.

The evidence log should record date/timezone, bounded prompt/scope, files/change or commit if one exists, review type, commands actually run, failure, correction, outcome and remaining limits. No fabricated human review, provider call, deployment or commit. Human product/code review is still distinct from the recorded agent/tool checks.

Actual issues found/corrected include: CommonJS top-level-await bootstrap failure; in-progress JSX/type errors; vulnerable initial Sharp dependency update; E2E decorative-arrow selector mismatch; hidden-tab stale snapshots; concurrent dev/build HMR loop; setup opening prematurely invalidating votes; and unchanged-replan/scroll feedback. Keep these as actual learning evidence rather than a polished invented narrative.

No source commit or public submission was created by the recorded task. The documentation audit for version 2 is read-only against app behavior: it does not authorize changing user room preferences, manufacturing model responses or claiming another test run occurred.

## 18. Explicit continuation instructions for Codex

This section supersedes the original “bootstrap a new prototype” prompt. The app already exists; future work must continue it, not replace it with a mockup or re-create the old web-first flow.

```text
Read CRAVELOOP_MASTER_SPEC.md version2 in full, then inspect applicable AGENTS.md,
current source/contracts/migrations and the relevant evidence logs. Preserve
unrelated work. Distinguish current implemented behavior, recorded local checks,
externally unverified adapters and future proposals. Do not claim hosted/AI/LINE
success from mocks, fixtures, credentials being present or a successful build.

The primary UX is a LINE-style SIMULATION, not a real LINE integration. Keep
/web and /s/:id compatibility. New primary groups send experience:"chat".
Respect group membership vs host-selected meal roster vs individual consent.
Each selected active participant must personally join and confirm; bystanders
and the bot do not enter scoring, fee shares or unanimity. Host may coordinate
without being a meal participant. No silent removal of nonresponders.

Inspect/freeze shared Zod types, success/error envelopes, version behavior and
file ownership before parallel edits. Use subagents only when the user or an
applicable instruction has authorized delegation. Keep one integration owner;
do not let concurrent tasks edit contracts, migrations or package lock freely.
Read the installed Next.js documentation required by generated AGENTS.md before
changing affected framework APIs. Use the relevant official OpenAI documentation
when changing its adapter; never select or claim an unverified model silently.

Retain pure deterministic feasibility, integer-satang inclusive costs, exact
fee allocation, 60:40 fit and deterministic tie-breaks over versioned catalog
facts. Every option needs a feasible catalog menu for every meal participant.
Never invent facts, bypass an allergy/diet/budget, or randomize a new winner just
to make replanning look active. Explain changed and unchanged results truthfully.

Keep private draft generation separate from canonical confirmation. Chat rules
are not AI. Real extraction uses only server credentials and owned private inputs;
a late response cannot overwrite new values or restore a removed participant.
Missing AI must leave a usable manual path. No video/reels ingestion, social
scraping, payments, orders, live discovery or real LINE setup unless explicitly
newly scoped by the user.

All writes need actor authorization and idempotency; versioned writes also need
expectedP/R and own member revision as specified. Confirmed changes invalidate
old rankings/acceptances. Fresh ranking IDs matter even when P/R and choices are
unchanged. Finalization requires current unanimous participant consent and a
transactional feasibility recheck. Setup preview/cancel does not mutate state.

Use actual persistent adapters, not an in-memory hosted store. DirectPostgreSQL
and hosted behavior must be exercised before marking them verified. Keep images
private; cleanup/backup/provider retention claims must match implementation.
Do not treat SQL catalog edits as live changes to the imported seed adapter.

Run appropriate meaningful regression checks and report actual results. Stop
dev/browser QA before production build to avoid the observed HMR loop. Update
master/README/env/migrations/fixtures/demo/evidence when a behavioral contract
changes. Do not claim a test ran merely because an older count appears in docs.
Keep an explicit done/notdone/untested list and reproducible handoff.
```

### Continuation exit gates

1. Exact requested change and acceptance behavior understood; local guidance/source inspected.
2. Additive contracts and owner scopes agreed before independent implementation.
3. Complete vertical slice wired to actual authorization/persistence, with safe errors/manual fallback.
4. Appropriate deterministic/API/browser regression evidence, including stale state and selected-person denominator where relevant.
5. Typecheck/build and required tests actually executed when implementation changes warrant them.
6. Current documentation, runnable commands, measured results and remaining setup/risks disclosed.

For a **documentation-only** request, validate facts, structure, links and claims; do not mutate app/user data or rerun live services simply to manufacture new evidence.

## 19. Limitations, roadmap, sources and decision register

### 19.1 Known limits to retain in handoff

1. Independent browser simulation only; no real LINE messaging, identity or delivery verification.
2. Synthetic-only single-area catalog, 12/60 records; no real menu safety/price/location claims. Runtime seed, not editable SQL rows, drives ranking.
3. Current group cap five, expected demo four; one revisable meal per room. No parallel/history meal product or self-leave-meal API.
4. Rules-only group understanding with limited vocabulary/negation/list parsing; private model adapter unverified. Images are optional private inputs, not shared chat photo messages; no video/URL processing.
5. Null budget explicitly allows unknown cost with warnings; finite budgets fail unknown costs. Allergy/diet evidence can produce no-match. Soft ingredient dislikes are not ingredient prohibitions.
6. Freshly computed results can remain identical; “other options” is navigation within the current set, not unexplored live discovery.
7. Some private form labels/errors remain English; UI composer is disabled after finalization even though API messaging can return guidance.
8. Group/meal reconfiguration is confirmed reopen then setup as two requests. Cancel before confirmation is safe; failure after reopen can leave agreement cleared.
9. SQLite/local durability verified; actual PostgreSQL, multi-instance deployment, public origin/TLS, hosted four-device and venue-network behavior remain unverified.
10. Process-local shared-counter limiting only; no distributed abuse prevention or account identity/recovery. Invite reads expose intentionally shared transcript/results.
11. Private image TTL access checks exist, but physical deletion needs external cleanup. Derived cached draft/evidence may outlive image bytes until room deletion. No application encryption or universal backup/provider erasure guarantee.
12. Credential presence is not service/model health. Duplicate concurrent extraction can incur duplicate provider work, even with one committed application outcome.
13. Projection occurrence timestamps are regenerated; aggregate/events hold application history. No formal migration-history ledger or independent projection editing workflow.
14. Local test/fixture success is bounded evidence, not a safety certification, performance SLA, usability study or hosted/live-provider proof.
15. Actual code predates the recorded competition date. No human-team credentials, event-time development, prize likelihood or submission success may be inferred.

### 19.2 Recommended next work, not completed promises

| Priority                   | Work                                                                                    | Evidence required before changing status                                 |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Next                       | Human usability review of consent/setup/private form and unchanged-result understanding | Real group observations and issue outcomes                               |
| Next if hosting requested  | Provision and test PostgreSQL/HTTPS hosting/cleanup                                     | Actual migration, device flow, retention and deployment record           |
| Next if AI requested       | Configure a supported model, smoke and labeled real extraction tests                    | Real provider responses/metrics; editable confirmation preserved         |
| Reliability                | Consider one transactional API for confirmed reopen+meal configuration                  | Concurrency/failure/cancel tests and migration/contract review           |
| Privacy/operations         | Review cached draft retention, public transcript access, rate limits and recovery       | Explicit product decisions plus implemented tests/controls               |
| Data                       | Rights/provenance for verified real menu/price/ingredient/fee records                   | Actual licensed data adapter, schema/versioning and fail-closed evidence |
| Later, only explicit scope | Real LINE integration, richer discovery, video or orders                                | Separate platform/permission/safety/product design and verification      |

No future item silently broadens the current task. Questions to resolve before real adoption: group feedback/unanimity preference, supported diet vocabulary, privacy expectations, actual catalog rights, API model access, device/network conditions, competition updates and human team ownership.

### 19.3 Sources and current evidence hierarchy

- [Shared types](src/contracts/index.ts), [chat contracts](src/contracts/chat.ts), [schema migrations](supabase/migrations/001_initial.sql), [chat migration](supabase/migrations/002_chat_simulation.sql), [meal migration](supabase/migrations/003_meal_participation.sql): executable contracts inspected for this update.
- [README](README.md), [verification](docs/VERIFICATION.md), [Codex log](docs/CODEX_LOG.md), [offline evaluation result](docs/evaluation.offline.json): reproduction and recorded evidence; historical smaller test runs are not the current total.
- [Meal flow integration notes](docs/MEAL_FLOW_CONTRACTS.md), [current meal demo](docs/DEMO_MEAL_FLOW.md): useful detail; current source/master include subsequent cancel/replan feedback corrections.
- [Complete version1 archive](docs/archive/CRAVELOOP_MASTER_SPEC.v1.0-2026-11-18.md): original source history, proposed schedule/storyboard and initial greenfield contracts. Preserved, not current behavior.
- Historical external references from implementation/planning: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Responses overview](https://developers.openai.com/api/reference/responses/overview), [LINE group-chat documentation](https://developers.line.biz/en/docs/messaging-api/group-chats/), [organizer page](https://luma.com/39zve8ph?locale=th). Previously consulted as recorded on18November; not re-fetched or represented as freshly verified platform/event facts during this documentation update.

No private uploaded inputs, raw capabilities, database/API credentials or current user's personal restrictions belong in this master specification. Examples are fictional fixtures.

### 19.4 Decision register

| Decision                                             | Status / rationale                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Companion in familiar group context                  | Approved user direction; browser LINE-style simulation now               |
| Real LINE connection omitted                         | Explicit user instruction for current prototype                          |
| Separate group/selected roster/own consent           | Approved19November flow; prevents host selecting on someone's behalf     |
| Shared zone/mode at meal setup                       | Approved; single synthetic catalog zone currently                        |
| Private editable review before canonical use         | Core invariant for rules, manual and optional AI                         |
| AI understands; deterministic code decides           | Optional AI is draft-only; actual chat helper rules are labeled          |
| Synthetic seed as runtime source                     | Honest, reproducible feasibility/evaluation without live-data invention  |
| One item per participant                             | Independent best-menu selection remains valid for this bounded model     |
| Inclusive integer satang + equal known fee shares    | Deterministic budget boundaries and exact reconciliation                 |
| Mean60% + minimum40%                                 | Transparent heuristic, not universal fairness proof                      |
| Personal current acceptance + unanimity              | Everyone participating explicitly agrees; bystanders/bot do not vote     |
| Versioned transactional writes and fresh ranking ID  | Prevent stale ranks/votes and duplicate committed state                  |
| Explain identical replans rather than rotate choices | Correctness and user feedback without fabricating change                 |
| SQLite local + direct PostgreSQL adapter             | Local persistence verified; hosted adapter prepared and unverified       |
| Private DB image storage + external cleanup command  | Actual implementation; Storage/provider retention not overstated         |
| Polling before realtime integrations                 | Small complete slice; GETs perform no hidden AI/ranking work             |
| Preserve legacy routes/contracts                     | Avoid discarding earlier working implementation and data                 |
| Current master2 + archived master1                   | Complete handoff without confusing historical plans with actual behavior |

**Maintenance rule:** when product flow, API, schema, algorithm, status or verification changes, update the relevant section and evidence together. Preserve the difference between what is intended, what is implemented, what has actually been checked and what still needs the user/provider to configure.
