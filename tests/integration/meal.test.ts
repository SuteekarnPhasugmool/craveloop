import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { handle } from "@/server/http";
import { cookieName } from "@/server/auth";
import {
  emptyPreference,
  type Preference,
  type PreferenceDraft,
  type SessionView,
} from "@/contracts";
import { migrate, closeDatabase } from "@/server/database";
import { seedCatalog } from "@/server/seed";
import {
  createRoom,
  joinRoom,
  getRoom,
  mutateRoom,
  saveInput,
  extraction,
  type Context,
} from "@/server/session-service";
import { getChat, postChat } from "@/server/chat-service";
import * as ai from "@/adapters/openai";
const dir = mkdtempSync(join(tmpdir(), "craveloop-meal-test-"));
const context = (token?: string): Context => ({ token, key: randomUUID() });
const versions = (s: { preferenceVersion: number; rosterVersion: number }) => ({
  expectedPreferenceVersion: s.preferenceVersion,
  expectedRosterVersion: s.rosterVersion,
});
beforeAll(async () => {
  process.env.PERSISTENCE_DRIVER = "sqlite";
  process.env.SQLITE_PATH = join(dir, "meal.sqlite");
  await migrate();
  await seedCatalog();
});
afterAll(async () => {
  await closeDatabase();
  rmSync(dir, { recursive: true, force: true });
});
async function group() {
  const host = await createRoom(
    {
      hostName: "May",
      areaId: "bangkok_demo",
      mode: "dine_in",
      expectedSize: 4,
      experience: "chat",
    },
    context(),
  );
  const id = host.result.sessionId,
    tokens = [host.token];
  for (const displayName of ["Nat", "Ploy", "Ton"])
    tokens.push(
      (
        await joinRoom(
          id,
          { displayName, clientJoinId: randomUUID() },
          context(),
        )
      ).token,
    );
  return { id, tokens };
}
async function invite(r: Awaited<ReturnType<typeof group>>) {
  return postChat(r.id, { action: "invite_bot" }, context(r.tokens[0]));
}
async function start(
  r: Awaited<ReturnType<typeof group>>,
  names = ["May", "Nat", "Ploy", "Ton"],
  mode: "dine_in" | "delivery" = "dine_in",
) {
  const s = await getRoom(r.id, r.tokens[0]);
  return postChat(
    r.id,
    {
      action: "start_meal",
      ...versions(s),
      selectedMemberIds: s.members
        .filter((m) => names.includes(m.displayName))
        .map((m) => m.id),
      areaId: "bangkok_demo",
      mode,
    },
    context(r.tokens[0]),
  );
}
async function optin(id: string, token: string) {
  const s = await getRoom(id, token);
  return postChat(id, { action: "join_meal", ...versions(s) }, context(token));
}
async function confirm(
  id: string,
  token: string,
  preference: Preference = { ...emptyPreference, budgetMaxSatang: 18000 },
) {
  const s = await getRoom(id, token);
  return mutateRoom(
    id,
    "confirm",
    {
      ...versions(s),
      expectedMemberRevision: s.me!.revision,
      confirmedPreference: preference,
    },
    context(token),
  );
}
async function ready(
  r: Awaited<ReturnType<typeof group>>,
  names = ["May", "Nat"],
) {
  await invite(r);
  await start(r, names);
  for (const token of r.tokens) {
    const s = await getRoom(r.id, token);
    if (names.includes(s.me!.displayName)) {
      await optin(r.id, token);
      await confirm(r.id, token);
    }
  }
}
async function rank(r: Awaited<ReturnType<typeof group>>) {
  const s = await getRoom(r.id, r.tokens[0]);
  return mutateRoom(r.id, "rank", versions(s), context(r.tokens[0]));
}
const choice = (s: SessionView) => ({
  ...versions(s),
  rankingId: s.ranking!.id,
  restaurantId: s.ranking!.options[0].restaurantId,
});

