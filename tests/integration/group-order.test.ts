import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import * as routerAdapter from "@/adapters/preference-router";
import { routePrivateTurn } from "@/server/preference-router";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  emptyPreference,
  type Preference,
  type SessionView,
} from "@/contracts";
import {
  migrate,
  closeDatabase,
  sqlite,
  transact,
  readSession,
} from "@/server/database";
import { seedCatalog } from "@/server/seed";
import {
  createRoom,
  joinRoom,
  getRoom,
  mutateRoom,
  previewNoodles,
  type Context,
} from "@/server/session-service";
import {
  postMeal,
  postHandoff,
  postCheckout,
} from "@/server/group-order-service";
import { handle } from "@/server/http";
import { postChat } from "@/server/chat-service";
import { cookieName } from "@/server/auth";
import { catalog } from "@/adapters/catalog";
const dir = mkdtempSync(join(tmpdir(), "craveloop-group-order-"));
const ctx = (token?: string): Context => ({ token, key: randomUUID() });
const versions = (s: { preferenceVersion: number; rosterVersion: number }) => ({
  expectedPreferenceVersion: s.preferenceVersion,
  expectedRosterVersion: s.rosterVersion,
});
beforeAll(async () => {
  process.env.PERSISTENCE_DRIVER = "sqlite";
  process.env.SQLITE_PATH = join(dir, "orders.sqlite");
  await migrate();
  await seedCatalog();
});
afterAll(async () => {
  await closeDatabase();
  rmSync(dir, { recursive: true, force: true });
});
async function group() {
  const h = await createRoom(
    {
      hostName: "May",
      areaId: "bangkok_demo",
      mode: "delivery",
      expectedSize: 4,
      experience: "group_order",
    },
    ctx(),
  );
  const id = h.result.sessionId,
    tokens = [h.token];
  for (const displayName of ["Nat", "Ploy"])
    tokens.push(
      (await joinRoom(id, { displayName, clientJoinId: randomUUID() }, ctx()))
        .token,
    );
  return { id, tokens };
}
async function optin(id: string, token: string) {
  const s = await getRoom(id, token);
  return postMeal(id, { action: "join", ...versions(s) }, ctx(token));
}
async function confirm(id: string, token: string, preference: Preference) {
  const s = await getRoom(id, token);
  return mutateRoom(
    id,
    "confirm",
    {
      ...versions(s),
      expectedMemberRevision: s.me!.revision,
      confirmedPreference: preference,
    },
    ctx(token),
  );
}
const preferences = (): Preference[] => [
  { ...emptyPreference, flavorTags: ["spicy"], budgetMaxSatang: 18000 },
  {
    ...emptyPreference,
    flavorTags: ["mild"],
    excludedIngredients: ["pork"],
    budgetMaxSatang: 15000,
  },
  {
    ...emptyPreference,
    dietaryRequirements: ["vegetarian"],
    budgetMaxSatang: 12000,
  },
];
async function ready(p = preferences()) {
  const r = await group();
  for (let i = 0; i < r.tokens.length; i++) {
    await optin(r.id, r.tokens[i]);
    await confirm(r.id, r.tokens[i], p[i]);
  }
  return r;
}
async function ranked(r: Awaited<ReturnType<typeof group>>) {
  const s = await getRoom(r.id, r.tokens[0]);
  return mutateRoom(r.id, "rank", versions(s), ctx(r.tokens[0]));
}
function choice(s: SessionView) {
  return {
    ...versions(s),
    rankingId: s.ranking!.id,
    restaurantId: s.ranking!.options[0].restaurantId,
  };
}
async function finalized() {
  const r = await ready(),
    s = await ranked(r),
    c = choice(s);
  await Promise.all(
    r.tokens.map((token) => mutateRoom(r.id, "accept", c, ctx(token))),
  );
  await mutateRoom(r.id, "finalize", c, ctx(r.tokens[0]));
  return { ...r, choice: c };
}

