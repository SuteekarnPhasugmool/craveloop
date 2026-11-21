"use client";
import { useState } from "react";
import type { Mode, SessionView } from "@/contracts";
export default function MealSetup({
  session,
  onClose,
  onStart,
}: {
  session: SessionView;
  onClose: () => void;
  onStart: (memberIds: string[], mode: Mode) => Promise<boolean>;
}) {
  const members = session.members.filter((m) => m.active);
  const [selected, setSelected] = useState<string[]>(
    session.meal?.phase === "collecting"
      ? session.meal.selectedMemberIds
      : members.map((m) => m.id),
  );
  const [mode, setMode] = useState<Mode>(session.mode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected.length) return;
    setBusy(true);
    setError("");
    try {
      if (!(await onStart(selected, mode)))
        setError("ข้อมูลกลุ่มเปลี่ยนแล้ว ตรวจสมาชิกและลองยืนยันใหม่");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="line-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="line-drawer line-meal-setup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-setup-heading"
      >
        <div className="line-drawer-grip" />
        <header className="line-drawer-header">
          <div>
            <p className="line-kicker">เริ่มมื้อ · ไม่ใช่เพิ่มสมาชิกกลุ่ม</p>
            <h2 id="meal-setup-heading">ตั้งค่ามื้อนี้</h2>
          </div>
          <button
            className="line-icon-button"
            aria-label="ปิดการตั้งค่ามื้อ"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </header>
        <p className="line-rules-note">
          เลือกจากสมาชิกที่อยู่ในกลุ่มจริง ทุกคนที่เลือกต้องกด “เข้าร่วมมื้อนี้” ด้วยตัวเอง
          รวมถึงเจ้าของกลุ่มด้วย
        </p>
        <form onSubmit={submit}>
          <fieldset className="line-select-participants">
            <legend>
              ใครร่วมมื้อนี้บ้าง ({selected.length}/{members.length})
            </legend>
            {members.map((m, i) => (
              <label key={m.id}>
                <input
                  type="checkbox"
                  aria-label={m.displayName}
                  checked={selected.includes(m.id)}
                  onChange={(e) =>
                    setSelected((ids) =>
                      e.target.checked
                        ? [...ids, m.id]
                        : ids.filter((id) => id !== m.id),
                    )
                  }
                />
                <span className={`line-person-avatar color-${i % 4}`}>
                  {m.displayName.slice(0, 1)}
                </span>
                <span>{m.displayName}</span>
                {m.id === session.me?.id && <small>คุณ · เจ้าของกลุ่ม</small>}
              </label>
            ))}
          </fieldset>
          <p className="line-subtle">
            สมาชิกที่ไม่ได้เลือกยังคุยในกลุ่มได้ แต่ไม่ถูกนับในความพร้อม คะแนน
            และเสียงยอมรับของมื้อนี้
          </p>
          <label htmlFor="meal-area">โซนที่นัดกัน</label>
          <select id="meal-area" value="bangkok_demo" onChange={() => {}}>
            <option value="bangkok_demo">Bangkok demo · โซนสมมติร่วมกัน</option>
          </select>
          <p className="line-subtle">
            ใช้ catalog สมมติในโซนเดียว ไม่ได้อ่านตำแหน่งหรือค้นหาร้านสด
          </p>
          <label htmlFor="meal-mode">รูปแบบมื้ออาหาร</label>
          <select
            id="meal-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            <option value="dine_in">กินที่ร้าน</option>
            <option value="delivery">เดลิเวอรี</option>
          </select>
          {session.ranking && (
            <p className="line-warning">
              การเปลี่ยนผู้ร่วมมื้อจะยกเลิกผลและเสียงยอมรับเดิม ต้องจัดอันดับใหม่เมื่อทุกคนพร้อม
            </p>
          )}
          {error && (
            <p role="alert" className="line-error">
              {error}
            </p>
          )}
          <button
            className="line-primary"
            disabled={busy || selected.length === 0}
          >
            {busy ? "กำลังเริ่มมื้อ…" : "ยืนยันและเริ่มมื้อ"} <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>
    </div>
  );
}
