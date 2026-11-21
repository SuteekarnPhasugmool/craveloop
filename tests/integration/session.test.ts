import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { emptyPreference } from "@/contracts";
import {
  migrate,
  closeDatabase,
  readSession,
  transact,
} from "@/server/database";
import { seedCatalog } from "@/server/seed";
import {
  createRoom,
  joinRoom,
  getRoom,
  mutateRoom,
  saveInput,
  extraction,
  trace,
  type Context,
} from "@/server/session-service";
import { handle } from "@/server/http";
import { cookieName } from "@/server/auth";
import { catalog } from "@/adapters/catalog";
import * as ai from "@/adapters/openai";
const dir = mkdtempSync(join(tmpdir(), "craveloop-test-"));
const key = () => randomUUID();
const ctx = (token?: string): Context => ({ token, key: key() });
const versions = (s: { preferenceVersion: number; rosterVersion: number }) => ({
  expectedPreferenceVersion: s.preferenceVersion,
  expectedRosterVersion: s.rosterVersion,
});
beforeAll(async () => {
  process.env.PERSISTENCE_DRIVER = "sqlite";
  process.env.SQLITE_PATH = join(dir, "test.sqlite");
  await migrate();
  await seedCatalog();
});
afterAll(async () => {
  await closeDatabase();
  rmSync(dir, { recursive: true, force: true });
});
async function room(ready = true) {
  const host = await createRoom(
    {
      hostName: "May",
      areaId: "bangkok_demo",
      mode: "dine_in",
      expectedSize: 4,
    },
    ctx(),
  );
  const id = host.result.sessionId;
  const tokens = [host.token];
  for (const name of ["Nat", "Ploy", "Ton"])
    tokens.push(
      (await joinRoom(id, { displayName: name, clientJoinId: key() }, ctx()))
        .token,
    );
  if (ready)
    for (const token of tokens) {
      const s = await getRoom(id, token);
      await mutateRoom(
        id,
        "confirm",
        {
          ...versions(s),
          expectedMemberRevision: 0,
          confirmedPreference: { ...emptyPreference, budgetMaxSatang: 20000 },
        },
        ctx(token),
      );
    }
  return { id, tokens };
}
async function rank(id: string, token: string) {
  const s = await getRoom(id, token);
  return mutateRoom(id, "rank", versions(s), ctx(token));
}
async function accepted() {
  const r = await room();
  const s = await rank(r.id, r.tokens[0]);
  const choice = {
    ...versions(s),
    rankingId: s.ranking!.id,
    restaurantId: s.ranking!.options[0].restaurantId,
  };
  await Promise.all(
    r.tokens.map((token) => mutateRoom(r.id, "accept", choice, ctx(token))),
  );
  return { ...r, choice };
}
describe("durable authorized transactional room lifecycle", () => {
  it("create and join retry exactly once, reject key reuse with different body", async () => {
    const k = key();
    const body = {
      hostName: "May",
      areaId: "bangkok_demo",
      mode: "dine_in",
      expectedSize: 4,
    };
    const a = await createRoom(body, { key: k });
    const b = await createRoom(body, { key: k });
    expect(a).toEqual(b);
    await expect(
      createRoom({ ...body, hostName: "Other" }, { key: k }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    const j = { displayName: "Nat", clientJoinId: key() };
    const c = { key: key() };
    await joinRoom(a.result.sessionId, j, c);
    await joinRoom(a.result.sessionId, j, c);
    await joinRoom(a.result.sessionId, j, { key: key() });
    expect((await getRoom(a.result.sessionId)).members).toHaveLength(2);
  });
  it("allows at most five concurrent joins and closes membership on first rank", async () => {
    const r = await room();
    const attempts = await Promise.allSettled(
      ["One", "Two", "Three"].map((displayName) =>
        joinRoom(r.id, { displayName, clientJoinId: key() }, ctx()),
      ),
    );
    expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const s = await getRoom(r.id, r.tokens[0]);
    expect(s.members.filter((m) => m.active)).toHaveLength(5);
    const extra = s.members.find((m) => !m.confirmed)!;
    await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), removeMemberId: extra.id },
      ctx(r.tokens[0]),
    );
    await rank(r.id, r.tokens[0]);
    await expect(
      joinRoom(r.id, { displayName: "Late", clientJoinId: key() }, ctx()),
    ).rejects.toMatchObject({ code: "MEMBERSHIP_CLOSED" });
  });
  it("rejects missing/wrong actor and redacts other personal preferences", async () => {
    const r = await room();
    const h = await getRoom(r.id, r.tokens[0]);
    await expect(
      mutateRoom(r.id, "rank", versions(h), ctx()),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      mutateRoom(r.id, "rank", versions(h), ctx(r.tokens[1])),
    ).rejects.toMatchObject({ status: 403 });
    const nat = await getRoom(r.id, r.tokens[1]);
    await expect(
      saveInput(
        r.id,
        { memberId: h.me!.id, kind: "text", text: "test", inputRevision: 1 },
        ctx(r.tokens[1]),
      ),
    ).rejects.toMatchObject({ code: "WRONG_ACTOR" });
    expect(nat.me!.id).not.toBe(h.me!.id);
    expect(nat.members[0]).not.toHaveProperty("preference");
    expect(JSON.stringify(await getRoom(r.id))).not.toMatch(
      /tokenHash|raw_text|budgetMaxSatang/,
    );
  });
  it("rejects ranking until everyone confirms", async () => {
    const r = await room(false);
    await expect(rank(r.id, r.tokens[0])).rejects.toMatchObject({
      code: "MEMBERS_NOT_READY",
    });
  });
  it("one of concurrent preference writes wins; stale writer cannot overwrite", async () => {
    const r = await room();
    const s = await getRoom(r.id, r.tokens[0]);
    const b = {
      ...versions(s),
      expectedMemberRevision: s.me!.revision,
      confirmedPreference: { ...emptyPreference, budgetMaxSatang: 11000 },
    };
    const writes = await Promise.allSettled([
      mutateRoom(r.id, "confirm", b, ctx(r.tokens[0])),
      mutateRoom(
        r.id,
        "confirm",
        {
          ...b,
          confirmedPreference: {
            ...b.confirmedPreference,
            budgetMaxSatang: 5000,
          },
        },
        ctx(r.tokens[0]),
      ),
    ]);
    expect(writes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      (await getRoom(r.id, r.tokens[0])).me!.preference!.budgetMaxSatang,
    ).toBe(11000);
  });
  it("budget change automatically replans and invalidates stale acceptances", async () => {
    const r = await accepted();
    const s = await getRoom(r.id, r.tokens[3]);
    const changed = await mutateRoom(
      r.id,
      "confirm",
      {
        ...versions(s),
        expectedMemberRevision: s.me!.revision,
        confirmedPreference: { ...emptyPreference, budgetMaxSatang: 100 },
      },
      ctx(r.tokens[3]),
    );
    expect(changed.ranking!.id).not.toBe(s.ranking!.id);
    expect(changed.preferenceVersion).toBe(s.preferenceVersion + 1);
    expect(changed.acceptances).toHaveLength(0);
    expect(changed.ranking!.status).toBe("no_match");
    await expect(
      mutateRoom(r.id, "accept", r.choice, ctx(r.tokens[1])),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await expect(
      mutateRoom(
        r.id,
        "accept",
        { ...r.choice, ...versions(changed) },
        ctx(r.tokens[1]),
      ),
    ).rejects.toMatchObject({ code: "STALE_RANKING" });
  });
  it("acceptance is one current choice per member; duplicate writes replay original outcome", async () => {
    const r = await room();
    const s = await rank(r.id, r.tokens[0]);
    const c = ctx(r.tokens[1]);
    const b = {
      ...versions(s),
      rankingId: s.ranking!.id,
      restaurantId: s.ranking!.options[0].restaurantId,
    };
    const first = await mutateRoom(r.id, "accept", b, c);
    expect(await mutateRoom(r.id, "accept", b, c)).toEqual(first);
    expect((await getRoom(r.id)).acceptances).toHaveLength(1);
    await mutateRoom(
      r.id,
      "accept",
      { ...b, restaurantId: s.ranking!.options[1].restaurantId },
      ctx(r.tokens[1]),
    );
    expect((await getRoom(r.id)).acceptances).toHaveLength(1);
    await mutateRoom(r.id, "withdraw", b, ctx(r.tokens[1]));
    expect((await getRoom(r.id)).acceptances).toHaveLength(0);
  });
  it("rejects nonunanimity; concurrent finalize commits exactly one event", async () => {
    const r = await room();
    let s = await rank(r.id, r.tokens[0]);
    const choice = {
      ...versions(s),
      rankingId: s.ranking!.id,
      restaurantId: s.ranking!.options[0].restaurantId,
    };
    await expect(
      mutateRoom(r.id, "finalize", choice, ctx(r.tokens[0])),
    ).rejects.toMatchObject({ code: "NO_CONSENSUS" });
    for (const token of r.tokens)
      s = await mutateRoom(r.id, "accept", choice, ctx(token));
    const outcomes = await Promise.allSettled([
      mutateRoom(r.id, "finalize", choice, ctx(r.tokens[0])),
      mutateRoom(r.id, "finalize", choice, ctx(r.tokens[0])),
    ]);
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await getRoom(r.id)).status).toBe("finalized");
    expect(
      (await trace(r.id, ctx(r.tokens[0]))).events.filter(
        (e) => e.type === "choice_finalized",
      ),
    ).toHaveLength(1);
  });
  it("finalize revalidates changed catalog availability", async () => {
    const r = await accepted();
    const restaurant = catalog.find((x) => x.id === r.choice.restaurantId)!;
    const old = restaurant.available;
    restaurant.available = false;
    try {
      await expect(
        mutateRoom(r.id, "finalize", r.choice, ctx(r.tokens[0])),
      ).rejects.toMatchObject({ code: "CATALOG_CHANGED" });
      expect((await getRoom(r.id)).status).toBe("voting");
    } finally {
      restaurant.available = old;
    }
  });
  it("finalized room blocks changes until host reopens; roster changes invalidate consensus", async () => {
    const r = await accepted();
    await mutateRoom(r.id, "finalize", r.choice, ctx(r.tokens[0]));
    let s = await getRoom(r.id, r.tokens[3]);
    await expect(
      mutateRoom(
        r.id,
        "confirm",
        {
          ...versions(s),
          expectedMemberRevision: s.me!.revision,
          confirmedPreference: emptyPreference,
        },
        ctx(r.tokens[3]),
      ),
    ).rejects.toMatchObject({ code: "ROOM_FINALIZED" });
    s = await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), action: "reopen" },
      ctx(r.tokens[0]),
    );
    expect(s.acceptances).toHaveLength(0);
    expect(s.finalizedOptionId).toBeNull();
    expect(s.membershipOpen).toBe(true);
    const removed = s.members.find((m) => m.displayName === "Ton")!;
    s = await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), removeMemberId: removed.id },
      ctx(r.tokens[0]),
    );
    expect(s.members.filter((m) => m.active)).toHaveLength(3);
    await expect(
      mutateRoom(r.id, "accept", r.choice, ctx(r.tokens[3])),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("mode change auto reranks with exact allocated fees and clears votes", async () => {
    const r = await accepted();
    let s = await getRoom(r.id, r.tokens[0]);
    s = await mutateRoom(
      r.id,
      "patch",
      { ...versions(s), mode: "delivery" },
      ctx(r.tokens[0]),
    );
    expect(s.acceptances).toHaveLength(0);
    expect(s.ranking!.id).not.toBe(r.choice.rankingId);
    for (const o of s.ranking!.options) {
      const restaurant = catalog.find((x) => x.id === o.restaurantId)!;
      expect(
        o.assignments.reduce((sum, a) => sum + a.allocatedFeeSatang!, 0),
      ).toBe(
        restaurant.feeQuote!.deliveryFeeSatang +
          restaurant.feeQuote!.serviceFeeSatang,
      );
    }
  });
  it("AI failure preserves confirmed prefs and polling never calls AI", async () => {
    const r = await room();
    const s = await getRoom(r.id, r.tokens[0]);
    const input = await saveInput(
      r.id,
      {
        memberId: s.me!.id,
        kind: "text",
        text: "เผ็ดน้อย งบ 150",
        inputRevision: 1,
      },
      ctx(r.tokens[0]),
    );
    const spy = vi
      .spyOn(ai, "extractPreferences")
      .mockRejectedValue(new AppErrorLike());
    try {
      await expect(
        extraction(r.id, input, ctx(r.tokens[0])),
      ).rejects.toMatchObject({ code: "AI_TIMEOUT" });
      for (let i = 0; i < 3; i++) await getRoom(r.id, r.tokens[0]);
      expect(spy).toHaveBeenCalledTimes(1);
      const after = await getRoom(r.id, r.tokens[0]);
      expect(after.me!.preference).toEqual(s.me!.preference);
      expect(after.preferenceVersion).toBe(s.preferenceVersion);
    } finally {
      spy.mockRestore();
    }
  });
  it("old extraction cannot overwrite newer confirmed explicit form", async () => {
    const r = await room();
    let s = await getRoom(r.id, r.tokens[0]);
    const input = await saveInput(
      r.id,
      { memberId: s.me!.id, kind: "text", text: "test", inputRevision: 1 },
      ctx(r.tokens[0]),
    );
    let resolve!: (x: unknown) => void;
    const draft = {
      cuisinePreferences: [],
      flavorTags: [],
      textureTags: [],
      dislikes: [],
      budgetMaxBaht: 200,
      excludedIngredients: [],
      dietaryRequirements: [],
      evidence: [],
      needsConfirmation: true,
      questions: [],
    };
    const spy = vi.spyOn(ai, "extractPreferences").mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r as (x: unknown) => void;
        }),
    );
    try {
      const job = extraction(r.id, input, ctx(r.tokens[0]));
      await new Promise((r) => setTimeout(r, 10));
      s = await mutateRoom(
        r.id,
        "confirm",
        {
          ...versions(s),
          expectedMemberRevision: s.me!.revision,
          confirmedPreference: { ...emptyPreference, budgetMaxSatang: 11000 },
        },
        ctx(r.tokens[0]),
      );
      resolve(draft);
      await expect(job).rejects.toMatchObject({ code: "STALE_EXTRACTION" });
      expect(
        (await getRoom(r.id, r.tokens[0])).me!.preference!.budgetMaxSatang,
      ).toBe(11000);
    } finally {
      spy.mockRestore();
    }
  });
  it("expired rooms reject reads", async () => {
    const r = await room();
    await transact(r.id, (s) => {
      s!.expiresAt = new Date(0).toISOString();
      return { session: s!, result: null };
    });
    await expect(getRoom(r.id)).rejects.toMatchObject({ code: "ROOM_EXPIRED" });
  });
  it("HTTP validates JSON, idempotency, origin and arbitrary member properties", async () => {
    let req = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      body: "{}",
    });
    expect((await handle(req)).status).toBe(400);
    req = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      body: "{",
      headers: { "Idempotency-Key": key() },
    });
    expect((await handle(req)).status).toBe(400);
    req = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      body: "{}",
      headers: { "Idempotency-Key": key(), Origin: "https://attacker.example" },
    });
    expect((await handle(req)).status).toBe(403);
    const r = await room();
    const s = await getRoom(r.id, r.tokens[0]);
    req = new NextRequest(
      `http://localhost:3000/api/sessions/${r.id}/preferences/me`,
      {
        method: "PUT",
        headers: {
          "Idempotency-Key": key(),
          Cookie: `${cookieName(r.id)}=${r.tokens[0]}`,
        },
        body: JSON.stringify({
          ...versions(s),
          expectedMemberRevision: 1,
          memberId: s.members[1].id,
          confirmedPreference: emptyPreference,
        }),
      },
    );
    expect((await handle(req, [r.id, "preferences", "me"])).status).toBe(422);
  });
  it("HTTP rejects foreign input extraction, SVG and invalid decoded images", async () => {
    const r = await room();
    const s = await getRoom(r.id, r.tokens[0]);
    const input = await saveInput(
      r.id,
      { memberId: s.me!.id, kind: "text", text: "text", inputRevision: 1 },
      ctx(r.tokens[0]),
    );
    await expect(
      extraction(r.id, input, ctx(r.tokens[1])),
    ).rejects.toMatchObject({ code: "WRONG_ACTOR" });
    for (const [mime, content] of [
      ["image/svg+xml", "<svg/>"],
      ["image/png", "not an image"],
    ]) {
      const form = new FormData();
      form.set("memberId", s.me!.id);
      form.set("kind", "image");
      form.set("inputRevision", "2");
      form.set("image", new File([content], "bad", { type: mime }));
      const req = new NextRequest(
        `http://localhost:3000/api/sessions/${r.id}/inputs`,
        {
          method: "POST",
          body: form,
          headers: {
            "Idempotency-Key": key(),
            Cookie: `${cookieName(r.id)}=${r.tokens[0]}`,
          },
        },
      );
      expect((await handle(req, [r.id, "inputs"])).status).toBe(422);
    }
  });
  it("bounds streamed request bodies even without a Content-Length header", async () => {
    const req = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      headers: { "Idempotency-Key": key() },
      body: "x".repeat(6 * 1024 * 1024 + 1),
    });
    expect((await handle(req)).status).toBe(413);
  });
  it("expired private images cannot be extracted and have no public read route", async () => {
    const r = await room();
    const s = await getRoom(r.id, r.tokens[0]);
    const input = await saveInput(
      r.id,
      {
        memberId: s.me!.id,
        kind: "image",
        text: "",
        inputRevision: 1,
        imageDataUrl: "data:image/png;base64,aGVsbG8=",
        imageExpiresAt: new Date(0).toISOString(),
      },
      ctx(r.tokens[0]),
    );
    await expect(
      extraction(r.id, input, ctx(r.tokens[0])),
    ).rejects.toMatchObject({ code: "IMAGE_EXPIRED" });
    const req = new NextRequest(
      `http://localhost:3000/api/sessions/${r.id}/inputs/${input.inputId}`,
    );
    expect((await handle(req, [r.id, "inputs", input.inputId])).status).toBe(
      404,
    );
    expect(JSON.stringify(await getRoom(r.id, r.tokens[1]))).not.toContain(
      "imageDataUrl",
    );
  });
  it("persisted aggregate and normalized projection survive reconnect", async () => {
    const r = await accepted();
    await closeDatabase();
    const s = await getRoom(r.id, r.tokens[0]);
    expect(s.acceptances).toHaveLength(4);
    expect(s.ranking!.options[0].assignments).toHaveLength(4);
    expect(
      (await readSession(r.id))!.members.every(
        (m) => m.tokenHash.length === 64,
      ),
    ).toBe(true);
  });
});
class AppErrorLike extends Error {
  status = 504;
  code = "AI_TIMEOUT";
  constructor() {
    super("AI request timed out. Manual preferences remain available.");
  }
}