describe("synthetic Group Order handoff and checkout lifecycle", () => {
  it("reuses one provider turn per key and requires its owner to review the latest draft", async () => {
    const r = await ready(),
      [owner, peer] = r.tokens;
    const s = await getRoom(r.id, owner);
    const request = {
      ...versions(s),
      expectedMemberRevision: s.me!.revision,
      confirmedPreference: s.me!.preference!,
      text: "งบ 100 หรือ 150",
    };
    vi.stubEnv("OPENAI_API_KEY", "mock-only");
    vi.stubEnv("OPENAI_MODEL", "fixture-model");
    const adapter = vi
      .spyOn(routerAdapter, "routePreference")
      .mockResolvedValue({
        intent: "change_preference",
        preference: request.confirmedPreference,
        evidence: [],
        questions: ["ยืนยันงบในฟอร์ม"],
      });
    try {
      const context = ctx(owner);
      const draft = await routePrivateTurn(r.id, request, context);
      expect(await routePrivateTurn(r.id, request, context)).toEqual(draft);
      expect(adapter).toHaveBeenCalledTimes(1);
      const confirmation = {
        ...versions(s),
        expectedMemberRevision: s.me!.revision,
        confirmedPreference: draft.preference,
        routerDraftId: draft.id,
      };
      await expect(
        mutateRoom(r.id, "confirm", confirmation, ctx(peer)),
      ).rejects.toMatchObject({ code: "STALE_DRAFT" });
      await expect(
        mutateRoom(r.id, "confirm", confirmation, ctx(owner)),
      ).rejects.toMatchObject({ code: "REVIEW_QUESTIONS" });
      const latest = await routePrivateTurn(r.id, request, ctx(owner));
      await expect(
        mutateRoom(
          r.id,
          "confirm",
          { ...confirmation, reviewedQuestions: true },
          ctx(owner),
        ),
      ).rejects.toMatchObject({ code: "STALE_DRAFT" });
      expect(JSON.stringify(await getRoom(r.id, peer))).not.toContain(
        latest.id,
      );
      const saved = await mutateRoom(
        r.id,
        "confirm",
        { ...confirmation, routerDraftId: latest.id, reviewedQuestions: true },
        ctx(owner),
      );
      expect(saved.me!.revision).toBe(s.me!.revision + 1);
      const failedTurn = {
        ...request,
        ...versions(saved),
        expectedMemberRevision: saved.me!.revision,
      };
      const failedContext = ctx(owner);
      adapter.mockRejectedValueOnce(new Error("unavailable"));
      await expect(
        routePrivateTurn(r.id, failedTurn, failedContext),
      ).rejects.toThrow("unavailable");
      await expect(
        routePrivateTurn(r.id, failedTurn, failedContext),
      ).rejects.toMatchObject({ code: "AI_ROUTER_FAILED" });
      expect(adapter).toHaveBeenCalledTimes(3);
    } finally {
      adapter.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("keeps simulations private and read-only, verifies the signed choice, and replans after confirmation", async () => {
    const broad: Preference = {
      ...emptyPreference,
      noodle: "any",
      excludedIngredients: ["shrimp"],
      budgetMaxSatang: 12000,
    };
    const r = await ready([broad, emptyPreference, emptyPreference]);
    const [owner, peer] = r.tokens;
    const s = await ranked(r);
    await mutateRoom(r.id, "accept", choice(s), ctx(peer));
    const before = await readSession(r.id);
    const body = {
      ...versions(s),
      expectedMemberRevision: s.me!.revision,
      confirmedPreference: broad,
    };
    const preview = await previewNoodles(r.id, body, ctx(owner));
    expect(await readSession(r.id)).toEqual(before);
    expect(preview.choices.map((c) => c.style)).toEqual([
      "broth",
      "stir_fried",
    ]);
    const picked = {
      ...body,
      confirmedPreference: { ...broad, noodle: "broth" },
      noodleDraft: preview.choices[0].draft,
    };
    await expect(
      mutateRoom(r.id, "confirm", picked, ctx(peer)),
    ).rejects.toMatchObject({ code: "STALE_NOODLE_DRAFT" });
    await expect(
      mutateRoom(
        r.id,
        "confirm",
        { ...picked, confirmedPreference: { ...broad, noodle: "stir_fried" } },
        ctx(owner),
      ),
    ).rejects.toMatchObject({ code: "STALE_NOODLE_DRAFT" });
    expect(s.ingredientProofs?.join(" ")).toContain(
      "r03-m03 → paste-x → shrimp",
    );
    expect((await getRoom(r.id, peer)).ingredientProofs).toEqual([]);
    expect(JSON.stringify(await getRoom(r.id))).not.toContain("recipe-03-03");
    const reranked = await ranked(r);
    await expect(
      mutateRoom(r.id, "confirm", picked, ctx(owner)),
    ).rejects.toMatchObject({ code: "STALE_NOODLE_DRAFT" });
    const next = await previewNoodles(r.id, body, ctx(owner));
    await mutateRoom(r.id, "accept", choice(reranked), ctx(peer));
    const saved = await mutateRoom(
      r.id,
      "confirm",
      { ...picked, noodleDraft: next.choices[0].draft },
      ctx(owner),
    );
    expect(saved.ranking!.options[0].restaurantId).not.toBe(
      reranked.ranking!.options[0].restaurantId,
    );
    expect(saved.me!.preference).toEqual(picked.confirmedPreference);
    expect(saved.acceptances).toEqual([]);
    await expect(
      mutateRoom(r.id, "confirm", picked, ctx(owner)),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("requires current graph evidence at acceptance, finalization, handoff and checkout", async () => {
    const r = await ready();
    const rankedRoom = await ranked(r);
    const current = choice(rankedRoom);
    for (const token of r.tokens)
      await mutateRoom(r.id, "accept", current, ctx(token));
    await transact(r.id, (s) => {
      delete s!.rankings.at(-1)!.graphVersion; // legacy snapshot
      return { session: s!, result: null };
    });
    for (const action of ["accept", "finalize"] as const)
      await expect(
        mutateRoom(r.id, action, current, ctx(r.tokens[0])),
      ).rejects.toMatchObject({ code: "STALE_RANKING" });
    const fresh = await ranked(r);
    expect(fresh.acceptances).toEqual([]);
    const c = choice(fresh);
    for (const token of r.tokens)
      await mutateRoom(r.id, "accept", c, ctx(token));
    await mutateRoom(r.id, "finalize", c, ctx(r.tokens[0]));
    const cart = await postHandoff(r.id, c, ctx(r.tokens[0]));
    await transact(r.id, (s) => {
      s!.handoff!.graphVersion = "obsolete";
      return { session: s!, result: null };
    });
    await expect(
      postCheckout(
        r.id,
        { ...c, handoffId: cart.handoff!.id },
        ctx(r.tokens[0]),
      ),
    ).rejects.toMatchObject({ code: "STALE_HANDOFF" });
    await transact(r.id, (s) => {
      s!.rankings.at(-1)!.graphVersion = "obsolete";
      return { session: s!, result: null };
    });
    await expect(postHandoff(r.id, c, ctx(r.tokens[0]))).rejects.toMatchObject({
      code: "STALE_RANKING",
    });
  });
  it("creates delivery group with automatic selection but never automatic personal consent", async () => {
    const r = await group(),
      s = await getRoom(r.id, r.tokens[0]);
    expect(s.experience).toBe("group_order");
    expect(s.mode).toBe("delivery");
    expect(s.members).toHaveLength(3);
    expect(s.meal!.selectedMemberIds).toHaveLength(3);
    expect(s.meal!.joinedMemberIds).toEqual([]);
    expect(s.handoff ?? null).toBeNull();
    await expect(
      confirm(r.id, r.tokens[0], emptyPreference),
    ).rejects.toMatchObject({ code: "MEAL_NOT_JOINED" });
  });
  it("rejects dine-in creation or mode changes and legacy chat mutation bypass for Group Order", async () => {
    await expect(
      createRoom(
        {
          hostName: "May",
          areaId: "bangkok_demo",
          mode: "dine_in",
          expectedSize: 4,
          experience: "group_order",
        },
        ctx(),
      ),
    ).rejects.toMatchObject({ code: "DELIVERY_REQUIRED" });
    const r = await group(),
      s = await getRoom(r.id, r.tokens[0]);
    await expect(
      mutateRoom(
        r.id,
        "patch",
        { ...versions(s), mode: "dine_in" },
        ctx(r.tokens[0]),
      ),
    ).rejects.toMatchObject({ code: "DELIVERY_REQUIRED" });
    await expect(
      postChat(r.id, { action: "invite_bot" }, ctx(r.tokens[0])),
    ).rejects.toMatchObject({ code: "GROUP_ORDER_ROUTE" });
    expect((await getRoom(r.id)).mode).toBe("delivery");
  });
  it("keeps unanswered selected people in readiness and supports actual no-match budget recovery", async () => {
    const r = await group(),
      p = preferences();
    for (let i = 0; i < 2; i++) {
      await optin(r.id, r.tokens[i]);
      await confirm(r.id, r.tokens[i], p[i]);
    }
    await expect(ranked(r)).rejects.toMatchObject({ status: 422 });
    await optin(r.id, r.tokens[2]);
    await confirm(r.id, r.tokens[2], { ...p[2], budgetMaxSatang: 0 });
    let s = await ranked(r);
    expect(s.ranking!.status).toBe("no_match");
    expect(s.ranking!.options).toEqual([]);
    s = await confirm(r.id, r.tokens[2], p[2]);
    expect(s.ranking!.status).toBe("ok");
    expect(s.ranking!.options.every((o) => o.assignments.length === 3)).toBe(
      true,
    );
  });
  it("redacts personal constraint evidence and attributed rejection details from public views", async () => {
    const r = await ready(),
      s = await ranked(r);
    for (const option of s.ranking!.options)
      for (const a of option.assignments)
        expect(a.constraintEvidence ?? []).toEqual([]);
    await confirm(r.id, r.tokens[2], {
      ...preferences()[2],
      budgetMaxSatang: 0,
    });
    const publicView = await getRoom(r.id);
    expect(publicView.me).toBeNull();
    expect(publicView.ranking!.rejections.length).toBeGreaterThan(0);
    for (const reason of publicView.ranking!.rejections) {
      expect(reason).not.toHaveProperty("memberId");
      expect(reason).not.toHaveProperty("menuId");
    }
    expect(JSON.stringify(publicView)).not.toMatch(
      /excludedIngredients|dietaryRequirements|allergies/,
    );
  });
  it("requires own consent, strict bodies and host authority for setup, handoff and checkout", async () => {
    const r = await group(),
      s = await getRoom(r.id, r.tokens[0]);
    await expect(
      postMeal(
        r.id,
        { action: "join", ...versions(s), memberId: s.members[1].id },
        ctx(r.tokens[0]),
      ),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      postMeal(
        r.id,
        {
          action: "configure",
          ...versions(s),
          areaId: "bangkok_demo",
          selectedMemberIds: s.meal!.selectedMemberIds,
        },
        ctx(r.tokens[1]),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      postMeal(r.id, { action: "join", ...versions(s) }, ctx()),
    ).rejects.toMatchObject({ status: 401 });
    const done = await finalized();
    await expect(
      postHandoff(done.id, done.choice, ctx(done.tokens[1])),
    ).rejects.toMatchObject({ status: 403 });
    const cart = await postHandoff(done.id, done.choice, ctx(done.tokens[0]));
    await expect(
      postCheckout(
        done.id,
        { ...done.choice, handoffId: cart.handoff!.id },
        ctx(done.tokens[1]),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("HTTP exposes validated meal/handoff/checkout envelopes with room cookies", async () => {
    const r = await ready();
    const request = (route: string, token: string, body: unknown) =>
      new NextRequest(`http://localhost:3000/api/sessions/${r.id}/${route}`, {
        method: "POST",
        headers: {
          Cookie: `${cookieName(r.id)}=${token}`,
          "Idempotency-Key": randomUUID(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    let s = await getRoom(r.id, r.tokens[0]);
    let response = await handle(
      request("meal", r.tokens[0], { action: "join", ...versions(s) }),
      [r.id, "meal"],
    );
    expect(response.status).toBe(200);
    expect((await response.json()).requestId).toEqual(expect.any(String));
    s = await ranked(r);
    const c = choice(s);
    for (const token of r.tokens)
      await mutateRoom(r.id, "accept", c, ctx(token));
    await mutateRoom(r.id, "finalize", c, ctx(r.tokens[0]));
    response = await handle(request("handoff", r.tokens[0], c), [
      r.id,
      "handoff",
    ]);
    expect(response.status).toBe(200);
    const cart = await response.json();
    expect(cart.requestId).toEqual(expect.any(String));
    expect(cart.data.handoff.simulated).toBe(true);
    response = await handle(
      request("checkout", r.tokens[0], {
        ...c,
        handoffId: cart.data.handoff.id,
      }),
      [r.id, "checkout"],
    );
    expect(response.status).toBe(200);
    expect((await response.json()).data.handoff.status).toBe(
      "checkout_summary",
    );
  });
  it("requires finalize before cart generation and unanimous current acceptances before finalize", async () => {
    const r = await ready(),
      s = await ranked(r),
      c = choice(s);
    await expect(postHandoff(r.id, c, ctx(r.tokens[0]))).rejects.toMatchObject({
      status: 409,
    });
    await mutateRoom(r.id, "accept", c, ctx(r.tokens[0]));
    await expect(
      mutateRoom(r.id, "finalize", c, ctx(r.tokens[0])),
    ).rejects.toMatchObject({ code: "NO_CONSENSUS" });
    await expect(postHandoff(r.id, c, ctx(r.tokens[0]))).rejects.toMatchObject({
      status: 409,
    });
  });
  it("concurrent personal acceptance yields one finalized immutable menu/cost snapshot per member", async () => {
    const r = await finalized(),
      s = await postHandoff(r.id, r.choice, ctx(r.tokens[0])),
      cart = s.handoff!;
    expect(cart.platform).toBe("shopeefood_concept");
    expect(cart.simulated).toBe(true);
    expect(cart.items).toHaveLength(3);
    expect(new Set(cart.items.map((i) => i.memberId)).size).toBe(3);
    expect(
      cart.items.every(
        (i) =>
          i.quantity === 1 &&
          i.itemCostSatang + i.allocatedFeeSatang === i.totalCostSatang,
      ),
    ).toBe(true);
    expect(cart.subtotalSatang).toBe(
      cart.items.reduce((n, i) => n + i.itemCostSatang, 0),
    );
    expect(cart.allocatedFeesSatang).toBe(
      cart.items.reduce((n, i) => n + i.allocatedFeeSatang, 0),
    );
    expect(cart.totalSatang).toBe(
      cart.subtotalSatang + cart.allocatedFeesSatang,
    );
    expect(cart.allocatedFeesSatang).toBe(4000);
    for (const i of cart.items) {
      const owner = s.members.find((m) => m.id === i.memberId)!;
      expect(i.totalCostSatang).toBeLessThanOrEqual(
        preferences()[["May", "Nat", "Ploy"].indexOf(owner.displayName)]
          .budgetMaxSatang!,
      );
    }
    expect(cart).not.toHaveProperty("orderId");
    expect(cart).not.toHaveProperty("paymentId");
  });
  it("replays same and different-key cart/checkout requests without duplicate cart or checkout timestamps", async () => {
    const r = await finalized(),
      c = ctx(r.tokens[0]);
    const first = await postHandoff(r.id, r.choice, c);
    expect((await postHandoff(r.id, r.choice, c)).handoff!.id).toBe(
      first.handoff!.id,
    );
    expect(
      (await postHandoff(r.id, r.choice, ctx(r.tokens[0]))).handoff!.id,
    ).toBe(first.handoff!.id);
    const body = { ...r.choice, handoffId: first.handoff!.id };
    const outcomes = await Promise.all([
      postCheckout(r.id, body, ctx(r.tokens[0])),
      postCheckout(r.id, body, ctx(r.tokens[0])),
    ]);
    expect(outcomes[0].handoff).toEqual(outcomes[1].handoff);
    expect(outcomes[0].handoff!.status).toBe("checkout_summary");
    expect(outcomes[0].handoff!.checkoutAt).toEqual(expect.any(String));
    expect((await postHandoff(r.id, r.choice, c)).handoff!.status).toBe(
      "checkout_summary",
    );
    const count = sqlite()
      .prepare("SELECT COUNT(*) AS n FROM cart_handoffs WHERE session_id=?")
      .get(r.id) as { n: number };
    expect(count.n).toBe(1);
    await expect(
      postHandoff(r.id, { ...r.choice, restaurantId: "different" }, c),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("explicit reopen invalidates persisted cart and rejects stale same-key handoff/checkout receipts", async () => {
    const r = await finalized(),
      c = ctx(r.tokens[0]),
      cart = await postHandoff(r.id, r.choice, c);
    const checkoutContext = ctx(r.tokens[0]),
      checkoutBody = { ...r.choice, handoffId: cart.handoff!.id };
    await postCheckout(r.id, checkoutBody, checkoutContext);
    let s = await getRoom(r.id, r.tokens[0]);
    s = await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), action: "reopen" },
      ctx(r.tokens[0]),
    );
    expect(s.handoff!.status).toBe("invalidated");
    expect(s.acceptances).toEqual([]);
    await expect(postHandoff(r.id, r.choice, c)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      postCheckout(r.id, checkoutBody, checkoutContext),
    ).rejects.toMatchObject({ status: 409 });
    await confirm(r.id, r.tokens[1], {
      ...preferences()[1],
      budgetMaxSatang: 11000,
    });
    expect((await getRoom(r.id)).handoff!.status).toBe("invalidated");
  });
  it("rejects an obsolete cart ID even with the fresh decision versions and ranking", async () => {
    const r = await finalized(),
      old = await postHandoff(r.id, r.choice, ctx(r.tokens[0]));
    await expect(
      confirm(r.id, r.tokens[1], preferences()[1]),
    ).rejects.toMatchObject({ code: "ROOM_FINALIZED" });
    let s = await getRoom(r.id, r.tokens[0]);
    await postMeal(
      r.id,
      {
        action: "configure",
        ...versions(s),
        selectedMemberIds: s.meal!.selectedMemberIds,
        areaId: "bangkok_demo",
      },
      ctx(r.tokens[0]),
    );
    s = await ranked(r);
    const current = choice(s);
    for (const token of r.tokens)
      await mutateRoom(r.id, "accept", current, ctx(token));
    await mutateRoom(r.id, "finalize", current, ctx(r.tokens[0]));
    const fresh = await postHandoff(r.id, current, ctx(r.tokens[0]));
    expect(fresh.handoff!.id).not.toBe(old.handoff!.id);
    await expect(
      postCheckout(
        r.id,
        { ...current, handoffId: old.handoff!.id },
        ctx(r.tokens[0]),
      ),
    ).rejects.toMatchObject({ code: "STALE_HANDOFF" });
    expect(
      (
        await postCheckout(
          r.id,
          { ...current, handoffId: fresh.handoff!.id },
          ctx(r.tokens[0]),
        )
      ).handoff!.status,
    ).toBe("checkout_summary");
  });
  it("adding a group member after explicit reopen invalidates the old decision without auto consent or dropping retained constraints", async () => {
    const r = await finalized();
    await postHandoff(r.id, r.choice, ctx(r.tokens[0]));
    let s = await getRoom(r.id, r.tokens[0]);
    await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), action: "reopen" },
      ctx(r.tokens[0]),
    );
    await joinRoom(
      r.id,
      { displayName: "Ton", clientJoinId: randomUUID() },
      ctx(),
    );
    s = await getRoom(r.id, r.tokens[1]);
    expect(s.handoff!.status).toBe("invalidated");
    expect(s.meal!.selectedMemberIds).toHaveLength(4);
    expect(s.meal!.joinedMemberIds).toHaveLength(3);
    expect(s.me!.preference!.excludedIngredients).toEqual(["pork"]);
    await expect(ranked(r)).rejects.toMatchObject({ status: 422 });
  });
  it("configure atomically reopens, changes the selected roster and invalidates cart while preserving retained consent", async () => {
    const r = await finalized();
    await postHandoff(r.id, r.choice, ctx(r.tokens[0]));
    const before = await getRoom(r.id, r.tokens[0]);
    const next = await postMeal(
      r.id,
      {
        action: "configure",
        ...versions(before),
        selectedMemberIds: before.meal!.selectedMemberIds.slice(0, 2),
        areaId: "bangkok_demo",
      },
      ctx(r.tokens[0]),
    );
    expect(next.membershipOpen).toBe(true);
    expect(next.status).toBe("collecting");
    expect(next.handoff!.status).toBe("invalidated");
    expect(next.ranking).toBeNull();
    expect(next.acceptances).toEqual([]);
    expect(next.meal!.joinedMemberIds).toHaveLength(2);
    expect(next.meal!.selectedMemberIds).toHaveLength(2);
    await expect(
      postCheckout(
        r.id,
        { ...r.choice, handoffId: next.handoff!.id },
        ctx(r.tokens[0]),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects changed catalog availability and obsolete algorithm snapshots before handing off", async () => {
    const r = await finalized(),
      rest = catalog.find((x) => x.id === r.choice.restaurantId)!;
    const old = rest.available;
    rest.available = false;
    try {
      await expect(
        postHandoff(r.id, r.choice, ctx(r.tokens[0])),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      rest.available = old;
    }
    await transact(r.id, (s) => {
      s!.rankings.find((x) => x.id === s!.currentRankingId)!.algorithmVersion =
        "obsolete";
      return { session: s!, result: null };
    });
    await expect(
      postHandoff(r.id, r.choice, ctx(r.tokens[0])),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("refuses unknown-cost carts even when an unlimited-budget decision could be finalized", async () => {
    const original = [...catalog],
      one = catalog[0],
      oldPrices = one.menus.map((m) => ({ ...m.prices }));
    try {
      catalog.splice(0, catalog.length, one);
      one.menus.forEach((m) => {
        m.prices.delivery = null;
      });
      const r = await ready([
          emptyPreference,
          emptyPreference,
          emptyPreference,
        ]),
        s = await ranked(r),
        c = choice(s);
      expect(
        s.ranking!.options[0].assignments.every(
          (a) => a.totalCostSatang === null,
        ),
      ).toBe(true);
      for (const token of r.tokens)
        await mutateRoom(r.id, "accept", c, ctx(token));
      await mutateRoom(r.id, "finalize", c, ctx(r.tokens[0]));
      await expect(
        postHandoff(r.id, c, ctx(r.tokens[0])),
      ).rejects.toMatchObject({ status: 422 });
    } finally {
      one.menus.forEach((m, i) => {
        m.prices = oldPrices[i];
      });
      catalog.splice(0, catalog.length, ...original);
    }
  });
  it("restores simulated checkout, participant capabilities and exact immutable cart across database reconnect", async () => {
    const r = await finalized(),
      cart = await postHandoff(r.id, r.choice, ctx(r.tokens[0]));
    const checkout = await postCheckout(
      r.id,
      { ...r.choice, handoffId: cart.handoff!.id },
      ctx(r.tokens[0]),
    );
    await closeDatabase();
    const restored = await getRoom(r.id, r.tokens[1]);
    expect(restored.me!.displayName).toBe("Nat");
    expect(restored.handoff).toEqual(checkout.handoff);
    expect(restored.acceptances).toHaveLength(3);
    expect(restored.status).toBe("finalized");
  });
});
