import type { Preference } from "../contracts";
import { buildChatDraft } from "./chat-draft";

export const names: Record<string, string> = {
  thai: "ไทย",
  japanese: "ญี่ปุ่น",
  korean: "เกาหลี",
  chinese: "จีน",
  western: "ตะวันตก",
  indian: "อินเดีย",
  other: "อื่น ๆ",
  spicy: "เผ็ด",
  savory: "กลมกล่อม",
  sweet: "หวาน",
  sour: "เปรี้ยว",
  mild: "รสอ่อน",
  crispy: "กรอบ",
  brothy: "น้ำซุป",
  grilled: "ย่าง",
  creamy: "ครีม",
  fresh: "สด",
  chewy: "เส้นหนึบ",
};

export type Answers = { craving: string; constraints: string };

export function describeAnswers(p: Preference): Answers {
  const food = p.foodBase ?? (p.noodle && "noodles");
  const style =
    p.servingStyle ??
    (p.noodle === "broth"
      ? "soup"
      : p.noodle === "stir_fried"
        ? "dry"
        : undefined);
  return {
    craving: [
      food && (food === "rice" ? "ข้าว" : "เส้น"),
      style && (style === "soup" ? "น้ำ" : "แห้ง"),
      p.desiredDish,
      ...[...p.cuisinePreferences, ...p.flavorTags, ...p.textureTags].map(
        (t) => names[t] ?? t,
      ),
    ]
      .filter(Boolean)
      .join(" "),
    constraints: [
      p.budgetMaxSatang !== null && String(p.budgetMaxSatang / 100) + " บาท",
      ...p.allergies.map((t) => "แพ้ " + t),
      ...p.excludedIngredients.map((t) => "ไม่กิน " + t),
      ...p.dislikes.map((t) => "ไม่ชอบ " + (names[t] ?? t)),
      ...p.dietaryRequirements.map((t) => "ข้อกำหนดอาหาร " + t),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function parseAnswers(
  answers: Answers,
  previous: Answers,
  base: Preference,
): Preference {
  const p = structuredClone(base);
  if (answers.craving !== previous.craving) {
    const text = answers.craving.trim();
    if (/แพ้|ไม่กิน|ไม่ใส่|ไม่ชอบ|งบ|บาท/.test(text))
      throw new Error("ใส่งบ ของที่แพ้ ไม่กิน หรือไม่ชอบในช่องข้อจำกัด");
    const tags = buildChatDraft(text, null).preference;
    p.cuisinePreferences = tags.cuisinePreferences;
    p.textureTags = tags.textureTags;
    p.flavorTags = tags.flavorTags;
    // Keep canonical tags rendered from older forms editable in the text answer.
    for (const key of [
      "cuisinePreferences",
      "textureTags",
      "flavorTags",
    ] as const) {
      for (const tag of base[key])
        if (text.includes(names[tag]) && !p[key].includes(tag as never))
          p[key].push(tag as never);
    }
    const rice = /ข้าว|\brice\b/i.test(text),
      noodles = /เส้น|ก๋วยเตี๋ยว|\bnoodles?\b/i.test(text);
    const soup = /น้ำ|ซุป|\b(?:soup|broth)\b/i.test(text),
      dry = /แห้ง|ผัด|\bdry\b/i.test(text);
    p.foodBase = rice === noodles ? undefined : rice ? "rice" : "noodles";
    p.servingStyle = soup === dry ? undefined : soup ? "soup" : "dry";
    delete p.noodle;
    if (p.desiredDish && !text.includes(p.desiredDish)) delete p.desiredDish;
  }
  if (answers.constraints === previous.constraints) return p;
  Object.assign(p, {
    budgetMaxSatang: null,
    allergies: [],
    excludedIngredients: [],
    dislikes: [],
    dietaryRequirements: [],
  });
  const text = answers.constraints.trim();
  if (!text || /^(ไม่มี|ไม่มีข้อจำกัด|ไม่จำกัด)$/.test(text)) return p;
  const parts = text
    .replace(/(แพ้|ไม่กิน|ไม่ใส่|ไม่ชอบ|งบ(?:ประมาณ)?|ข้อกำหนดอาหาร)/g, "\n$1")
    .split(/[\n;]/)
    .map((part) => part.trim().replace(/^[,，\s]+|[,，\s]+$/g, ""))
    .filter(Boolean);
  for (const part of parts) {
    const amount =
      /^(?:งบ(?:ประมาณ)?\s*)?(?:ไม่เกิน\s*)?(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:บาท)?$/.exec(
        part,
      );
    if (amount) {
      const baht = Number(amount[1].replaceAll(",", ""));
      if (p.budgetMaxSatang !== null || baht > 100000)
        throw new Error("ระบุงบสูงสุดหนึ่งจำนวน ระหว่าง 0 ถึง 100,000 บาท");
      p.budgetMaxSatang = Math.round(baht * 100);
      continue;
    }
    const match = /^(แพ้|ไม่กิน|ไม่ใส่|ไม่ชอบ|ข้อกำหนดอาหาร)\s*(.+)$/.exec(part);
    if (!match && /^(มังสวิรัติ|vegetarian)$/i.test(part)) {
      p.dietaryRequirements.push("vegetarian");
      continue;
    }
    if (!match || !match[2].trim() || /\d+\s*บาท/.test(match[2]))
      throw new Error("แยกแต่ละข้อ เช่น “200 บาท, แพ้กุ้ง, ไม่กินหมู, ไม่ชอบเผ็ด”");
    const values = match[2]
      .split(/[,，]|และ|กับ/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (match[1] === "แพ้") p.allergies.push(...values);
    else if (match[1] === "ไม่ชอบ")
      p.dislikes.push(
        ...values.map(
          (v) => Object.keys(names).find((k) => names[k] === v) ?? v,
        ),
      );
    else if (match[1] === "ข้อกำหนดอาหาร")
      p.dietaryRequirements.push(
        ...values.map((v) => (v === "มังสวิรัติ" ? "vegetarian" : v)),
      );
    else p.excludedIngredients.push(...values);
  }
  return p;
}
