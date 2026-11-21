"use client";
import { useEffect, useState } from "react";
import type { NoodlePreview } from "@/contracts/group-order";
import type { RoutedDraft } from "@/contracts/router";
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
import { names } from "@/domain/preference-answers";
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
  draft,
  onClose,
  onSaved,
  onConflict,
}: {
  session: SessionView;
  draft?: import("@/contracts/chat").ChatDraft;
  onClose: () => void;
  onSaved: (s: SessionView) => void;
  onConflict: () => void;
}) {
  const [p, setP] = useState<Preference>(() =>
    structuredClone(
      draft?.preference ?? session.me?.preference ?? emptyPreference,
    ),
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
  const [text, setText] = useState("");
  const [routed, setRouted] = useState<RoutedDraft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const proposed = {
    ...p,
    budgetMaxSatang: budget === "" ? null : Math.round(Number(budget) * 100),
    excludedIngredients: split(excluded),
    dietaryRequirements: split(diet),
    allergies: split(allergies),
    dislikes: split(dislikes).map(value => Object.keys(names).find(tag => names[tag] === value) ?? value),
  };
  const request = {
    expectedMemberRevision: revision,
    expectedPreferenceVersion: session.preferenceVersion,
    expectedRosterVersion: session.rosterVersion,
    confirmedPreference: proposed,
  };
  const previewBody = p.noodle === "any" ? JSON.stringify(request) : "";
  const [preview, setPreview] = useState<
    | (NoodlePreview & {
        body: string;
        rankingId?: string;
        answer?: string;
        failed?: boolean;
      })
    | null
  >(null);
  const rankingId = session.ranking?.id;
  const current =
    preview?.body === previewBody && preview.rankingId === rankingId
      ? preview
      : null;
  const choice = current?.choices.find((c) => c.style === current.answer);
  const needsChoice =
    !!previewBody &&
    (!current || (!!current.choices.length && !current.answer));

  useEffect(() => {
    setPreview(null);
    if (!previewBody) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await api<NoodlePreview>(
          `/api/sessions/${session.id}/preferences/me/noodles`,
          "POST",
          JSON.parse(previewBody),
        );
        if (active) setPreview({ ...result, body: previewBody, rankingId });
      } catch {
        if (active)
          setPreview({
            choices: [],
            body: previewBody,
            rankingId,
            failed: true,
          });
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [previewBody, rankingId, session.id]);
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
  async function draftText() {
    setBusy(true);
    setError("");
    setChecked(false);
    setReviewed(false);
    try {
      const next = await api<RoutedDraft>(
        `/api/sessions/${session.id}/preferences/me/router`,
        "POST",
        { ...request, text },
      );
      setRouted(next);
      const draft = next.preference;
      setP(draft);
      setBudget(
        draft.budgetMaxSatang === null
          ? ""
          : String(draft.budgetMaxSatang / 100),
      );
      setExcluded(draft.excludedIngredients.join(", "));
      setDiet(draft.dietaryRequirements.join(", "));
      setAllergies(draft.allergies.join(", "));
      setDislikes(draft.dislikes.join(", "));
    } catch (e) {
      setRouted(null);
      setError(e instanceof Error ? e.message : "กรุณากรอกข้อมูลเอง");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!checked || needsChoice || (routed?.questions.length && !reviewed))
      return;
    setBusy(true);
    setError("");
    try {
      const next = await api<SessionView>(
        `/api/sessions/${session.id}/preferences/me`,
        "PUT",
        {
          ...request,
          ...(routed
            ? {
                routerDraftId: routed.id,
                reviewedQuestions: reviewed || undefined,
              }
            : {}),
          ...(choice
            ? {
                noodleDraft: choice.draft,
                confirmedPreference: { ...proposed, noodle: choice.style },
              }
            : {}),
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
        {draft?.questions.map((q) => (
          <p className="go-info-note" key={q}>
            {q}
          </p>
        ))}
        <form onSubmit={submit} inert={busy}>
          {session.ai.available && (
            <details className="go-advanced">
              <summary>ร่างความต้องการจากข้อความด้วย AI</summary>
              <label htmlFor="group-router">
                อยากกินอะไร หรืออยากแก้อะไรจากครั้งก่อน
              </label>
              <input
                id="group-router"
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="go-outline"
                type="button"
                disabled={!text.trim() || busy}
                onClick={draftText}
              >
                ส่งข้อความให้ AI ร่าง
              </button>
              {routed && (
                <p role="status">
                  {routed.intent === "chat"
                    ? "ข้อความนี้ไม่มีความต้องการใหม่"
                    : "ตรวจร่างในช่องด้านล่างก่อนยืนยัน"}{" "}
                  {routed.evidence.join(" · ")}
                </p>
              )}
            </details>
          )}
          {p.desiredDish && (
            <p>
              เมนูที่อยากกิน · {p.desiredDish}{" "}
              <button
                type="button"
                className="go-outline"
                onClick={() => {
                  setP({ ...p, desiredDish: undefined });
                  setChecked(false);
                }}
              >
                ลบเมนูที่อยากกิน
              </button>
            </p>
          )}
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
          <fieldset>
            <legend>ประเภทอาหาร</legend>
            <div className="go-tags">
              <button
                type="button"
                aria-pressed={!!p.noodle}
                onClick={() => {
                  setChecked(false);
                  setP({ ...p, noodle: p.noodle ? undefined : "any" });
                }}
              >
                อยากกินเส้น
              </button>
            </div>
            {p.noodle && p.noodle !== "any" && (
              <p>
                ที่ยืนยันไว้ · {p.noodle === "broth" ? "เส้นน้ำ" : "เส้นผัด"}{" "}
                <button
                  type="button"
                  className="go-outline"
                  onClick={() => {
                    setChecked(false);
                    setP({ ...p, noodle: "any" });
                  }}
                >
                  เลือกแบบเส้นอีกครั้ง
                </button>
              </p>
            )}
            {previewBody && !current && (
              <p role="status">กำลังตรวจเมนูที่ผ่านเงื่อนไขของกลุ่ม…</p>
            )}
            {current?.failed && (
              <p role="status">
                ตรวจตัวเลือกเพิ่มเติมไม่ได้ คุณยังยืนยันความชอบอาหารเส้นได้
              </p>
            )}
            {!!current?.choices.length && (
              <fieldset>
                <legend>อยากกินเส้นน้ำหรือเส้นผัด?</legend>
                <div className="go-tags">
                  {[
                    ...current.choices.map((c) => ({
                      value: c.style,
                      label: c.style === "broth" ? "เส้นน้ำ" : "เส้นผัด",
                    })),
                    { value: "either", label: "ได้ทั้งคู่" },
                    { value: "skip", label: "ข้าม" },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.value}
                      aria-pressed={current.answer === option.value}
                      onClick={() => {
                        setChecked(false);
                        setPreview({ ...current, answer: option.value });
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </fieldset>
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
          {!!routed?.questions.length && (
            <fieldset>
              <legend>คำถามที่ต้องตรวจในร่าง</legend>
              <ul>
                {routed.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <label className="go-check">
                <input
                  type="checkbox"
                  required
                  checked={reviewed}
                  onChange={(e) => {
                    setReviewed(e.target.checked);
                    setChecked(false);
                  }}
                />
                ตรวจคำถามและแก้ข้อมูลในฟอร์มแล้ว
              </label>
            </fieldset>
          )}
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
          <button
            className="go-primary"
            disabled={
              !checked ||
              busy ||
              needsChoice ||
              (!!routed?.questions.length && !reviewed)
            }
          >
            {busy ? "กำลังบันทึก…" : "ยืนยันความต้องการ"}{" "}
            <span aria-hidden="true">✓</span>
          </button>
        </form>
      </section>
    </div>
  );
}
