import {
  emptyPreference,
  PreferenceSchema,
  type Preference,
} from "../contracts";
import type { ChatDraft } from "../contracts/chat";

// Deliberately small deterministic vocabulary. This is a review helper, not AI,
// dietary evidence, a language model, or permission to change canonical state.
const ingredients: [string, RegExp][] = [
  ["pork", /หมู|\bpork\b/giu],
  ["chicken", /ไก่|\bchicken\b/giu],
  ["beef", /เนื้อวัว|\bbeef\b/giu],
  ["shrimp", /กุ้ง|\bshrimp\b|\bprawn(?:s)?\b/giu],
  ["fish", /ปลา|\bfish\b/giu],
  ["egg", /ไข่|\beggs?\b/giu],
  ["milk", /นม|\bmilk\b/giu],
  ["peanut", /ถั่วลิสง|\bpeanuts?\b/giu],
  ["soy", /ถั่วเหลือง|\bsoy\b/giu],
  ["wheat", /ข้าวสาลี|\bwheat\b/giu],
  ["sesame", /งา|\bsesame\b/giu],
];
const softVocabulary: {
  field: "cuisinePreferences" | "flavorTags" | "textureTags";
  tag: string;
  pattern: RegExp;
}[] = [
  { field: "cuisinePreferences", tag: "thai", pattern: /อาหารไทย|\bthai\b/giu },
  {
    field: "cuisinePreferences",
    tag: "japanese",
    pattern: /ญี่ปุ่น|\bjapanese\b/giu,
  },
  {
    field: "cuisinePreferences",
    tag: "korean",
    pattern: /เกาหลี|\bkorean\b/giu,
  },
  {
    field: "cuisinePreferences",
    tag: "chinese",
    pattern: /อาหารจีน|\bchinese\b/giu,
  },
  {
    field: "cuisinePreferences",
    tag: "western",
    pattern: /ตะวันตก|อาหารฝรั่ง|\bwestern\b/giu,
  },
  {
    field: "cuisinePreferences",
    tag: "indian",
    pattern: /อินเดีย|\bindian\b/giu,
  },
  { field: "flavorTags", tag: "spicy", pattern: /เผ็ด|\bspicy\b/giu },
  { field: "flavorTags", tag: "mild", pattern: /รสอ่อน|รสเบา|\bmild\b/giu },
  {
    field: "flavorTags",
    tag: "savory",
    pattern: /รสเค็ม|รสกลมกล่อม|\bsavo(?:u)?ry\b/giu,
  },
  { field: "flavorTags", tag: "sweet", pattern: /หวาน|\bsweet\b/giu },
  { field: "flavorTags", tag: "sour", pattern: /เปรี้ยว|\bsour\b/giu },
  {
    field: "textureTags",
    tag: "crispy",
    pattern: /กรอบ|\bcrispy\b|\bcrunchy\b/giu,
  },
  {
    field: "textureTags",
    tag: "brothy",
    pattern: /น้ำซุป|เส้นน้ำ|ก๋วยเตี๋ยวน้ำ|\bbrothy\b|\bsoup\b|\bbroth\b/giu,
  },
  { field: "textureTags", tag: "grilled", pattern: /ย่าง|\bgrilled\b/giu },
  { field: "textureTags", tag: "creamy", pattern: /ครีมมี่|\bcreamy\b/giu },
  { field: "textureTags", tag: "fresh", pattern: /ผักสด|\bfresh\b/giu },
  {
    field: "textureTags",
    tag: "chewy",
    pattern: /หนึบ|เส้น|\bchewy\b|\bnoodles?\b/giu,
  },
];
const hardPrefix =
  /(?:ไม่(?:อยาก)?(?:กิน|เอา)|งด|ห้าม|ไม่ใส่|เลี่ยง|แพ้|\bavoid|\bexclude|\bwithout|\bno|\bdon't eat|\bdo not eat|\ballergic to)\s*(?:อาหาร|ส่วนผสม|เนื้อ|any\s+)?\s*$/iu;
const dislikePrefix =
  /(?:ไม่ชอบ|\bdislike|\bdon't like|\bdo not like)\s*(?:อาหาร|รส|เนื้อ|any\s+)?\s*$/iu;
const negativePrefix =
  /(?:ไม่(?:อยาก|ต้องการ)?(?:กิน|เอา|ชอบ|ใส่)?|งด|เลี่ยง|\bno|\bnot|\bwithout|\bavoid|\bexclude|ไม่ใช่|ไม่ได้เป็น|\bnon[- ]?|\bdon't eat|\bdo not eat|\bnot eating|\bdon't want|\bdo not want|\bdon't like|\bdo not like|\bdislike)\s*(?:อาหาร|รส|ความ|food|any|something|anything)?\s*$/iu;
const unique = <T>(values: T[]) => [...new Set(values)];
const before = (text: string, index: number) =>
  text.slice(Math.max(0, index - 60), index);
const after = (text: string, index: number, length: number) =>
  text.slice(index + length, index + length + 20);

function budgetFromText(text: string): {
  mentioned: boolean;
  value: number | null;
  question?: string;
} {
  const cues =
    /งบ|budget|วงเงิน|baht|บาท|\bthb\b|(?:maximum|max|under)\s*[฿$€£\d]|[฿$€£]\s*\d/iu.test(
      text,
    );
  if (!cues) return { mentioned: false, value: null };
  // Thai shorthand งบ180 is explicitly supported in this THB-only demo.
  // English inputs must state baht/THB/฿; currencies are never converted.
  const matches = [
    ...text.matchAll(
      /(งบ(?:ประมาณ)?(?:\s*(?:ไม่เกิน|สูงสุด|เหลือ|อยู่ที่|คือ|ไม่เกินคนละ|คนละ))?\s*|วงเงิน\s*|(?:budget(?:\s+(?:is|of|maximum|max|up to))?|maximum|max|under)\s*[:=]?\s*|฿\s*)(-?\d[\d,]*(?:\.\d+)?)(?:\s*(บาท|baht|thb|฿|usd|dollars?|eur|euros?))?/giu,
    ),
  ];
  if (
    !matches.length ||
    /[$€£]|\b(?:usd|eur|jpy|yen|yuan|cny|gbp|dollars?|euros?|btc|usdt)\b|ดอลลาร์|ยูโร|เยน|หยวน|ปอนด์/iu.test(
      text,
    )
  )
    return {
      mentioned: true,
      value: null,
      question: "ระบุงบสูงสุดต่อคนเป็นบาท (รวมค่าธรรมเนียม) ในช่องงบก่อนยืนยัน",
    };
  const amounts: number[] = [];
  for (const match of matches) {
    const prefix = match[1],
      raw = match[2],
      suffix = match[3] ?? "";
    if (!/งบ|วงเงิน|฿/u.test(prefix) && !/บาท|baht|thb|฿/iu.test(suffix))
      return {
        mentioned: true,
        value: null,
        question: "งบนี้เป็นบาทใช่ไหม? ระบุหน่วยและงบสูงสุดต่อคนก่อนยืนยัน",
      };
    if (
      /^\s*(?:[-–—~]|ถึง|to\b|หรือ|or\b)/iu.test(
        after(text, match.index!, match[0].length),
      )
    )
      return {
        mentioned: true,
        value: null,
        question: "พบช่วงหรือหลายงบ กรุณาเลือกงบสูงสุดต่อคนเพียงค่าเดียว",
      };
    if (raw.includes(",") && !/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw))
      return {
        mentioned: true,
        value: null,
        question: "รูปแบบงบไม่ชัดเจน กรุณากรอกตัวเลขเงินบาทในช่องงบ",
      };
    const value = Number(raw.replaceAll(",", ""));
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100000 ||
      (raw.split(".")[1]?.length ?? 0) > 2
    )
      return {
        mentioned: true,
        value: null,
        question: "กรุณาระบุงบ 0–100,000 บาท และทศนิยมไม่เกินสองตำแหน่ง",
      };
    amounts.push(Math.round(value * 100));
  }
  if (unique(amounts).length !== 1)
    return {
      mentioned: true,
      value: null,
      question: "พบงบหลายค่า กรุณาเลือกงบสูงสุดต่อคนเพียงค่าเดียว",
    };
  return { mentioned: true, value: amounts[0] };
}

export function buildChatDraft(
  text: string,
  current: Preference | null,
): ChatDraft {
  const preference: Preference = structuredClone(current ?? emptyPreference);
  const questions: string[] = [];
  let recognized = false;
  const input = text.normalize("NFKC").toLowerCase();
  const budget = budgetFromText(input);
  if (budget.mentioned) {
    recognized = true;
    if (budget.question) questions.push(budget.question);
    else preference.budgetMaxSatang = budget.value;
  }
  const detected: {
    cuisinePreferences: string[];
    flavorTags: string[];
    textureTags: string[];
  } = { cuisinePreferences: [], flavorTags: [], textureTags: [] };
  const dislikes: string[] = [];
  for (const vocabulary of softVocabulary) {
    for (const match of input.matchAll(vocabulary.pattern)) {
      const prefix = before(input, match.index!);
      if (dislikePrefix.test(prefix)) {
        dislikes.push(vocabulary.tag);
        recognized = true;
        continue;
      }
      if (
        vocabulary.tag === "spicy" &&
        (negativePrefix.test(prefix) ||
          /^\s*(?:น้อย|อ่อน)/u.test(after(input, match.index!, match[0].length)))
      ) {
        detected.flavorTags.push("mild");
        recognized = true;
        continue;
      }
      if (negativePrefix.test(prefix)) {
        questions.push(
          `ไม่เพิ่ม ${vocabulary.tag} เป็นความชอบจากข้อความปฏิเสธ กรุณาตรวจช่องความชอบเอง`,
        );
        recognized = true;
        continue;
      }
      detected[vocabulary.field].push(vocabulary.tag);
      recognized = true;
    }
  }
  if (/(?:เผ็ด\s*น้อย|(?:less|non[- ]?)\s*spicy)/iu.test(input)) {
    detected.flavorTags = detected.flavorTags.filter((tag) => tag !== "spicy");
    detected.flavorTags.push("mild");
    recognized = true;
  }
  for (const family of [
    "cuisinePreferences",
    "flavorTags",
    "textureTags",
  ] as const) {
    if (detected[family].length)
      Object.assign(preference, { [family]: unique(detected[family]) });
  }
  const removal =
    /(?:ยกเลิก|เอาออก|ลบข้อ|เลิกงด|\bremove|\bclear|\bcancel)\s*(?:ข้อจำกัด|การ|อาหาร|diet|restriction|exclusion|allerg|pork|vegetarian)?/iu.test(
      input,
    );
  if (removal) {
    questions.push(
      "การลบข้อจำกัดต้องแก้ช่องข้อยกเว้นหรืออาหารที่ต้องการเอง กรุณาตรวจทั้งหมดก่อนยืนยัน",
    );
    recognized = true;
  }
  let hardIngredientFound = false;
  for (const [ingredient, pattern] of ingredients) {
    for (const match of input.matchAll(pattern)) {
      const prefix = before(input, match.index!);
      if (dislikePrefix.test(prefix)) {
        dislikes.push(ingredient);
        recognized = true;
        continue;
      }
      if (!hardPrefix.test(prefix) || removal) continue;
      // Double negation is left for manual review rather than guessed.
      if (/(?:ไม่ใช่|ไม่ได้หมายความว่า|not saying|not that).*$/iu.test(prefix)) {
        questions.push("ข้อความปฏิเสธซ้อนกันไม่ชัดเจน กรุณาตรวจส่วนผสมที่ไม่กินเอง");
        recognized = true;
        continue;
      }
      preference.excludedIngredients = unique([
        ...preference.excludedIngredients,
        ingredient,
      ]);
      if (/(?:แพ้|allergic to)\s*$/iu.test(prefix))
        preference.allergies = unique([...preference.allergies, ingredient]);
      hardIngredientFound = true;
      recognized = true;
    }
  }
  if (
    hardIngredientFound &&
    /(?:หมู|ไก่|เนื้อวัว|ปลา|กุ้ง|ไข่|นม|ถั่วลิสง|pork|chicken|beef|fish|shrimp|egg|milk|peanut)\s*(?:และ|กับ|,|and\b|or\b)/iu.test(
      input,
    )
  ) {
    questions.push(
      "พบรายการส่วนผสมหลายอย่าง ตัวช่วยอาจอ่านได้ไม่ครบ กรุณาตรวจส่วนผสมที่งดหรือแพ้ทุกข้อในฟอร์มเอง",
    );
  }
  const dietMatches = [...input.matchAll(/มังสวิรัติ|\bvegetarian\b/giu)];
  for (const match of dietMatches) {
    const prefix = before(input, match.index!);
    if (
      negativePrefix.test(prefix) ||
      /(?:ไม่(?:ได้)?(?:กิน|เป็น|เอา)|\bnot\s+a)\s*$/iu.test(prefix) ||
      /(?:อาจจะ|อาจ|ไม่แน่ใจว่า|maybe|perhaps)\s*$/iu.test(prefix) ||
      removal
    ) {
      questions.push(
        "ไม่เพิ่มหรือลบ vegetarian จากข้อความปฏิเสธ กรุณาตรวจข้อกำหนดอาหารเอง",
      );
      recognized = true;
      continue;
    }
    preference.dietaryRequirements = unique([
      ...preference.dietaryRequirements,
      "vegetarian",
    ]);
    recognized = true;
  }
  if (/เจ|\bvegan\b|ฮาลาล|\bhalal\b|\bno meat\b|ไม่กินเนื้อ(?!วัว)/iu.test(input)) {
    questions.push(
      "ข้อกำหนดอาหารนี้ต้องการรายละเอียดเพิ่ม โปรดระบุส่วนผสมที่งดและเลือกข้อกำหนดในฟอร์มเอง",
    );
    recognized = true;
  }
  if (
    !hardIngredientFound &&
    /(?:ไม่กิน|ไม่ใส่|แพ้|\ballergic to|\bexclude|\bavoid)\s*\S/iu.test(input) &&
    !dietMatches.length &&
    !removal
  ) {
    questions.push("ยังจับคู่ส่วนผสมที่งดหรือแพ้ได้ไม่แน่ชัด กรุณากรอกชื่อส่วนผสมในฟอร์มเอง");
    recognized = true;
  }
  if (dislikes.length)
    preference.dislikes = unique([...preference.dislikes, ...dislikes]);
  if (!recognized)
    questions.push(
      "ตัวช่วยแบบกฎยังไม่เข้าใจข้อความนี้ กรุณากรอกและตรวจความต้องการในฟอร์มเอง",
    );
  return {
    preference: PreferenceSchema.parse(preference),
    questions: unique(questions),
    source: "rules",
    recognized,
  };
}
