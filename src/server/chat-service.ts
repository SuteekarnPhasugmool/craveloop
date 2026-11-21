import { assert } from "./errors";
import { ChatActionSchema, type ChatResponse } from "@/contracts/chat";
import { buildChatDraft } from "@/domain/chat-draft";
import { transact, readSession } from "./database";
import {
  actor,
  requireSession,
  cached,
  view,
  versions,
  editable,
  invalidate,
  event,
  type Context,
} from "./session-service";
import { chatState, appendChatMessage } from "./chat-events";
export async function getChat(
  id: string,
  token?: string,
): Promise<ChatResponse> {
  const s = await readSession(id);
  requireSession(s);
  return { session: view(s, token), chat: chatState(s) };
}
export async function postChat(
  id: string,
  body: unknown,
  c: Context,
): Promise<ChatResponse> {
  const b = ChatActionSchema.parse(body);
  return transact(id, (s) => {
    requireSession(s);
    assert(
      s.experience !== "group_order",
      409,
      "GROUP_ORDER_ROUTE",
      "ใช้หน้า Group Order และ API meal สำหรับมื้อนี้",
    );
    const m = actor(
      s,
      c,
      b.action === "invite_bot" || b.action === "start_meal",
    );
    const result = cached(s, m.id, c.key, { action: "chat", body: b }, () => {
      const state = chatState(s);
      if (b.action === "start_meal") {
        versions(s, b);
        editable(s);
        assert(
          state.botJoined,
          409,
          "BOT_NOT_INVITED",
          "Invite CraveLoop before starting a meal.",
        );
        assert(
          s.membershipOpen,
          409,
          "MEMBERSHIP_CLOSED",
          "Host must reopen before changing meal participants.",
        );
        assert(
          b.selectedMemberIds.every((id) =>
            s.members.some((member) => member.id === id && member.active),
          ),
          422,
          "INVALID_MEAL_ROSTER",
          "Select active members of this group only.",
        );
        const previous = state.meal;
        const firstStart = !previous || previous.phase === "setup";
        const previousIds = new Set(previous?.selectedMemberIds ?? []);
        for (const member of s.members) {
          if (
            b.selectedMemberIds.includes(member.id) &&
            (firstStart || !previousIds.has(member.id))
          ) {
            member.confirmed = false;
            member.revision++;
          }
        }
        state.meal = {
          phase: "collecting",
          selectedMemberIds: b.selectedMemberIds,
          joinedMemberIds: firstStart
            ? []
            : (previous?.joinedMemberIds ?? []).filter((id) =>
                b.selectedMemberIds.includes(id),
              ),
        };
        s.areaId = b.areaId;
        s.mode = b.mode;
        s.preferenceVersion++;
        s.rosterVersion++;
        invalidate(
          s,
          "เปลี่ยนผู้ร่วมมื้อหรือเงื่อนไขร่วมแล้ว ผลและเสียงยอมรับเดิมถูกยกเลิก กรุณารอสมาชิกที่เลือกเข้าร่วมและยืนยันครบ",
        );
        event(s, "meal_started", {
          memberIds: b.selectedMemberIds,
          mode: b.mode,
          firstStart,
        });
        appendChatMessage(
          s,
          "bot",
          `เริ่มมื้อนี้แล้ว 🍽 โซน Bangkok demo · ${s.mode === "delivery" ? "เดลิเวอรี" : "กินที่ร้าน"}\nผู้ร่วมมื้อ: ${b.selectedMemberIds.map((id) => s.members.find((m) => m.id === id)!.displayName).join(", ")}\nแต่ละคนกด “เข้าร่วมมื้อนี้” ด้วยตัวเอง แล้วตรวจและยืนยันข้อมูลส่วนตัวก่อนค้นหาร้านนะครับ`,
        );
        return { session: view(s, c.token), chat: state };
      }
      if (b.action === "join_meal") {
        versions(s, b);
        editable(s);
        const meal = state.meal;
        assert(
          meal?.phase === "collecting",
          409,
          "MEAL_NOT_STARTED",
          "Host must start a meal first.",
        );
        assert(
          meal.selectedMemberIds.includes(m.id),
          403,
          "MEAL_NOT_SELECTED",
          "You are not selected for this meal. Ask the host to add you.",
        );
        if (!meal.joinedMemberIds.includes(m.id)) {
          meal.joinedMemberIds.push(m.id);
          s.rosterVersion++;
          invalidate(s, "สมาชิกเข้าร่วมมื้อนี้แล้ว ผลและเสียงยอมรับเดิมถูกยกเลิก");
          event(s, "meal_joined", { memberId: m.id });
          appendChatMessage(
            s,
            "bot",
            `${m.displayName} เข้าร่วมมื้อนี้ด้วยตัวเองแล้ว ✓ กด “กรอกความต้องการของฉัน” เพื่อเปิดฟอร์มส่วนตัว ตรวจและยืนยันข้อมูลได้เลยครับ`,
          );
        }
        return { session: view(s, c.token), chat: state };
      }
      if (b.action === "invite_bot") {
        if (!state.botJoined) {
          state.botJoined = true;
          appendChatMessage(
            s,
            "system",
            `${m.displayName} เชิญ CraveLoop เข้ากลุ่มแล้ว`,
          );
          appendChatMessage(
            s,
            "bot",
            state.meal
              ? "สวัสดีครับ ผม CraveLoop 🍜 เจ้าของกลุ่มกด “เริ่มมื้อใหม่” เลือกผู้ร่วมมื้อ โซน และรูปแบบอาหาร จากนั้นแต่ละคนเข้าร่วมและยืนยันความต้องการด้วยตัวเองนะครับ\nLINE simulation · ร้านและเมนูเป็นข้อมูลจำลอง"
              : "สวัสดีครับ ผม CraveLoop 🍜 กดเริ่มมื้อใหม่เพื่อเลือกผู้ร่วมมื้อและโซน หรือกรอกความต้องการของคุณได้เลยครับ\nLINE simulation · ร้านและเมนูเป็นข้อมูลจำลอง",
          );
        }
        return { session: view(s, c.token), chat: state };
      }
      appendChatMessage(s, "text", b.text, m.id);
      if (!state.botJoined) return { session: view(s, c.token), chat: state };
      if (s.status === "finalized") {
        appendChatMessage(
          s,
          "bot",
          "มื้อนี้สรุปแล้วครับ ถ้าจะเปลี่ยนเงื่อนไข ให้เจ้าของกลุ่มกดเปิดมื้อใหม่ก่อนนะครับ",
        );
        return { session: view(s, c.token), chat: state };
      }
      if (state.meal) {
        const meal = state.meal;
        if (
          meal.phase === "setup" ||
          !meal.selectedMemberIds.includes(m.id) ||
          !meal.joinedMemberIds.includes(m.id)
        ) {
          if (/craveloop|งบ|อยากกิน|ไม่กิน|มังสวิรัติ|หา.*ร้าน/i.test(b.text))
            appendChatMessage(
              s,
              "bot",
              meal.phase === "setup"
                ? "รอเจ้าของกลุ่มเริ่มมื้อและเลือกผู้ร่วมมื้อก่อนนะครับ"
                : !meal.selectedMemberIds.includes(m.id)
                  ? `${m.displayName} ยังไม่ได้ร่วมมื้อนี้ ขอเจ้าของกลุ่มเพิ่มผู้ร่วมมื้อได้ครับ`
                  : `${m.displayName} กด “เข้าร่วมมื้อนี้” ก่อน แล้วส่งความต้องการเพื่อเตรียมร่างส่วนตัวนะครับ`,
            );
          return { session: view(s, c.token), chat: state };
        }
      }
      const draft = buildChatDraft(b.text, m.preference);
      if (draft.recognized) {
        appendChatMessage(
          s,
          "bot",
          `${m.displayName} ผมเตรียมร่างให้แล้วครับ กดตรวจร่างส่วนตัว แก้ไขและยืนยันก่อนใช้คำนวณนะครับ${draft.questions.length ? " · มีจุดที่ต้องถามเพิ่ม กรุณาตรวจข้อความคำถามด้วย" : ""}\nโหมดช่วยจับคำตามกฎ (ไม่ใช่การเรียก AI)`,
        );
        return { session: view(s, c.token), chat: state, draft };
      }
      if (/(?:@?craveloop|ช่วยเลือก|หา(?:ร้าน|ให้)|เริ่ม|สรุป|แนะนำ)/i.test(b.text))
        appendChatMessage(
          s,
          "bot",
          "บอกสิ่งที่อยากกินกับงบ เช่น “อยากกินกรอบ ๆ งบ180” แล้วตรวจร่างและยืนยันครับ เมื่อทุกคนพร้อม เจ้าของกลุ่มกด “หาให้หน่อย” เพื่อคำนวณจาก catalog ได้เลย",
        );
      return { session: view(s, c.token), chat: state };
    });
    return { session: s, result };
  });
}
