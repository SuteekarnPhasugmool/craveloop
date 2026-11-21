"use client";
import { useState } from "react";
import {
  cuisineTags,
  flavorTags,
  textureTags,
  type Preference,
  type SessionView,
} from "@/contracts";
import type { ChatDraft } from "@/contracts/chat";
import { api } from "../api";
const labels: Record<string, string> = {
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
const list = (v: string) =>
  v
    .split(/[,，\n]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
export default function ReviewDrawer({
  draft,
  session,
  onClose,
  onSaved,
  onError,
}: {
  draft: ChatDraft;
  session: SessionView;
  onClose: () => void;
  onSaved: (s: SessionView) => void;
  onError: (e: unknown) => void;
}) {
  const [p, setP] = useState<Preference>(draft.preference);
  const [budget, setBudget] = useState(
    p.budgetMaxSatang === null ? "" : String(p.budgetMaxSatang / 100),
  );
  const [excluded, setExcluded] = useState(p.excludedIngredients.join(", "));
  const [diet, setDiet] = useState(p.dietaryRequirements.join(", "));
  const [allergies, setAllergies] = useState(p.allergies.join(", "));
  const [dislikes, setDislikes] = useState(p.dislikes.join(", "));
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [memberRevision] = useState(session.me!.revision);
  function toggle(
    key: "cuisinePreferences" | "flavorTags" | "textureTags",
    tag: string,
  ) {
    setChecked(false);
    setP(
      (p) =>
        ({
          ...p,
          [key]: p[key].includes(tag as never)
            ? p[key].filter((t) => t !== tag)
            : [...p[key], tag],
        }) as Preference,
    );
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<SessionView>(
        `/api/sessions/${session.id}/preferences/me`,
        "PUT",
        {
          confirmedPreference: {
            ...p,
            budgetMaxSatang:
              budget === "" ? null : Math.round(Number(budget) * 100),
            excludedIngredients: list(excluded),
            dietaryRequirements: list(diet),
            allergies: list(allergies),
            dislikes: list(dislikes),
          },
          expectedMemberRevision: memberRevision,
          expectedPreferenceVersion: session.preferenceVersion,
          expectedRosterVersion: session.rosterVersion,
        },
      );
      onSaved(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ กรุณาตรวจข้อมูลล่าสุด");
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="line-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="line-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-heading"
      >
        <div className="line-drawer-grip" />
        <header className="line-drawer-header">
          <div>
            <p className="line-kicker">เฉพาะความต้องการของคุณ</p>
            <h2 id="review-heading">ตรวจ draft ก่อนยืนยัน</h2>
          </div>
          <button
            className="line-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="ปิดหน้าตรวจข้อมูล"
          >
            ×
          </button>
        </header>
        <p className="line-rules-note">
          {draft.recognized
            ? "ตัวช่วยจับคำแบบกฎ · ไม่ใช่ AI"
            : "ฟอร์มส่วนตัว · คุณกรอกเอง ไม่เรียก AI"}
          <br />
          นี่เป็น draft ที่แก้ไขได้ ยังไม่มีผลจนกว่าคุณจะยืนยัน
        </p>
        {draft.questions.map((q, i) => (
          <p key={i} className="line-warning">
            {q}
          </p>
        ))}
        <form onSubmit={save}>
          <label htmlFor="chat-budget">งบสูงสุด (บาท)</label>
          <input
            id="chat-budget"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            inputMode="decimal"
            value={budget}
            onChange={(e) => {
              setChecked(false);
              setBudget(e.target.value);
            }}
            placeholder="ไม่จำกัด"
          />
          <p className="line-subtle">
            รวมอาหาร ภาษี/ค่าบริการที่ระบุ และส่วนแบ่งค่าจัดส่ง · ว่าง = ไม่จำกัด
          </p>
          <fieldset>
            <legend>อยากกินแนวไหน</legend>
            <div className="line-tags">
              {cuisineTags.map((t) => (
                <button
                  type="button"
                  key={t}
                  aria-pressed={p.cuisinePreferences.includes(t)}
                  onClick={() => toggle("cuisinePreferences", t)}
                >
                  {labels[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>รสชาติ</legend>
            <div className="line-tags">
              {flavorTags.map((t) => (
                <button
                  type="button"
                  key={t}
                  aria-pressed={p.flavorTags.includes(t)}
                  onClick={() => toggle("flavorTags", t)}
                >
                  {labels[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>สัมผัส</legend>
            <div className="line-tags">
              {textureTags.map((t) => (
                <button
                  type="button"
                  key={t}
                  aria-pressed={p.textureTags.includes(t)}
                  onClick={() => toggle("textureTags", t)}
                >
                  {labels[t]}
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor="chat-exclusions">วัตถุดิบที่ไม่กิน</label>
          <input
            id="chat-exclusions"
            placeholder="pork, shrimp / หมู, กุ้ง"
            value={excluded}
            onChange={(e) => {
              setChecked(false);
              setExcluded(e.target.value);
            }}
          />
          <p className="line-subtle">
            ข้อห้ามแบบเด็ดขาด (hard exclusion): ตัดเมนูที่มีวัตถุดิบนี้ หรือไม่มีข้อมูลส่วนผสมครบ
            ไม่ใช้แทนข้อมูลอาการแพ้
          </p>
          <label htmlFor="chat-diet">ข้อกำหนดอาหาร</label>
          <input
            id="chat-diet"
            placeholder="vegetarian / มังสวิรัติ"
            value={diet}
            onChange={(e) => {
              setChecked(false);
              setDiet(e.target.value);
            }}
          />
          <section className="line-extra-rules">
            <h3>แยกอาการแพ้จากสิ่งที่ไม่ชอบ</h3>
            <label htmlFor="chat-allergies">
              อาการแพ้ที่ต้องตรวจ cross-contact
            </label>
            <input
              id="chat-allergies"
              value={allergies}
              onChange={(e) => {
                setChecked(false);
                setAllergies(e.target.value);
              }}
              placeholder="peanut"
            />
            <p className="line-subtle">
              ต้องมีหลักฐานยืนยันครบ ข้อมูลสมมติไม่ใช่การรับรองความปลอดภัยทางการแพทย์
            </p>
            <label htmlFor="chat-dislikes">สิ่งที่ไม่ชอบ (soft dislikes)</label>
            <input
              id="chat-dislikes"
              value={dislikes}
              onChange={(e) => {
                setChecked(false);
                setDislikes(e.target.value);
              }}
              placeholder="sweet, creamy"
            />
            <p className="line-subtle">
              Soft dislike ใช้ลดคะแนนความชอบ ไม่ใช่ข้อห้าม และไม่ตัดเมนูออก
              ใช้ช่องวัตถุดิบที่ไม่กินหรืออาการแพ้สำหรับเงื่อนไขเด็ดขาด
            </p>
          </section>
          <label className="line-review-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              required
            />
            <span>ตรวจสอบและยืนยันข้อมูลของฉัน</span>
          </label>
          <p className="line-subtle">
            เมนู ราคา คะแนน และหลักฐานข้อจำกัดที่เกี่ยวข้องจะเห็นในกลุ่ม
            ฟอร์มส่วนตัวฉบับเต็มไม่ถูกโพสต์อัตโนมัติ
          </p>
          {error && (
            <p role="alert" className="line-error">
              {error}
            </p>
          )}
          <button className="line-primary" disabled={busy || !checked}>
            {busy ? "กำลังบันทึก…" : "ยืนยันความต้องการ"} ✓
          </button>
        </form>
      </section>
    </div>
  );
}
