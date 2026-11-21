"use client";
import { useState } from "react";
import {
  emptyPreference,
  cuisineTags,
  flavorTags,
  textureTags,
  type Preference,
  type SessionView,
} from "@/contracts";
import { api, RequestError } from "../api";
import { CraveMark } from "./Shared";
const names: Record<string, string> = {
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
const split = (v: string) => [
  ...new Set(
    v
      .split(/[,，\n]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  ),
];
export default function Preferences({
  session,
  onClose,
  onSaved,
  onConflict,
}: {
  session: SessionView;
  onClose: () => void;
  onSaved: (s: SessionView) => void;
  onConflict: () => void;
}) {
  const [p, setP] = useState<Preference>(() =>
    structuredClone(session.me?.preference ?? emptyPreference),
  );
  const [revision] = useState(session.me!.revision);
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
  function toggle(
    key: "cuisinePreferences" | "flavorTags" | "textureTags",
    t: string,
  ) {
    setChecked(false);
    setP(
      (v) =>
        ({
          ...v,
          [key]: v[key].includes(t as never)
            ? v[key].filter((x) => x !== t)
            : [...v[key], t],
        }) as Preference,
    );
  }
  async function submit(e: React.FormEvent) {
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
            excludedIngredients: split(excluded),
            dietaryRequirements: split(diet),
            allergies: split(allergies),
            dislikes: split(dislikes),
          },
          expectedMemberRevision: revision,
          expectedPreferenceVersion: session.preferenceVersion,
          expectedRosterVersion: session.rosterVersion,
        },
      );
      onSaved(next);
    } catch (e) {
      setError(
        e instanceof RequestError && e.status === 409
          ? "ข้อมูลกลุ่มเปลี่ยนแล้ว เราเก็บสิ่งที่คุณกรอกไว้ กรุณาตรวจแล้วลองยืนยันอีกครั้ง หากแก้จากอีกหน้าต่างให้ปิดและเปิดฟอร์มใหม่"
          : e instanceof Error
            ? e.message
            : "บันทึกไม่สำเร็จ ลองอีกครั้ง",
      );
      onConflict();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="go-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="go-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="go-preferences-heading"
      >
        <div className="go-grip" />
        <button
          className="go-close"
          aria-label="ปิดความต้องการของฉัน"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <div className="go-crave-intro">
          <CraveMark />
          <span>CraveLoop</span>
          <small>PRIVATE PREFERENCES</small>
        </div>
        <h2 id="go-preferences-heading">ความต้องการของฉัน</h2>
        <p className="go-muted">
          กรอกเองและยืนยันด้วยตัวเอง ไม่มี AI แอบอนุมานข้อจำกัดของคุณ
        </p>
        <form onSubmit={submit}>
          <label htmlFor="group-budget">งบสูงสุด (บาท)</label>
          <div className="go-budget-field">
            <span>฿</span>
            <input
              id="group-budget"
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
          </div>
          <p className="go-fine">
            รวมราคาอาหารและส่วนแบ่งค่าจัดส่ง/บริการแล้ว · ว่าง = ไม่จำกัด
          </p>
          {(
            [
              ["flavorTags", "รสชาติ", flavorTags],
              ["textureTags", "สัมผัส", textureTags],
            ] as const
          ).map(([key, title, tags]) => (
            <fieldset key={key}>
              <legend>{title}</legend>
              <div className="go-tags">
                {tags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={p[key].includes(t as never)}
                    onClick={() => toggle(key, t)}
                  >
                    {names[t]}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <label htmlFor="group-exclusions">วัตถุดิบที่ไม่กิน</label>
          <input
            id="group-exclusions"
            placeholder="เช่น หมู, กุ้ง / pork, shrimp"
            value={excluded}
            onChange={(e) => {
              setChecked(false);
              setExcluded(e.target.value);
            }}
          />
          <p className="go-fine">
            ข้อห้ามเด็ดขาด: ตัดเมนูที่มีวัตถุดิบนี้หรือข้อมูลส่วนผสมไม่ครบ
          </p>
          <label htmlFor="group-diet">ข้อกำหนดอาหาร</label>
          <label className="go-diet-check">
            <input
              type="checkbox"
              checked={split(diet).includes("vegetarian")}
              onChange={(e) => {
                setChecked(false);
                setDiet(
                  [
                    ...split(diet).filter((v) => v !== "vegetarian"),
                    ...(e.target.checked ? ["vegetarian"] : []),
                  ].join(", "),
                );
              }}
            />
            <span>มังสวิรัติ</span>
            <small>vegetarian</small>
          </label>
          <input
            id="group-diet"
            value={diet}
            onChange={(e) => {
              setChecked(false);
              setDiet(e.target.value);
            }}
            placeholder="ข้อกำหนดอื่นใช้ชื่อ catalog เช่น vegetarian"
          />
          <details className="go-advanced">
            <summary>ตัวเลือกเพิ่มเติม · แนวอาหาร อาการแพ้ สิ่งที่ไม่ชอบ</summary>
            <fieldset>
              <legend>อยากกินแนวไหน</legend>
              <div className="go-tags">
                {cuisineTags.map((t) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={p.cuisinePreferences.includes(t)}
                    onClick={() => toggle("cuisinePreferences", t)}
                  >
                    {names[t]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="group-allergies">อาการแพ้</label>
            <input
              id="group-allergies"
              value={allergies}
              onChange={(e) => {
                setChecked(false);
                setAllergies(e.target.value);
              }}
              placeholder="เช่น peanut / ถั่วลิสง"
            />
            <p className="go-fine">
              อาการแพ้ต้องมีหลักฐานการไม่มีส่วนผสมและ cross-contact ที่ครบ
              ข้อมูลสมมติไม่ใช่การรับรองความปลอดภัย
            </p>
            <label htmlFor="group-dislikes">สิ่งที่ไม่ชอบ (soft dislikes)</label>
            <input
              id="group-dislikes"
              value={dislikes}
              onChange={(e) => {
                setChecked(false);
                setDislikes(e.target.value);
              }}
              placeholder="เช่น sweet, creamy"
            />
            <p className="go-fine">ใช้ลดคะแนนความชอบ ไม่ใช่ข้อห้ามเด็ดขาด</p>
          </details>
          <label className="go-check">
            <input
              type="checkbox"
              required
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>ตรวจสอบและยืนยันข้อมูลของฉัน</span>
          </label>
          <p className="go-fine">
            ฟอร์มนี้เป็นข้อมูลส่วนตัว กลุ่มจะเห็นเมนู ค่าใช้จ่าย และคะแนน
            โดยไม่แสดงรายการข้อจำกัดส่วนตัวของคุณ
          </p>
          {error && (
            <p className="go-error" role="alert">
              {error}
            </p>
          )}
          <button className="go-primary" disabled={!checked || busy}>
            {busy ? "กำลังบันทึก…" : "ยืนยันความต้องการ"}{" "}
            <span aria-hidden="true">✓</span>
          </button>
        </form>
      </section>
    </div>
  );
}
