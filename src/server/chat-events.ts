import { mealMembers } from "@/domain/meal";
import { randomUUID } from "node:crypto";
import type { StoredSession } from "./state";
import type { ChatState, ChatMessage } from "@/contracts/chat";
export function chatState(s: StoredSession): ChatState {
  return (s.chat ??= { botJoined: false, messages: [] });
}
export function appendChatMessage(
  s: StoredSession,
  kind: ChatMessage["kind"],
  text: string,
  memberId: string | null = null,
  rankingId?: string,
) {
  const state = chatState(s);
  state.messages.push({
    id: randomUUID(),
    kind,
    memberId,
    text,
    createdAt: new Date().toISOString(),
    ...(rankingId ? { rankingId } : {}),
  });
  if (state.messages.length > 200) state.messages = state.messages.slice(-200);
}
/** Public group status only. Never put private canonical preferences, inputs or images here. */
export function appendChatEvent(
  s: StoredSession,
  type: string,
  payload: Record<string, unknown>,
) {
  if (!s.chat?.botJoined) return;
  const name =
    s.members.find((m) => m.id === payload.memberId)?.displayName ?? "สมาชิก";
  const active = mealMembers(s);
  const ranking = s.rankings.find((r) => r.id === s.currentRankingId);
  switch (type) {
    case "member_joined":
      appendChatMessage(s, "system", `${name} เข้าร่วมกลุ่มแล้ว`);
      break;
    case "member_removed":
      appendChatMessage(s, "system", `${name} ถูกนำออกจากมื้อนี้โดยเจ้าของกลุ่ม`);
      break;
    case "preferences_confirmed":
      appendChatMessage(
        s,
        "bot",
        `${name} ยืนยันความต้องการแล้ว ✓ พร้อม ${active.filter((m) => m.confirmed).length}/${active.length} คน${s.rankings.length ? " · ตัวเลือกและเสียงยอมรับเดิมถูกยกเลิกแล้ว" : ""}`,
      );
      break;
    case "ranking_published":
      appendChatMessage(
        s,
        "bot",
        ranking?.status === "no_match"
          ? "ยังไม่มีร้านใน catalog ที่ผ่านเงื่อนไขครบทุกคน ลองตรวจงบหรือเงื่อนไขของตัวเองได้เลยครับ ผมจะไม่ลดเงื่อนไขให้เอง"
          : ranking?.update?.outcome === "unchanged"
            ? `คำนวณใหม่ตามข้อมูลที่ยืนยันแล้วครับ · เวอร์ชัน ${ranking.preferenceVersion}\nร้าน เมนู ราคา และคะแนนยังเหมือนเดิมใน catalog จำลองชุดนี้ ผลนี้เป็นผลล่าสุดแล้ว ไม่ต้องกดหาให้หน่อยซ้ำครับ`
            : `คำนวณตามข้อมูลที่ยืนยันล่าสุดแล้วครับ · เวอร์ชัน ${ranking?.preferenceVersion}\nมี ${ranking?.options.length ?? 0} ตัวเลือกที่ทุกคนมีเมนูผ่านเงื่อนไข ตรวจเมนู ราคา และความเหมาะสม ก่อนกดยอมรับด้วยตัวเองนะครับ`,
        null,
        ranking?.id,
      );
      break;
    case "option_accepted": {
      const option = ranking?.options.find(
        (o) => o.restaurantId === payload.restaurantId,
      );
      const count = s.acceptances.filter(
        (a) =>
          a.restaurantId === payload.restaurantId &&
          a.rankingId === ranking?.id,
      ).length;
      appendChatMessage(
        s,
        "bot",
        `${name} ยอมรับ ${option?.restaurantName ?? "ตัวเลือกปัจจุบัน"} แล้ว · ${count}/${active.length} คน`,
      );
      break;
    }
    case "acceptance_withdrawn":
      appendChatMessage(s, "bot", `${name} ถอนการยอมรับแล้ว`);
      break;
    case "choice_finalized": {
      const o = ranking?.options.find(
        (o) => o.restaurantId === s.finalizedOptionId,
      );
      appendChatMessage(
        s,
        "bot",
        `สรุปมื้อนี้: ${o?.restaurantName ?? "ร้านที่เลือก"} 🎉 ทุกคนยอมรับตัวเลือกเวอร์ชันเดียวกันครบแล้ว ข้อมูลร้านและราคาเป็นข้อมูลจำลอง ยังไม่มีการสั่งอาหารครับ`,
        null,
        ranking?.id,
      );
      break;
    }
    case "room_changed":
      appendChatMessage(
        s,
        "bot",
        payload.action === "reopen"
          ? "เจ้าของกลุ่มเปิดมื้อนี้ใหม่แล้ว · ล้างข้อสรุปและเสียงยอมรับเดิม เริ่มตกลงกันใหม่ได้เลยครับ"
          : `เปลี่ยนเงื่อนไขกลุ่มแล้ว · ${s.mode === "delivery" ? "เดลิเวอรี" : "กินที่ร้าน"} · ล้างผลและเสียงยอมรับเดิมเพื่อคำนวณใหม่`,
      );
      break;
  }
}
