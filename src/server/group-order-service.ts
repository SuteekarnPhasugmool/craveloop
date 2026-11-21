import {
  MealActionSchema,
  HandoffSchema,
  CheckoutSchema,
} from "@/contracts/group-order";
import { catalog, CATALOG_VERSION, currentSnapshot } from "@/adapters/catalog";
import { simulatedHandoff } from "@/adapters/group-order";
import { mealMembers, mealReady } from "@/domain/meal";
import { rankRestaurants } from "@/domain/ranking";
import { assert } from "./errors";
import { transact } from "./database";
import {
  actor,
  requireSession,
  versions,
  cached,
  view,
  invalidate,
  event,
  editable,
  type Context,
} from "./session-service";
import type { StoredSession } from "./state";
import type { z } from "zod";

function groupOrder(s: StoredSession) {
  assert(
    s.experience === "group_order" && s.mode === "delivery",
    409,
    "GROUP_ORDER_REQUIRED",
    "เปิดมื้อแบบ Group Order จากหน้าหลักก่อน",
  );
}

export async function postMeal(id: string, body: unknown, c: Context) {
  const b = MealActionSchema.parse(body);
  return transact(id, (s) => {
    requireSession(s);
    groupOrder(s);
    const m = actor(s, c, b.action === "configure");
    cached(s, m.id, c.key, { action: "group_meal", body: b }, () => {
      versions(s, b);
      const meal = s.chat!.meal!;
      if (b.action === "join") {
        editable(s);
        assert(
          meal.selectedMemberIds.includes(m.id),
          403,
          "MEAL_NOT_SELECTED",
          "คุณยังไม่ได้อยู่ในรายชื่อผู้ร่วมมื้อ",
        );
        if (!meal.joinedMemberIds.includes(m.id)) {
          meal.joinedMemberIds.push(m.id);
          s.rosterVersion++;
          invalidate(s, "สมาชิกเข้าร่วมมื้อแล้ว กรุณารอทุกคนยืนยันความต้องการ");
          event(s, "meal_joined", { memberId: m.id });
        }
      } else {
        assert(
          b.selectedMemberIds.every((id) =>
            s.members.some((member) => member.id === id && member.active),
          ),
          422,
          "INVALID_MEAL_ROSTER",
          "เลือกเฉพาะสมาชิกที่ยังอยู่ในกลุ่ม",
        );
        const retained = new Set(meal.selectedMemberIds);
        for (const member of s.members) {
          if (
            b.selectedMemberIds.includes(member.id) &&
            !retained.has(member.id)
          ) {
            member.confirmed = false;
            member.revision++;
          }
        }
        meal.phase = "collecting";
        meal.selectedMemberIds = b.selectedMemberIds;
        meal.joinedMemberIds = meal.joinedMemberIds.filter((id) =>
          b.selectedMemberIds.includes(id),
        );
        s.areaId = b.areaId;
        s.membershipOpen = true;
        s.preferenceVersion++;
        s.rosterVersion++;
        invalidate(
          s,
          "ผู้จัดเปิดมื้อใหม่หรือเปลี่ยนสมาชิก ผล เสียงยอมรับ และตะกร้าเดิมใช้ต่อไม่ได้",
        );
        event(s, "group_meal_configured", {
          selectedMemberIds: b.selectedMemberIds,
        });
      }
      return { applied: true };
    });
    return { session: s, result: view(s, c.token) };
  });
}

