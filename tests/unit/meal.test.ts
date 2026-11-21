import { describe, expect, it } from "vitest";
import { emptyPreference } from "../../src/contracts";
import type { StoredMember } from "../../src/server/state";
import { AppError } from "../../src/server/errors";
import {
  assertMealParticipant,
  mealMembers,
  mealReady,
  type MealSession,
} from "../../src/domain/meal";

const member = (
  id: string,
  patch: Partial<StoredMember> = {},
): StoredMember => ({
  id,
  displayName: id,
  tokenHash: `hash-${id}`,
  clientJoinId: `join-${id}`,
  active: true,
  confirmed: true,
  revision: 1,
  preference: structuredClone(emptyPreference),
  createdAt: "2026-11-18T00:00:00.000Z",
  ...patch,
});
const session = (): MealSession => ({
  members: [member("may"), member("nat"), member("ploy"), member("ton")],
  chat: {
    botJoined: true,
    messages: [],
    meal: {
      phase: "collecting",
      selectedMemberIds: ["may", "nat", "ploy"],
      joinedMemberIds: ["may", "nat", "ploy"],
    },
  },
});
function expectFailure(
  s: MealSession,
  id: string,
  status: number,
  code: string,
) {
  expect(() => assertMealParticipant(s, id)).toThrow(AppError);
  try {
    assertMealParticipant(s, id);
  } catch (error) {
    expect(error).toMatchObject({ status, code });
  }
}