describe("explicit shared meal setup, individual consent and selected-member scope", () => {
  it("HTTP rejects direct preference bypass, enforces self consent and returns revised meal state", async () => {
    const r = await group();
    const request = (
      path: string,
      method: string,
      token: string,
      body: unknown,
    ) =>
      new NextRequest(`http://localhost:3000/api/sessions/${r.id}/${path}`, {
        method,
        headers: {
          Cookie: `${cookieName(r.id)}=${token}`,
          "Idempotency-Key": randomUUID(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    let s = await getRoom(r.id, r.tokens[0]);
    let response = await handle(
      request("preferences/me", "PUT", r.tokens[0], {
        ...versions(s),
        expectedMemberRevision: s.me!.revision,
        confirmedPreference: emptyPreference,
      }),
      [r.id, "preferences", "me"],
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("MEAL_NOT_STARTED");
    await invite(r);
    await start(r, ["May", "Nat"]);
    s = await getRoom(r.id, r.tokens[2]);
    response = await handle(
      request("preferences/me", "PUT", r.tokens[2], {
        ...versions(s),
        expectedMemberRevision: s.me!.revision,
        confirmedPreference: emptyPreference,
      }),
      [r.id, "preferences", "me"],
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("MEAL_NOT_SELECTED");
    s = await getRoom(r.id, r.tokens[1]);
    response = await handle(
      request("chat", "POST", r.tokens[1], {
        action: "join_meal",
        ...versions(s),
      }),
      [r.id, "chat"],
    );
    expect(response.status).toBe(200);
    const own = await response.json();
    expect(own.requestId).toEqual(expect.any(String));
    expect(own.data.session.meal.joinedMemberIds).toEqual([s.me!.id]);
    expect(own.data.chat.meal).toEqual(own.data.session.meal);
    s = await getRoom(r.id, r.tokens[0]);
    response = await handle(
      request("chat", "POST", r.tokens[0], {
        action: "join_meal",
        ...versions(s),
        memberId: own.data.session.me.id,
      }),
      [r.id, "chat"],
    );
    expect(response.status).toBe(422);
  });
  it("new chat rooms require bot invite and explicit host setup without auto-consenting anyone", async () => {
    const r = await group();
    let s = await getRoom(r.id, r.tokens[0]);
    expect(s.meal).toEqual({
      phase: "setup",
      selectedMemberIds: [],
      joinedMemberIds: [],
    });
    await expect(start(r, ["May", "Nat"])).rejects.toMatchObject({
      status: 409,
    });
    await expect(confirm(r.id, r.tokens[0])).rejects.toMatchObject({
      code: "MEAL_NOT_STARTED",
    });
    await invite(r);
    s = await getRoom(r.id, r.tokens[1]);
    await expect(
      postChat(
        r.id,
        {
          action: "start_meal",
          ...versions(s),
          selectedMemberIds: [s.me!.id],
          areaId: "bangkok_demo",
          mode: "delivery",
        },
        context(r.tokens[1]),
      ),
    ).rejects.toMatchObject({ status: 403 });
    const configured = await start(r, ["May", "Nat"], "delivery");
    expect(configured.session.mode).toBe("delivery");
    expect(configured.session.areaId).toBe("bangkok_demo");
    expect(configured.session.meal!.selectedMemberIds).toHaveLength(2);
    expect(configured.session.meal!.joinedMemberIds).toEqual([]);
    expect(configured.session.members).toHaveLength(4);
  });
  it("host cannot opt in for another member and selected members must join before preferences or input", async () => {
    const r = await group();
    await invite(r);
    await start(r, ["May", "Nat"]);
    let s = await getRoom(r.id, r.tokens[0]);
    await expect(
      postChat(
        r.id,
        {
          action: "join_meal",
          ...versions(s),
          memberId: s.members.find((m) => m.displayName === "Nat")!.id,
        },
        context(r.tokens[0]),
      ),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(confirm(r.id, r.tokens[0])).rejects.toMatchObject({
      code: "MEAL_NOT_JOINED",
    });
    await expect(
      saveInput(
        r.id,
        {
          memberId: s.me!.id,
          kind: "text",
          text: "budget180",
          inputRevision: 1,
        },
        context(r.tokens[0]),
      ),
    ).rejects.toMatchObject({ code: "MEAL_NOT_JOINED" });
    const message = await postChat(
      r.id,
      { action: "message", text: "@CraveLoop ไม่กินหมู งบ180" },
      context(r.tokens[0]),
    );
    expect(message).not.toHaveProperty("draft");
    await optin(r.id, r.tokens[0]);
    s = await getRoom(r.id, r.tokens[0]);
    expect(s.meal!.joinedMemberIds).toEqual([s.me!.id]);
    expect(s.members.find((m) => m.displayName === "Nat")!.confirmed).toBe(
      false,
    );
  });
  it("nonselected group members may chat but cannot edit, draft, vote or contribute requirements", async () => {
    const r = await group();
    await ready(r, ["May", "Nat"]);
    const ranked = await rank(r),
      plo = (await getRoom(r.id, r.tokens[2])).me!;
    const chatted = await postChat(
      r.id,
      { action: "message", text: "@CraveLoop งบ0 ห้ามกินทุกอย่าง" },
      context(r.tokens[2]),
    );
    expect(chatted).not.toHaveProperty("draft");
    expect(
      chatted.chat.messages.some(
        (m) => m.text === "@CraveLoop งบ0 ห้ามกินทุกอย่าง",
      ),
    ).toBe(true);
    await expect(optin(r.id, r.tokens[2])).rejects.toMatchObject({
      code: "MEAL_NOT_SELECTED",
    });
    await expect(confirm(r.id, r.tokens[2])).rejects.toMatchObject({
      code: "MEAL_NOT_SELECTED",
    });
    await expect(
      saveInput(
        r.id,
        { memberId: plo.id, kind: "text", text: "no pork", inputRevision: 1 },
        context(r.tokens[2]),
      ),
    ).rejects.toMatchObject({ code: "MEAL_NOT_SELECTED" });
    await expect(
      mutateRoom(r.id, "accept", choice(ranked), context(r.tokens[2])),
    ).rejects.toMatchObject({ code: "MEAL_NOT_SELECTED" });
    expect(
      (await getRoom(r.id)).ranking!.options.every(
        (o) =>
          o.assignments.length === 2 &&
          !o.assignments.some((a) => a.memberId === plo.id),
      ),
    ).toBe(true);
  });
  it("an unanswered selected member blocks ranking despite every joined member being confirmed", async () => {
    const r = await group();
    await invite(r);
    await start(r, ["May", "Nat", "Ploy"]);
    for (const token of r.tokens.slice(0, 2)) {
      await optin(r.id, token);
      await confirm(r.id, token);
    }
    await expect(rank(r)).rejects.toMatchObject({ status: 422 });
    await optin(r.id, r.tokens[2]);
    await expect(rank(r)).rejects.toMatchObject({ status: 422 });
    await confirm(r.id, r.tokens[2]);
    expect(
      (await rank(r)).ranking!.options.every((o) => o.assignments.length === 3),
    ).toBe(true);
  });
  it("setup and opt-in enforce stale versions and idempotency; repeated consent never duplicates", async () => {
    const r = await group();
    await invite(r);
    const before = await getRoom(r.id, r.tokens[0]),
      c = context(r.tokens[0]);
    const body = {
      action: "start_meal",
      ...versions(before),
      selectedMemberIds: before.members.slice(0, 2).map((m) => m.id),
      areaId: "bangkok_demo",
      mode: "dine_in",
    };
    const first = await postChat(r.id, body, c);
    expect(await postChat(r.id, body, c)).toEqual(first);
    await expect(
      postChat(r.id, { ...body, mode: "delivery" }, c),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expect(
      postChat(r.id, body, context(r.tokens[0])),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    const joinBody = { action: "join_meal", ...versions(first.session) },
      joinContext = context(r.tokens[0]);
    const joined = await postChat(r.id, joinBody, joinContext);
    expect(await postChat(r.id, joinBody, joinContext)).toEqual(joined);
    const repeat = await optin(r.id, r.tokens[0]);
    expect(repeat.session.meal!.joinedMemberIds).toHaveLength(1);
    expect(repeat.session.rosterVersion).toBe(joined.session.rosterVersion);
  });
  it("concurrent opt-in cannot lose consent or silently override the current roster version", async () => {
    const r = await group();
    await invite(r);
    const setup = await start(r, ["May", "Nat"]);
    const body = { action: "join_meal", ...versions(setup.session) };
    const results = await Promise.allSettled(
      r.tokens.slice(0, 2).map((token) => postChat(r.id, body, context(token))),
    );
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const loser = results.findIndex((x) => x.status === "rejected");
    expect((results[loser] as PromiseRejectedResult).reason.code).toBe(
      "STALE_VERSION",
    );
    await optin(r.id, r.tokens[loser]);
    const s = await getRoom(r.id);
    expect(new Set(s.meal!.joinedMemberIds).size).toBe(2);
  });
  it("a selected subset alone supplies assignments, fee shares and the consensus denominator", async () => {
    const r = await group();
    await ready(r, ["May", "Nat"]);
    let s = await rank(r);
    expect(s.members).toHaveLength(4);
    expect(s.ranking!.options[0].assignments).toHaveLength(2);
    s = await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), mode: "delivery" },
      context(r.tokens[0]),
    );
    expect(
      s.ranking!.options[0].assignments.map((a) => a.allocatedFeeSatang),
    ).toEqual([2000, 2000]);
    const c = choice(s);
    await mutateRoom(r.id, "accept", c, context(r.tokens[0]));
    await expect(
      mutateRoom(r.id, "finalize", c, context(r.tokens[0])),
    ).rejects.toMatchObject({ code: "NO_CONSENSUS" });
    await mutateRoom(r.id, "accept", c, context(r.tokens[1]));
    await mutateRoom(r.id, "finalize", c, context(r.tokens[0]));
    expect((await getRoom(r.id)).status).toBe("finalized");
  });
  it("a host may coordinate a meal without consenting, contributing preferences or voting for anyone", async () => {
    const r = await group();
    await ready(r, ["Nat", "Ploy"]);
    const s = await rank(r),
      host = (await getRoom(r.id, r.tokens[0])).me!;
    expect(
      s.ranking!.options.every(
        (o) =>
          o.assignments.length === 2 &&
          !o.assignments.some((a) => a.memberId === host.id),
      ),
    ).toBe(true);
    await expect(
      mutateRoom(r.id, "accept", choice(s), context(r.tokens[0])),
    ).rejects.toMatchObject({ code: "MEAL_NOT_SELECTED" });
    for (const token of r.tokens.slice(1, 3))
      await mutateRoom(r.id, "accept", choice(s), context(token));
    await mutateRoom(r.id, "finalize", choice(s), context(r.tokens[0]));
    expect((await getRoom(r.id)).status).toBe("finalized");
  });
  it("adding a participant clears old votes, retains existing consent and confirmed hard fields, and waits for the newcomer", async () => {
    const r = await group();
    await ready(r, ["May", "Nat"]);
    const hard = {
      ...emptyPreference,
      budgetMaxSatang: 16000,
      excludedIngredients: ["pork"],
      dietaryRequirements: ["vegetarian"],
    };
    await confirm(r.id, r.tokens[1], hard);
    let s = await rank(r);
    const old = choice(s);
    for (const token of r.tokens.slice(0, 2))
      await mutateRoom(r.id, "accept", old, context(token));
    s = await getRoom(r.id, r.tokens[0]);
    await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), action: "reopen" },
      context(r.tokens[0]),
    );
    await start(r, ["May", "Nat", "Ploy"]);
    s = await getRoom(r.id, r.tokens[1]);
    expect(s.acceptances).toEqual([]);
    expect(s.ranking).toBeNull();
    expect(s.me!.confirmed).toBe(true);
    expect(s.me!.preference).toEqual(hard);
    expect(s.meal!.joinedMemberIds).toHaveLength(2);
    await expect(rank(r)).rejects.toMatchObject({ status: 422 });
    await expect(
      mutateRoom(r.id, "accept", old, context(r.tokens[0])),
    ).rejects.toMatchObject({ status: 409 });
    await optin(r.id, r.tokens[2]);
    await confirm(r.id, r.tokens[2]);
    expect((await getRoom(r.id)).ranking).toBeNull();
    expect(
      (await rank(r)).ranking!.options.every((o) => o.assignments.length === 3),
    ).toBe(true);
  });
  it("an AI draft completing after meal removal is rejected without restoring excluded participation", async () => {
    const r = await group();
    await ready(r, ["May", "Nat"]);
    const before = await getRoom(r.id, r.tokens[1]);
    const input = await saveInput(
      r.id,
      {
        memberId: before.me!.id,
        kind: "text",
        text: "อยากกินเผ็ด งบ160",
        inputRevision: 1,
      },
      context(r.tokens[1]),
    );
    let release!: (draft: PreferenceDraft) => void;
    const spy = vi.spyOn(ai, "extractPreferences").mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    try {
      const pending = extraction(r.id, input, context(r.tokens[1]));
      await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
      await start(r, ["May"]);
      release({
        cuisinePreferences: [],
        flavorTags: ["spicy"],
        textureTags: [],
        dislikes: [],
        budgetMaxBaht: 160,
        excludedIngredients: [],
        dietaryRequirements: [],
        evidence: [],
        needsConfirmation: true,
        questions: [],
      });
      await expect(pending).rejects.toMatchObject({
        code: "MEAL_NOT_SELECTED",
      });
      const after = await getRoom(r.id, r.tokens[1]);
      expect(after.me!.preference).toEqual(before.me!.preference);
      expect(after.meal!.selectedMemberIds).not.toContain(after.me!.id);
    } finally {
      spy.mockRestore();
    }
  });
  it("finalized meals reject preference/setup changes until host reopen; meal consent persists across reconnect", async () => {
    const r = await group();
    await ready(r, ["May", "Nat"]);
    let s = await rank(r);
    const c = choice(s);
    for (const token of r.tokens.slice(0, 2))
      await mutateRoom(r.id, "accept", c, context(token));
    await mutateRoom(r.id, "finalize", c, context(r.tokens[0]));
    await expect(confirm(r.id, r.tokens[1])).rejects.toMatchObject({
      code: "ROOM_FINALIZED",
    });
    await expect(start(r, ["May", "Nat", "Ploy"])).rejects.toMatchObject({
      status: 409,
    });
    const before = (await getChat(r.id, r.tokens[1])).session.meal;
    await closeDatabase();
    expect((await getChat(r.id, r.tokens[1])).session.meal).toEqual(before);
    s = await getRoom(r.id, r.tokens[0]);
    await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), action: "reopen" },
      context(r.tokens[0]),
    );
    await start(r, ["May", "Nat", "Ploy"]);
    expect((await getRoom(r.id)).status).toBe("collecting");
  });
});
