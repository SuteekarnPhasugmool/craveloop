import {
  GRAPH_VERSION,
  describeIngredientPath,
} from "@/domain/ingredient-graph";
import { simulateNoodleChoice } from "@/domain/guided-choice";
import {
  NoodlePreviewSchema,
  type NoodlePreview,
} from "@/contracts/group-order";
import { rankingUpdate } from "@/domain/ranking-feedback";
import { mealMembers, mealReady, assertMealParticipant } from "@/domain/meal";
import { availableDishes } from "./group-menu";
import { appendChatEvent } from "./chat-events";
import { randomUUID } from "node:crypto";
import {
  CreateSchema,
  JoinSchema,
  ConfirmSchema,
  PatchSchema,
  RankSchema,
  ChoiceSchema,
  ExtractSchema,
  type SessionView,
  type Versions,
  type Ranking,
  type Preference,
} from "@/contracts";
import {
  catalog,
  CATALOG_VERSION,
  ALGORITHM_VERSION,
  currentSnapshot,
} from "@/adapters/catalog";
import { rankRestaurants } from "@/domain/ranking";
import { aiStatus, extractPreferences } from "@/adapters/openai";
import { env } from "./env";
import { AppError, assert } from "./errors";
import { hash, derive, stableId, matches } from "./auth";
import { transact, readSession } from "./database";
import type { StoredSession, StoredMember, StoredInput } from "./state";
const now = () => new Date().toISOString();
export type Context = { token?: string; key: string };
export function requireSession(
  s: StoredSession | null,
): asserts s is StoredSession {
  assert(s, 404, "NOT_FOUND", "Room not found");
  assert(
    Date.parse(s.expiresAt) > Date.now(),
    401,
    "ROOM_EXPIRED",
    "This room expired. Create a new room.",
  );
}
export function actor(s: StoredSession, c: Context, host = false) {
  const m = s.members.find((m) => m.active && matches(c.token, m.tokenHash));
  assert(m, 401, "CAPABILITY_REQUIRED", "Join this room to make changes.");
  if (host)
    assert(
      matches(c.token, s.hostTokenHash),
      403,
      "HOST_REQUIRED",
      "Only the host can do this.",
    );
  return m;
}
export function versions(
  s: StoredSession,
  v: { expectedPreferenceVersion: number; expectedRosterVersion: number },
) {
  assert(
    s.preferenceVersion === v.expectedPreferenceVersion &&
      s.rosterVersion === v.expectedRosterVersion,
    409,
    "STALE_VERSION",
    "Room changed. Refresh and review before trying again.",
  );
}
export function event(
  s: StoredSession,
  type: string,
  payload: Record<string, unknown> = {},
) {
  appendChatEvent(s, type, payload);
  s.events.push({
    id: randomUUID(),
    type,
    version: s.preferenceVersion,
    createdAt: now(),
    payload,
  });
}
export function invalidate(s: StoredSession, reason: string) {
  delete s.preliminaryRestaurants;
  delete s.menuChoices;
  if (s.handoff) s.handoff.status = "invalidated";
  s.currentRankingId = null;
  s.acceptances = [];
  s.finalizedOptionId = null;
  s.status = "collecting";
  s.lastChange = reason;
}
export function editable(s: StoredSession) {
  assert(
    s.status !== "finalized",
    409,
    "ROOM_FINALIZED",
    "Host must reopen the room before changes.",
  );
}
function snapshot(s: StoredSession, participants = mealMembers(s)) {
  return {
    preferenceVersion: s.preferenceVersion,
    rosterVersion: s.rosterVersion,
    areaId: s.areaId,
    mode: s.mode,
    catalogVersion: CATALOG_VERSION,
    members: participants.map((m) => ({
      id: m.id,
      preference: m.preference!,
    })),
  };
}
function computeRanking(
  s: StoredSession,
  previousRankingId: string | null = s.currentRankingId,
) {
  assert(
    mealReady(s),
    422,
    "MEMBERS_NOT_READY",
    "สมาชิกที่เลือกทุกคนต้องเข้าร่วมมื้อนี้และยืนยันความต้องการก่อนค้นหาร้าน",
  );
  const start = performance.now();
  s.status = "ranking";
  const result = rankRestaurants(snapshot(s), catalog);
  const ranking: Ranking = {
    ...result,
    id: randomUUID(),
    preferenceVersion: s.preferenceVersion,
    rosterVersion: s.rosterVersion,
    catalogVersion: CATALOG_VERSION,
    graphVersion: GRAPH_VERSION,
    algorithmVersion: ALGORITHM_VERSION,
    createdAt: now(),
  };
  ranking.update = rankingUpdate(
    ranking,
    s.rankings.find((r) => r.id === previousRankingId) ?? null,
  );
  s.rankings.push(ranking);
  s.currentRankingId = ranking.id;
  s.acceptances = [];
  // Auto-search can happen before an invited friend has opened the link.
  if (!s.chatJourney) s.membershipOpen = false;
  s.status = "voting";
  s.runs.push({
    id: randomUUID(),
    name: "rank_restaurants",
    snapshotVersion: s.preferenceVersion,
    status: result.status,
    durationMs: performance.now() - start,
    evidenceIds: result.options.flatMap((o) =>
      o.assignments.map((a) => a.menuId),
    ),
    createdAt: now(),
  });
  event(s, "ranking_published", {
    rankingId: ranking.id,
    status: result.status,
  });
  return ranking;
}
export function rankReadyChatMeal(s: StoredSession) {
  if (s.chatJourney && s.status === "collecting" && mealReady(s)) computeRanking(s);
}
function previewConfirmedRestaurants(s: StoredSession) {
  const confirmed = mealMembers(s).filter(member =>
    member.confirmed && member.preference && s.chat?.meal?.joinedMemberIds.includes(member.id)
  );
  assert(confirmed.length > 0, 422, "NO_CONFIRMED_MEMBERS", "รออย่างน้อยหนึ่งคนยืนยันก่อนค้นหา");
  s.preliminaryRestaurants = rankRestaurants(snapshot(s, confirmed), catalog).options.map(o => o.restaurantName);
}
export function view(s: StoredSession, token?: string): SessionView {
  const me = s.members.find((m) => m.active && matches(token, m.tokenHash));
  const memberView = (m: StoredMember) => ({
    id: m.id,
    displayName: m.displayName,
    confirmed: m.confirmed,
    active: m.active,
    revision: m.revision,
  });
  const rankingIndex = s.rankings.findIndex((r) => r.id === s.currentRankingId);
  const currentRanking = s.rankings[rankingIndex];
  const stale = currentRanking && !currentSnapshot(currentRanking);
  const visibleRanking =
    currentRanking && !stale
      ? {
          ...currentRanking,
          update:
            currentRanking.update ??
            rankingUpdate(currentRanking, s.rankings[rankingIndex - 1] ?? null),
        }
      : null;
  // Platform group summaries never need private hard-constraint proof records.
  // Keep the authoritative ranking unchanged for transactional revalidation.
  if (visibleRanking && s.experience === "group_order") {
    visibleRanking.options = visibleRanking.options.map((option) => ({
      ...option,
      assignments: option.assignments.map((assignment) => ({
        ...assignment,
        constraintEvidence: [],
      })),
    }));
    visibleRanking.rejections = Array.from(
      new Map(
        visibleRanking.rejections.map((r) => {
          const code = r.code.includes("BUDGET")
            ? "BUDGET_EXCEEDED"
            : /UNKNOWN|MISSING|INCOMPLETE/.test(r.code)
              ? "INSUFFICIENT_CATALOG_DATA"
              : /AREA|CHANNEL|RESTAURANT_UNAVAILABLE|NO_AVAILABLE_MENU/.test(
                    r.code,
                  )
                ? "UNAVAILABLE"
                : "CONSTRAINT_NOT_MET";
          return [
            `${r.restaurantId}:${code}`,
            { restaurantId: r.restaurantId, code },
          ];
        }),
      ).values(),
    );
  } else if (visibleRanking) {
    visibleRanking.rejections = visibleRanking.rejections.map((r) =>
      r.graphFacts && r.memberId !== me?.id
        ? { code: "CONSTRAINT_NOT_MET", restaurantId: r.restaurantId }
        : r,
    );
  }
  return {
    id: s.id,
    ...(s.chatJourney
      ? {
          chatJourney: true,
          ...(me
            ? {
                messages: s.chat?.messages,
                preliminaryRestaurants: s.preliminaryRestaurants,
                menuChoices: s.menuChoices ?? {},
                dishes: visibleRanking?.options
                  .filter((o) => o.restaurantId === s.finalizedOptionId)
                  .flatMap((o) => availableDishes(o, me)),
              }
            : {}),
        }
      : {}),
    ...(s.experience ? { experience: s.experience } : {}),
    ...(s.handoff
      ? {
          handoff:
            stale || !currentSnapshot(s.handoff)
              ? { ...s.handoff, status: "invalidated" as const }
              : s.handoff,
        }
      : {}),
    ...(s.chat?.meal ? { meal: s.chat.meal } : {}),
    areaId: s.areaId,
    mode: s.mode,
    status: s.status,
    expectedSize: s.expectedSize,
    membershipOpen: s.membershipOpen,
    members: s.members.map(memberView),
    me: me ? { ...memberView(me), preference: me.preference } : null,
    ...(me && currentRanking && !stale
      ? {
          ingredientProofs: [
            ...new Set(
              currentRanking.rejections.flatMap((r) => {
                if (r.memberId !== me.id || !r.menuId || !r.graphFacts)
                  return [];
                const proof = describeIngredientPath(r.menuId, r.graphFacts);
                return proof ? [proof] : [];
              }),
            ),
          ],
        }
      : {}),
    isHost: matches(token, s.hostTokenHash),
    ranking: visibleRanking,
    acceptances: stale ? [] : s.acceptances,
    preferenceVersion: s.preferenceVersion,
    rosterVersion: s.rosterVersion,
    finalizedOptionId: stale ? null : s.finalizedOptionId,
    lastChange: stale
      ? "ข้อมูลเมนู กราฟ หรือวิธีคำนวณเปลี่ยนแล้ว ผู้ดูแลต้องคำนวณใหม่ หากปิดมื้อแล้วให้เปิดมื้ออีกครั้ง"
      : s.lastChange,
    ai: s.chatJourney ? { available: false, model: null } : aiStatus(),
    expiresAt: s.expiresAt,
    dataOrigin: "synthetic",
    catalogVersion: CATALOG_VERSION,
  };
}
export function cached<T>(
  s: StoredSession,
  scope: string,
  key: string,
  body: unknown,
  fn: () => T,
) {
  assert(
    /^[\w-]{8,128}$/.test(key),
    400,
    "IDEMPOTENCY_REQUIRED",
    "Supply an Idempotency-Key (8–128 letters, numbers, underscore or hyphen).",
  );
  const requestKey = `${scope}:${key}`;
  const requestHash = hash(JSON.stringify(body));
  const old = s.requests[requestKey];
  if (old) {
    assert(
      old.hash === requestHash,
      409,
      "IDEMPOTENCY_CONFLICT",
      "Idempotency key was already used with different content.",
    );
    return old.response as T;
  }
  const response = fn();
  s.requests[requestKey] = { hash: requestHash, response };
  return response;
}
export async function createRoom(body: unknown, c: Context) {
  const b = CreateSchema.parse(body);
  assert(
    b.experience !== "group_order" || b.mode === "delivery",
    422,
    "DELIVERY_REQUIRED",
    "Group Order ใช้การจัดส่งเท่านั้น",
  );
  assert(c.key, 400, "IDEMPOTENCY_REQUIRED", "Idempotency-Key required.");
  const id = stableId(`room:${c.key}`),
    token = derive(`host:${c.key}`);
  const result = await transact(id, (old) => {
    const s: StoredSession = old ?? {
      id,
      areaId: b.areaId,
      mode: b.mode,
      status: "collecting",
      hostTokenHash: hash(token),
      preferenceVersion: 0,
      rosterVersion: 1,
      expectedSize: b.expectedSize,
      membershipOpen: true,
      members: [
        {
          id: stableId(`member:${id}:host`),
          displayName: b.hostName,
          tokenHash: hash(token),
          clientJoinId: "host",
          active: true,
          confirmed: false,
          revision: 0,
          preference: null,
          createdAt: now(),
        },
      ],
      ...(b.chatJourney && b.experience === "group_order"
        ? { chatJourney: true }
        : {}),
      ...(b.experience === "group_order"
        ? { experience: "group_order" as const }
        : {}),
      ...(b.experience === "chat" || b.experience === "group_order"
        ? {
            chat: {
              botJoined: !!b.chatJourney && b.experience === "group_order",
              messages: [],
              meal: {
                phase:
                  b.experience === "group_order"
                    ? ("collecting" as const)
                    : ("setup" as const),
                selectedMemberIds:
                  b.experience === "group_order"
                    ? [stableId(`member:${id}:host`)]
                    : [],
                joinedMemberIds:
                  b.chatJourney && b.experience === "group_order"
                    ? [stableId(`member:${id}:host`)]
                    : [],
              },
            },
          }
        : {}),
      inputs: [],
      rankings: [],
      currentRankingId: null,
      acceptances: [],
      finalizedOptionId: null,
      lastChange: null,
      expiresAt: new Date(
        Date.now() + env().SESSION_TTL_HOURS * 3600000,
      ).toISOString(),
      createdAt: now(),
      requests: {},
      events: [],
      runs: [],
    };
    requireSession(s);
    return {
      session: s,
      result: cached(s, "create", c.key, b, () => {
        event(s, "room_created");
        return {
          sessionId: id,
          joinUrl: `${env().NEXT_PUBLIC_APP_URL}/${b.experience === "group_order" ? "group" : b.experience === "chat" ? "line" : "s"}/${id}`,
          memberId: s.members[0].id,
          versions: {
            preferenceVersion: s.preferenceVersion,
            rosterVersion: s.rosterVersion,
          },
        };
      }),
    };
  });
  return { result, token };
}
export async function joinRoom(id: string, body: unknown, c: Context) {
  const b = JoinSchema.parse(body);
  const token = derive(`join:${id}:${b.clientJoinId}`);
  const result = await transact(id, (s) => {
    requireSession(s);
    const result = cached(s, `join-${b.clientJoinId}`, c.key, b, () => {
      let member = s.members.find((m) => m.clientJoinId === b.clientJoinId);
      if (member) {
        assert(
          member.active,
          409,
          "MEMBER_REMOVED",
          "This member was removed. Use a new join identity.",
        );
        return {
          memberId: member.id,
          versions: {
            preferenceVersion: s.preferenceVersion,
            rosterVersion: s.rosterVersion,
          },
        };
      }
      assert(
        !s.members.some((m) => matches(c.token, m.tokenHash) && m.active),
        409,
        "ALREADY_JOINED",
        "This browser has already joined the room.",
      );
      assert(
        s.membershipOpen && (s.status === "collecting" || (s.chatJourney && s.status === "voting")),
        409,
        "MEMBERSHIP_CLOSED",
        "Host must reopen before a new member joins.",
      );
      assert(
        s.members.filter((m) => m.active).length < 5,
        422,
        "ROOM_FULL",
        "This room has reached five members.",
      );
      member = {
        id: randomUUID(),
        displayName: b.displayName,
        tokenHash: hash(token),
        clientJoinId: b.clientJoinId,
        active: true,
        confirmed: false,
        revision: 0,
        preference: null,
        createdAt: now(),
      };
      s.members.push(member);
      if (s.experience === "group_order")
        s.chat!.meal!.selectedMemberIds.push(member.id);
      if (s.chatJourney) s.chat!.meal!.joinedMemberIds.push(member.id);
      s.rosterVersion++;
      invalidate(
        s,
        "A member joined. Previous results and acceptances were cleared.",
      );
      event(s, "member_joined", { memberId: member.id });
      return {
        memberId: member.id,
        versions: {
          preferenceVersion: s.preferenceVersion,
          rosterVersion: s.rosterVersion,
        },
      };
    });
    return { session: s, result };
  });
  return { result, token };
}
export async function getRoom(id: string, token?: string) {
  const s = await readSession(id);
  requireSession(s);
  return view(s, token);
}
function noodleDraft(
  s: StoredSession,
  m: StoredMember,
  preference: Preference,
) {
  return derive(
    JSON.stringify([
      "noodle-choice",
      s.id,
      m.id,
      m.revision,
      s.preferenceVersion,
      s.rosterVersion,
      s.currentRankingId,
      CATALOG_VERSION,
      ALGORITHM_VERSION,
      GRAPH_VERSION,
      preference,
    ]),
  );
}

