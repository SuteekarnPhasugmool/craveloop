import { randomUUID } from "node:crypto";
import { RouterRequest } from "@/contracts/router";
import { routePreference } from "@/adapters/preference-router";
import { aiStatus } from "@/adapters/openai";
import { assertMealParticipant } from "@/domain/meal";
import { transact } from "./database";
import { assert } from "./errors";
import {
  actor,
  cached,
  editable,
  requireSession,
  versions,
  type Context,
} from "./session-service";
import type { StoredSession } from "./state";

export async function routePrivateTurn(id: string, body: unknown, c: Context) {
  const b = RouterRequest.parse(body);
  function owner(s: StoredSession) {
    assert(
      s.experience === "group_order",
      409,
      "GROUP_ORDER_REQUIRED",
      "Open a Group Order room.",
    );
    const m = actor(s, c);
    editable(s);
    assertMealParticipant(s, m.id);
    versions(s, b);
    assert(
      m.revision === b.expectedMemberRevision,
      409,
      "STALE_MEMBER_REVISION",
      "Reopen your preference form.",
    );
    return m;
  }
  const turn = await transact(id, (s) => {
    requireSession(s);
    const m = owner(s);
    assert(
      !s.chatJourney && aiStatus().available,
      503,
      "AI_UNAVAILABLE",
      "กรุณาใช้แบบฟอร์มกรอกเอง",
    );
    let started = false;
    const draftId = cached(s, m.id, c.key, { action: "route", body: b }, () => {
      started = true;
      m.router = {
        id: randomUUID(),
        revision: m.revision,
        preferenceVersion: s.preferenceVersion,
        rosterVersion: s.rosterVersion,
      };
      return m.router.id;
    });
    assert(
      m.router?.id === draftId,
      409,
      "STALE_DRAFT",
      "Review your latest turn.",
    );
    assert(
      !m.router.failed,
      502,
      "AI_ROUTER_FAILED",
      "ร่างครั้งนี้ไม่สำเร็จ กรุณาลองอีกครั้งหรือกรอกเอง",
    );
    assert(
      started || m.router.result,
      409,
      "TURN_PENDING",
      "This turn has already started.",
    );
    return {
      session: s,
      result: { id: draftId, confirmed: m.confirmed, saved: m.router.result },
    };
  });
  if (turn.saved) return turn.saved;
  let draft;
  try {
    draft = await routePreference(
      b.text,
      b.confirmedPreference,
      turn.confirmed,
    );
  } catch (error) {
    await transact(id, (s) => {
      requireSession(s);
      const m = actor(s, c);
      if (m.router?.id === turn.id) m.router.failed = true;
      return { session: s, result: null };
    });
    throw error;
  }
  return transact(id, (s) => {
    requireSession(s);
    const m = owner(s);
    assert(
      m.router?.id === turn.id,
      409,
      "STALE_DRAFT",
      "Review your latest turn.",
    );
    m.router.result = { id: turn.id, ...draft };
    return { session: s, result: m.router.result };
  });
}