/** Recheck under the same database lock even for an idempotent replay. */
function finalizedChoice(s: StoredSession, b: z.infer<typeof HandoffSchema>) {
  groupOrder(s);
  versions(s, b);
  const ranking = s.rankings.find((r) => r.id === s.currentRankingId);
  assert(
    ranking &&
      ranking.id === b.rankingId &&
      ranking.preferenceVersion === s.preferenceVersion &&
      ranking.rosterVersion === s.rosterVersion &&
      currentSnapshot(ranking),
    409,
    "STALE_RANKING",
    "ข้อเสนอนี้เก่าแล้ว กรุณาตรวจผลล่าสุด",
  );
  assert(
    s.status === "finalized" && s.finalizedOptionId === b.restaurantId,
    409,
    "DECISION_NOT_FINALIZED",
    "ทุกคนต้องยอมรับและผู้จัดยืนยันข้อเสนอนี้ก่อนส่งเข้าตะกร้า",
  );
  const members = mealMembers(s);
  assert(
    mealReady(s) &&
      members.every((m) =>
        s.acceptances.some(
          (a) =>
            a.memberId === m.id &&
            a.rankingId === ranking.id &&
            a.restaurantId === b.restaurantId,
        ),
      ),
    409,
    "NO_CONSENSUS",
    "สมาชิกทุกคนต้องยอมรับข้อเสนอปัจจุบันเดียวกัน",
  );
  const fresh = rankRestaurants(
    {
      preferenceVersion: s.preferenceVersion,
      rosterVersion: s.rosterVersion,
      areaId: s.areaId,
      mode: s.mode,
      catalogVersion: CATALOG_VERSION,
      members: members.map((m) => ({ id: m.id, preference: m.preference! })),
    },
    catalog,
  ).options.find((o) => o.restaurantId === b.restaurantId);
  const original = ranking.options.find(
    (o) => o.restaurantId === b.restaurantId,
  );
  assert(
    fresh && original && JSON.stringify(fresh) === JSON.stringify(original),
    409,
    "CATALOG_CHANGED",
    "ข้อมูลเมนูเปลี่ยน กรุณาเปิดมื้อและคำนวณใหม่",
  );
  return { ranking, option: fresh, members };
}

export async function postHandoff(id: string, body: unknown, c: Context) {
  const b = HandoffSchema.parse(body);
  return transact(id, (s) => {
    requireSession(s);
    const m = actor(s, c, true);
    const { ranking, option, members } = finalizedChoice(s, b);
    if (
      s.handoff?.rankingId === ranking.id &&
      s.handoff.status !== "invalidated"
    ) {
      assert(
        currentSnapshot(s.handoff),
        409,
        "STALE_HANDOFF",
        "กรุณาเปิดมื้อและคำนวณใหม่",
      );
    }
    cached(s, m.id, c.key, { action: "cart_handoff", body: b }, () => {
      if (
        !s.handoff ||
        s.handoff.status === "invalidated" ||
        s.handoff.rankingId !== ranking.id
      ) {
        s.handoff = simulatedHandoff(option, ranking, members);
        event(s, "cart_handoff_created", {
          handoffId: s.handoff.id,
          rankingId: ranking.id,
        });
      }
      return { applied: true };
    });
    return { session: s, result: view(s, c.token) };
  });
}

export async function postCheckout(id: string, body: unknown, c: Context) {
  const b = CheckoutSchema.parse(body);
  return transact(id, (s) => {
    requireSession(s);
    const m = actor(s, c, true);
    const { ranking } = finalizedChoice(s, b);
    const handoff = s.handoff;
    assert(
      handoff &&
        handoff.id === b.handoffId &&
        handoff.status !== "invalidated" &&
        handoff.rankingId === ranking.id &&
        handoff.restaurantId === b.restaurantId &&
        handoff.preferenceVersion === s.preferenceVersion &&
        handoff.rosterVersion === s.rosterVersion &&
        currentSnapshot(handoff),
      409,
      "STALE_HANDOFF",
      "ตะกร้านี้ใช้ต่อไม่ได้ กรุณาตกลงข้อเสนอล่าสุดและส่งใหม่",
    );
    cached(s, m.id, c.key, { action: "simulated_checkout", body: b }, () => {
      if (handoff.status === "cart") {
        handoff.status = "checkout_summary";
        handoff.checkoutAt = new Date().toISOString();
        event(s, "checkout_simulated", { handoffId: handoff.id });
      }
      return { applied: true };
    });
    return { session: s, result: view(s, c.token) };
  });
}