export async function previewNoodles(
  id: string,
  body: unknown,
  c: Context,
): Promise<NoodlePreview> {
  const b = NoodlePreviewSchema.parse(body);
  const s = await readSession(id);
  requireSession(s);
  const m = actor(s, c);
  assert(
    s.experience === "group_order",
    409,
    "GROUP_ORDER_REQUIRED",
    "Open a Group Order room.",
  );
  editable(s);
  assertMealParticipant(s, m.id);
  versions(s, b);
  assert(
    m.revision === b.expectedMemberRevision,
    409,
    "STALE_MEMBER_REVISION",
    "Reopen your form.",
  );
  const roster = mealMembers(s);
  if (
    roster.some(
      (peer) =>
        peer.id !== m.id &&
        (!peer.confirmed ||
          !peer.preference ||
          !s.chat?.meal?.joinedMemberIds.includes(peer.id)),
    )
  )
    return { choices: [] };
  const input = snapshot(s);
  input.members = input.members.map((member) =>
    member.id === m.id
      ? { ...member, preference: b.confirmedPreference }
      : member,
  );
  const result = simulateNoodleChoice(input, catalog, m.id);
  return {
    choices: result.changesResult
      ? result.available.map((style) => ({
          style,
          draft: noodleDraft(s, m, { ...b.confirmedPreference, noodle: style }),
        }))
      : [],
  };
}
export async function mutateRoom(
  id: string,
  action: "confirm" | "patch" | "rank" | "accept" | "withdraw" | "finalize",
  body: unknown,
  c: Context,
) {
  return transact(id, (s) => {
    requireSession(s);
    const m = actor(s, c, ["patch", "rank", "finalize"].includes(action));
    const result = cached(s, m.id, c.key, { action, body }, () => {
      const b = (
        action === "confirm"
          ? ConfirmSchema
          : action === "patch"
            ? PatchSchema
            : action === "rank"
              ? RankSchema
              : ChoiceSchema
      ).parse(body);
      versions(s, b);
      if (action === "confirm") {
        const p = ConfirmSchema.parse(body);
        editable(s);
        assertMealParticipant(s, m.id);
        assert(
          m.revision === p.expectedMemberRevision,
          409,
          "STALE_MEMBER_REVISION",
          "Your preferences changed. Refresh first.",
        );
        const noodle = p.confirmedPreference.noodle;
        if (p.routerDraftId) {
          const draft = m.router;
          assert(
            draft?.result &&
              draft.id === p.routerDraftId &&
              draft.revision === m.revision &&
              draft.preferenceVersion === s.preferenceVersion &&
              draft.rosterVersion === s.rosterVersion,
            409,
            "STALE_DRAFT",
            "Review your current private draft.",
          );
          assert(
            !draft.result.questions.length || p.reviewedQuestions,
            422,
            "REVIEW_QUESTIONS",
            "ตรวจคำถามเรื่องข้อจำกัดก่อนยืนยัน",
          );
        }
        if (p.confirmedPreference.desiredDish) {
          assert(
            catalog.some((r) =>
              r.menus.some(
                (menu) => menu.name === p.confirmedPreference.desiredDish,
              ),
            ),
            422,
            "UNKNOWN_DISH",
            "เลือกชื่อเมนูจาก catalog ปัจจุบัน",
          );
        }
        if (
          p.noodleDraft ||
          (s.experience === "group_order" &&
            noodle &&
            noodle !== "any" &&
            noodle !== m.preference?.noodle)
        ) {
          assert(
            p.noodleDraft === noodleDraft(s, m, p.confirmedPreference),
            409,
            "STALE_NOODLE_DRAFT",
            "Review the current choices in your own preference form.",
          );
        }
        if (p.draftId) {
          const input = s.inputs.find(
            (i) => i.memberId === m.id && i.draftId === p.draftId,
          );
          assert(
            input &&
              input.inputRevision ===
                Math.max(
                  ...s.inputs
                    .filter((i) => i.memberId === m.id)
                    .map((i) => i.inputRevision),
                ),
            409,
            "STALE_DRAFT",
            "This draft belongs to an older input.",
          );
        }
        const previousRankingId = s.currentRankingId;
        const replan = s.rankings.length > 0 && !s.membershipOpen;
        const previewStarted = s.preliminaryRestaurants !== undefined;
        m.preference = p.confirmedPreference;
        delete m.router;
        m.confirmed = true;
        m.revision++;
        s.preferenceVersion++;
        invalidate(
          s,
          "Confirmed preferences changed. Previous results and acceptances were cleared.",
        );
        event(s, "preferences_confirmed", {
          memberId: m.id,
          revision: m.revision,
        });
        if ((s.chatJourney || replan) && mealReady(s)) computeRanking(s, previousRankingId);
        else if (previewStarted) previewConfirmedRestaurants(s);
      } else if (action === "patch") {
        const p = PatchSchema.parse(body);
        assert(
          s.experience !== "group_order" || !p.mode || p.mode === "delivery",
          422,
          "DELIVERY_REQUIRED",
          "Group Order ใช้การจัดส่งเท่านั้น",
        );
        assert(
          p.action || p.mode || p.areaId || p.removeMemberId,
          422,
          "EMPTY_PATCH",
          "Choose a room change.",
        );
        if (p.action === "reopen") {
          s.membershipOpen = true;
          invalidate(
            s,
            "Host reopened the room. Previous consensus was cleared.",
          );
          s.rosterVersion++;
        } else editable(s);
        if (p.removeMemberId) {
          assert(
            s.membershipOpen,
            409,
            "MEMBERSHIP_CLOSED",
            "Reopen the room before changing members.",
          );
          assert(
            p.removeMemberId !== m.id,
            422,
            "HOST_REMOVAL",
            "Host cannot remove themself.",
          );
          const target = s.members.find(
            (x) => x.id === p.removeMemberId && x.active,
          );
          assert(target, 404, "MEMBER_NOT_FOUND", "Active member not found.");
          target.active = false;
          if (s.chat?.meal) {
            s.chat.meal.selectedMemberIds =
              s.chat.meal.selectedMemberIds.filter((id) => id !== target.id);
            s.chat.meal.joinedMemberIds = s.chat.meal.joinedMemberIds.filter(
              (id) => id !== target.id,
            );
          }
          s.rosterVersion++;
          event(s, "member_removed", { memberId: target.id });
        }
        const previousRankingId = s.currentRankingId;
        const auto = s.rankings.length > 0 && !s.membershipOpen;
        const modeChanged = p.mode && p.mode !== s.mode;
        if (p.mode) s.mode = p.mode;
        if (p.areaId) s.areaId = p.areaId;
        s.preferenceVersion++;
        invalidate(
          s,
          p.action === "reopen"
            ? "Host reopened the room. Previous consensus was cleared."
            : modeChanged
              ? "Dining mode changed. Costs were recalculated and acceptances cleared."
              : "Room constraints changed. Results and acceptances cleared.",
        );
        event(s, "room_changed", { mode: s.mode, action: p.action ?? "edit" });
        if ((auto || s.chatJourney) && mealReady(s)) computeRanking(s, previousRankingId);
      } else if (action === "rank") {
        editable(s);
        if (RankSchema.parse(body).confirmedOnly) {
          assert(
            s.chatJourney && !mealReady(s),
            409,
            "PREVIEW_UNAVAILABLE",
            "ใช้การค้นหาเบื้องต้นระหว่างรอสมาชิกยืนยัน",
          );
          previewConfirmedRestaurants(s);
        } else {
          computeRanking(s);
        }
      } else {
        const p = ChoiceSchema.parse(body);
        const ranking = s.rankings.find((r) => r.id === s.currentRankingId);
        assert(
          ranking &&
            ranking.id === p.rankingId &&
            ranking.preferenceVersion === s.preferenceVersion &&
            ranking.rosterVersion === s.rosterVersion &&
            currentSnapshot(ranking),
          409,
          "STALE_RANKING",
          "This ranking is no longer current.",
        );
        assert(
          ranking.options.some((o) => o.restaurantId === p.restaurantId),
          422,
          "UNKNOWN_OPTION",
          "Choose an option from the current ranking.",
        );
        assert(
          s.status === "voting",
          409,
          "INVALID_STATE",
          "This room is not accepting choices.",
        );
        if (action !== "finalize") assertMealParticipant(s, m.id);
        if (action === "accept") {
          if (s.chatJourney) s.membershipOpen = false;
          s.acceptances = s.acceptances.filter((a) => a.memberId !== m.id);
          s.acceptances.push({
            memberId: m.id,
            rankingId: p.rankingId,
            restaurantId: p.restaurantId,
          });
          event(s, "option_accepted", {
            memberId: m.id,
            rankingId: p.rankingId,
            restaurantId: p.restaurantId,
          });
        } else if (action === "withdraw") {
          s.acceptances = s.acceptances.filter((a) => a.memberId !== m.id);
          event(s, "acceptance_withdrawn", { memberId: m.id });
        } else {
          const members = mealMembers(s);
          assert(
            mealReady(s),
            409,
            "MEMBERS_NOT_READY",
            "Every selected member must join and confirm before finalization.",
          );
          assert(
            members.every((m) =>
              s.acceptances.some(
                (a) =>
                  a.memberId === m.id &&
                  a.rankingId === ranking.id &&
                  a.restaurantId === p.restaurantId,
              ),
            ),
            409,
            "NO_CONSENSUS",
            "Every active member must accept the same current option.",
          );
          const start = performance.now();
          const fresh = rankRestaurants(snapshot(s), catalog);
          const option = fresh.options.find(
            (o) => o.restaurantId === p.restaurantId,
          );
          const original = ranking.options.find(
            (o) => o.restaurantId === p.restaurantId,
          )!;
          assert(
            option && JSON.stringify(option) === JSON.stringify(original),
            409,
            "CATALOG_CHANGED",
            "Catalog evidence changed. Rank again before finalizing.",
          );
          s.status = "finalized";
          s.finalizedOptionId = p.restaurantId;
          event(s, "choice_finalized", {
            rankingId: ranking.id,
            restaurantId: p.restaurantId,
          });
          s.runs.push({
            id: randomUUID(),
            name: "finalize_group_choice",
            snapshotVersion: s.preferenceVersion,
            status: "ok",
            durationMs: performance.now() - start,
            evidenceIds: option.assignments.map((a) => a.menuId),
            createdAt: now(),
          });
        }
      }
      return view(s, c.token);
    });
    return {
      session: s,
      result: s.experience === "group_order" ? view(s, c.token) : result,
    };
  });
}
export async function saveInput(
  id: string,
  input: Omit<StoredInput, "id" | "createdAt" | "state">,
  c: Context,
) {
  return transact(id, (s) => {
    requireSession(s);
    const m = actor(s, c);
    editable(s);
    assertMealParticipant(s, m.id);
    assert(
      input.memberId === m.id,
      403,
      "WRONG_ACTOR",
      "You can only add your own inputs.",
    );
    return {
      session: s,
      result: cached(s, m.id, c.key, { action: "input", input }, () => {
        assert(
          input.inputRevision >
            Math.max(
              0,
              ...s.inputs
                .filter((i) => i.memberId === m.id)
                .map((i) => i.inputRevision),
            ),
          409,
          "STALE_INPUT",
          "Use a newer input revision.",
        );
        const row: StoredInput = {
          ...input,
          id: randomUUID(),
          state: "draft",
          createdAt: now(),
        };
        s.inputs.push(row);
        event(s, "input_saved", { inputId: row.id, memberId: m.id });
        return { inputId: row.id, inputRevision: row.inputRevision };
      }),
    };
  });
}
export async function extraction(id: string, body: unknown, c: Context) {
  const b = ExtractSchema.parse(body);
  const s = await readSession(id);
  requireSession(s);
  const m = actor(s, c);
  assert(!s.chatJourney, 409, "MOCK_ONLY", "ห้องแชตนี้ใช้ผู้ช่วยจำลอง");
  assertMealParticipant(s, m.id);
  const input = s.inputs.find((i) => i.id === b.inputId);
  assert(input, 404, "INPUT_NOT_FOUND", "Input not found.");
  assert(
    input.memberId === m.id,
    403,
    "WRONG_ACTOR",
    "You can only extract your own input.",
  );
  assert(
    input.inputRevision === b.inputRevision,
    409,
    "STALE_INPUT",
    "Input revision changed.",
  );
  const reqHash = hash(JSON.stringify({ action: "extract", body }));
  const requestKey = `${m.id}:${c.key}`;
  if (s.requests[requestKey]) {
    assert(
      s.requests[requestKey].hash === reqHash,
      409,
      "IDEMPOTENCY_CONFLICT",
      "Key already used for different content.",
    );
    return s.requests[requestKey].response;
  }
  assert(
    input.inputRevision ===
      Math.max(
        ...s.inputs
          .filter((i) => i.memberId === m.id)
          .map((i) => i.inputRevision),
      ),
    409,
    "STALE_INPUT",
    "A newer input exists.",
  );
  assert(
    !input.imageDataUrl || Date.parse(input.imageExpiresAt!) > Date.now(),
    410,
    "IMAGE_EXPIRED",
    "Image expired. Upload it again or enter preferences manually.",
  );
  const revision = m.revision;
  const started = performance.now();
  let draft;
  try {
    draft = await extractPreferences({
      text: input.text,
      imageDataUrl: input.imageDataUrl,
    });
  } catch (error) {
    await transact(id, (current) => {
      requireSession(current);
      actor(current, c);
      current.runs.push({
        id: randomUUID(),
        name: "extract_preferences",
        snapshotVersion: current.preferenceVersion,
        status: "failed",
        durationMs: performance.now() - started,
        evidenceIds: [input.id],
        errorCode: error instanceof AppError ? error.code : "EXTRACTION_FAILED",
        createdAt: now(),
      });
      const i = current.inputs.find((i) => i.id === input.id);
      if (i) i.state = "failed";
      return { session: current, result: null };
    });
    throw error;
  }
  return transact(id, (current) => {
    requireSession(current);
    const member = actor(current, c);
    assertMealParticipant(current, member.id);
    const result = cached(
      current,
      member.id,
      c.key,
      { action: "extract", body },
      () => {
        assert(
          member.revision === revision &&
            b.inputRevision ===
              Math.max(
                ...current.inputs
                  .filter((i) => i.memberId === member.id)
                  .map((i) => i.inputRevision),
              ),
          409,
          "STALE_EXTRACTION",
          "Your inputs changed while AI was working. Keep your latest form values.",
        );
        const i = current.inputs.find((i) => i.id === b.inputId)!;
        i.draft = draft;
        i.draftId = randomUUID();
        i.state = "extracted";
        current.runs.push({
          id: randomUUID(),
          name: "extract_preferences",
          snapshotVersion: current.preferenceVersion,
          status: "ok",
          durationMs: performance.now() - started,
          evidenceIds: [i.id],
          createdAt: now(),
        });
        return { draftId: i.draftId, draft, sourceRevision: i.inputRevision };
      },
    );
    return { session: current, result };
  });
}
export async function trace(id: string, c: Context) {
  const s = await readSession(id);
  requireSession(s);
  actor(s, c, true);
  return { runs: s.runs, events: s.events };
}