describe("explicit meal participation, separate from group membership", () => {
  it("keeps selected people in the roster before they individually join", () => {
    const s = session();
    s.chat!.meal!.joinedMemberIds = ["may"];
    expect(mealMembers(s).map((m) => m.id)).toEqual(["may", "nat", "ploy"]);
    expect(mealReady(s)).toBe(false);
    expectFailure(s, "nat", 409, "MEAL_NOT_JOINED");
  });
  it("is ready only when every selected active person has joined and confirmed", () => {
    const s = session();
    expect(mealReady(s)).toBe(true);
    s.members[2].confirmed = false;
    expect(mealReady(s)).toBe(false);
  });
  it("does not rank bystanders or use them in readiness", () => {
    const s = session();
    s.members[3].confirmed = false;
    s.members[3].preference = null;
    expect(mealMembers(s).map((m) => m.id)).toEqual(["may", "nat", "ploy"]);
    expect(mealReady(s)).toBe(true);
    expectFailure(s, "ton", 403, "MEAL_NOT_SELECTED");
  });
  it("requires personal opt-in even from a confirmed selected host", () => {
    const s = session();
    s.chat!.meal!.joinedMemberIds = ["nat", "ploy"];
    expectFailure(s, "may", 409, "MEAL_NOT_JOINED");
    expect(mealReady(s)).toBe(false);
  });
  it("allows an active joined selected participant without writing anything", () => {
    const s = session();
    const before = structuredClone(s);
    expect(() => assertMealParticipant(s, "nat")).not.toThrow();
    expect(s).toEqual(before);
  });
  it("setup is never ready and does not expose an accidental selected roster", () => {
    const s = session();
    s.chat!.meal!.phase = "setup";
    expect(mealMembers(s)).toEqual([]);
    expect(mealReady(s)).toBe(false);
    expectFailure(s, "may", 409, "MEAL_NOT_STARTED");
  });
  it("new empty setup rooms require start before even bystanders can act", () => {
    const s = session();
    s.chat!.meal = {
      phase: "setup",
      selectedMemberIds: [],
      joinedMemberIds: [],
    };
    expectFailure(s, "ton", 409, "MEAL_NOT_STARTED");
    expect(mealReady(s)).toBe(false);
  });
  it("an empty selected roster cannot be vacuously ready", () => {
    const s = session();
    s.chat!.meal!.selectedMemberIds = [];
    expect(mealMembers(s)).toEqual([]);
    expect(mealReady(s)).toBe(false);
    expectFailure(s, "may", 403, "MEAL_NOT_SELECTED");
  });
  it("confirmation without a canonical preference is not ready", () => {
    const s = session();
    s.members[1].preference = null;
    expect(mealReady(s)).toBe(false);
  });
  it("draft preferences without confirmation are not ready", () => {
    const s = session();
    s.members[0].confirmed = false;
    expect(mealReady(s)).toBe(false);
  });
  it("removed inactive people are filtered despite old selection and opt-in", () => {
    const s = session();
    s.members[1].active = false;
    s.members[1].confirmed = false;
    s.members[1].preference = null;
    expect(mealMembers(s).map((m) => m.id)).toEqual(["may", "ploy"]);
    expect(mealReady(s)).toBe(true);
    expectFailure(s, "nat", 403, "MEAL_NOT_SELECTED");
  });
  it("all selected people inactive is not a ready meal", () => {
    const s = session();
    s.members.forEach((m) => {
      m.active = false;
    });
    expect(mealMembers(s)).toEqual([]);
    expect(mealReady(s)).toBe(false);
  });
  it("unknown IDs cannot authorize a participant, even if selected and joined", () => {
    const s = session();
    s.chat!.meal!.selectedMemberIds.push("missing");
    s.chat!.meal!.joinedMemberIds.push("missing");
    expectFailure(s, "missing", 403, "MEAL_NOT_SELECTED");
    expect(mealMembers(s).map((m) => m.id)).toEqual(["may", "nat", "ploy"]);
  });
  it("preserves stored member order instead of selection or join message order", () => {
    const s = session();
    s.chat!.meal!.selectedMemberIds = ["ploy", "may", "nat"];
    s.chat!.meal!.joinedMemberIds = ["nat", "ploy", "may"];
    expect(mealMembers(s).map((m) => m.id)).toEqual(["may", "nat", "ploy"]);
    expect(mealReady(s)).toBe(true);
  });
  it("duplicate selected/join IDs do not count extra people", () => {
    const s = session();
    s.chat!.meal!.selectedMemberIds.push("may");
    s.chat!.meal!.joinedMemberIds.push("may");
    expect(mealMembers(s)).toHaveLength(3);
    expect(mealReady(s)).toBe(true);
  });
  it("bot invitation/messages never create a human participant or vote", () => {
    const s = session();
    s.chat!.messages = [
      {
        id: "bot-message",
        kind: "bot",
        memberId: null,
        text: "Ready?",
        createdAt: "2026-11-18T00:00:00.000Z",
      },
    ];
    expect(mealMembers(s)).toHaveLength(3);
    expectFailure(s, "bot", 403, "MEAL_NOT_SELECTED");
    s.chat!.botJoined = false;
    expect(mealMembers(s)).toHaveLength(3);
  });
  it("a join receipt alone does not select a bystander", () => {
    const s = session();
    s.chat!.meal!.joinedMemberIds.push("ton");
    expectFailure(s, "ton", 403, "MEAL_NOT_SELECTED");
    expect(mealMembers(s)).toHaveLength(3);
  });
  it("helpers never modify the room, array order, members or consent lists", () => {
    const s = session();
    const before = structuredClone(s);
    mealMembers(s);
    mealReady(s);
    assertMealParticipant(s, "may");
    expect(s).toEqual(before);
  });
});

describe("legacy compatibility without chat.meal", () => {
  it("legacy web rooms include all active humans and allow their actions", () => {
    const s: MealSession = {
      members: [
        member("may"),
        member("nat"),
        member("removed", { active: false }),
      ],
    };
    expect(mealMembers(s).map((m) => m.id)).toEqual(["may", "nat"]);
    expect(mealReady(s)).toBe(true);
    expect(() => assertMealParticipant(s, "nat")).not.toThrow();
    expectFailure(s, "removed", 403, "MEAL_NOT_SELECTED");
  });
  it("legacy chat rooms with no meal field retain old participant behavior", () => {
    const s: MealSession = {
      members: [member("may")],
      chat: { botJoined: true, messages: [] },
    };
    expect(mealMembers(s).map((m) => m.id)).toEqual(["may"]);
    expect(mealReady(s)).toBe(true);
    expect(() => assertMealParticipant(s, "may")).not.toThrow();
  });
  it("legacy empty/unconfirmed/missing-preference rooms cannot be ready", () => {
    expect(mealReady({ members: [] })).toBe(false);
    expect(mealReady({ members: [member("may", { confirmed: false })] })).toBe(
      false,
    );
    expect(mealReady({ members: [member("may", { preference: null })] })).toBe(
      false,
    );
  });
});
