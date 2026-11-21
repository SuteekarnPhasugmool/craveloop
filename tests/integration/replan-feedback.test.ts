import { beforeAll, afterAll, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { emptyPreference, type SessionView } from "@/contracts";
import {
  migrate,
  closeDatabase,
  transact,
  readSession,
} from "@/server/database";
import { seedCatalog } from "@/server/seed";
import { createRoom, getRoom, mutateRoom } from "@/server/session-service";
import { postChat, getChat } from "@/server/chat-service";
const dir = mkdtempSync(join(tmpdir(), "craveloop-feedback-"));
const key = () => randomUUID();
const versions = (s: SessionView) => ({
  expectedPreferenceVersion: s.preferenceVersion,
  expectedRosterVersion: s.rosterVersion,
});
beforeAll(async () => {
  process.env.PERSISTENCE_DRIVER = "sqlite";
  process.env.SQLITE_PATH = join(dir, "db.sqlite");
  await migrate();
  await seedCatalog();
});
afterAll(async () => {
  await closeDatabase();
  rmSync(dir, { recursive: true, force: true });
});
async function ranked() {
  const h = await createRoom(
    {
      hostName: "Tester",
      areaId: "bangkok_demo",
      mode: "dine_in",
      expectedSize: 4,
      experience: "chat",
    },
    { key: key() },
  );
  const id = h.result.sessionId,
    c = () => ({ token: h.token, key: key() });
  await postChat(id, { action: "invite_bot" }, c());
  let s = await getRoom(id, h.token);
  s = (
    await postChat(
      id,
      {
        action: "start_meal",
        ...versions(s),
        selectedMemberIds: [s.me!.id],
        areaId: "bangkok_demo",
        mode: "dine_in",
      },
      c(),
    )
  ).session;
  s = (await postChat(id, { action: "join_meal", ...versions(s) }, c()))
    .session;
  s = await mutateRoom(
    id,
    "confirm",
    {
      ...versions(s),
      expectedMemberRevision: s.me!.revision,
      confirmedPreference: { ...emptyPreference, budgetMaxSatang: 20000 },
    },
    c(),
  );
  s = await mutateRoom(id, "rank", versions(s), c());
  return { id, c, s, token: h.token };
}
it("changing a nonbinding budget automatically reranks, clears consent, and truthfully reports identical recommendations", async () => {
  const r = await ranked();
  expect(r.s.ranking!.update!.outcome).toBe("initial");
  const old = r.s.ranking!;
  let s = await mutateRoom(
    r.id,
    "accept",
    {
      ...versions(r.s),
      rankingId: old.id,
      restaurantId: old.options[0].restaurantId,
    },
    r.c(),
  );
  s = await mutateRoom(
    r.id,
    "confirm",
    {
      ...versions(s),
      expectedMemberRevision: s.me!.revision,
      confirmedPreference: { ...s.me!.preference!, budgetMaxSatang: 18000 },
    },
    r.c(),
  );
  expect(s.ranking!.id).not.toBe(old.id);
  expect(s.preferenceVersion).toBe(r.s.preferenceVersion + 1);
  expect(s.acceptances).toEqual([]);
  expect(s.ranking!.options).toEqual(old.options);
  expect(s.ranking!.update).toEqual({
    outcome: "unchanged",
    previousRankingId: old.id,
  });
  expect((await getChat(r.id, r.token)).chat.messages.at(-1)!.text).toContain(
    "ยังเหมือนเดิม",
  );
  await expect(
    mutateRoom(
      r.id,
      "accept",
      {
        ...versions(s),
        rankingId: old.id,
        restaurantId: old.options[0].restaurantId,
      },
      r.c(),
    ),
  ).rejects.toMatchObject({ code: "STALE_RANKING" });
});
it("a binding budget change produces a fresh no-match without hiding the new constraints", async () => {
  const r = await ranked();
  const s = await mutateRoom(
    r.id,
    "confirm",
    {
      ...versions(r.s),
      expectedMemberRevision: r.s.me!.revision,
      confirmedPreference: { ...r.s.me!.preference!, budgetMaxSatang: 0 },
    },
    r.c(),
  );
  expect(s.ranking!.update!.outcome).toBe("changed");
  expect(s.ranking!.status).toBe("no_match");
  expect(s.ranking!.rejections.some((x) => x.code === "BUDGET_EXCEEDED")).toBe(
    true,
  );
});
it("changed cravings and mode still change actual recommendations/costs rather than forcing identical outputs", async () => {
  const r = await ranked();
  let s = await mutateRoom(
    r.id,
    "confirm",
    {
      ...versions(r.s),
      expectedMemberRevision: r.s.me!.revision,
      confirmedPreference: {
        ...r.s.me!.preference!,
        cuisinePreferences: ["japanese"],
      },
    },
    r.c(),
  );
  expect(s.ranking!.update!.outcome).toBe("changed");
  const before = s.ranking!;
  s = await mutateRoom(
    r.id,
    "patch",
    { ...versions(s), mode: "delivery" },
    r.c(),
  );
  expect(s.ranking!.update).toEqual({
    outcome: "changed",
    previousRankingId: before.id,
  });
  expect(
    s.ranking!.options[0].assignments[0].allocatedFeeSatang,
  ).toBeGreaterThan(0);
});
it("existing saved rooms receive comparison feedback on read without rewriting their history or preferences", async () => {
  const r = await ranked();
  await mutateRoom(r.id, "rank", versions(r.s), r.c());
  await transact(r.id, (s) => {
    for (const ranking of s!.rankings) delete ranking.update;
    return { session: s!, result: null };
  });
  const before = await readSession(r.id);
  const s = await getRoom(r.id, r.token);
  expect(s.ranking!.update!.outcome).toBe("unchanged");
  expect(await readSession(r.id)).toEqual(before);
});
