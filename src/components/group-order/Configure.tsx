"use client";
import { useState } from "react";
import type { SessionView } from "@/contracts";
export default function Configure({
  session,
  onClose,
  onSave,
}: {
  session: SessionView;
  onClose: () => void;
  onSave: (ids: string[]) => Promise<boolean>;
}) {
  const members = session.members.filter((m) => m.active);
  const [selected, setSelected] = useState(
    session.meal?.selectedMemberIds ?? members.map((m) => m.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (!(await onSave(selected))) setError("บันทึกไม่สำเร็จ ตรวจรายชื่อและลองอีกครั้ง");
    setBusy(false);
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
        aria-labelledby="group-config-title"
      >
        <div className="go-grip" />
        <button
          className="go-close"
          aria-label="ปิดการจัดการผู้ร่วมสั่ง"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <p className="go-eyebrow">GROUP MEMBERS</p>
        <h2 id="group-config-title">จัดการผู้ร่วมสั่ง</h2>
        <p className="go-muted">
          เลือกจากสมาชิกที่อยู่ในกลุ่ม ทุกคนที่ถูกเลือกต้องเข้าร่วมและยืนยันด้วยตัวเอง
          คนที่ยังไม่ตอบจะไม่ถูกตัดออกอัตโนมัติ
        </p>
        <form onSubmit={submit}>
          <div className="go-select-members">
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
                <span className={`go-avatar tone-${i % 4}`}>
                  {m.displayName.slice(0, 1)}
                </span>
                <strong>{m.displayName}</strong>
                <small>{m.id === session.me?.id ? "คุณ" : ""}</small>
              </label>
            ))}
          </div>
          <label htmlFor="go-config-area">พื้นที่จัดส่งร่วมกัน</label>
          <select id="go-config-area" value="bangkok_demo" onChange={() => {}}>
            <option value="bangkok_demo">
              Bangkok demo · โซนจำลองเดียวที่รองรับ
            </option>
          </select>
          <div className="go-summary-row">
            <span>โซนร่วมกัน</span>
            <b>Bangkok demo · เดลิเวอรี</b>
          </div>
          <p className="go-info-note">
            ยืนยันแล้วจะเปิดการตัดสินใจใหม่และยกเลิกผล เสียงยอมรับ และตะกร้าเดิม
            ผู้ร่วมเดิมเก็บข้อมูลที่ยืนยันไว้ ผู้ร่วมใหม่ต้องยืนยันเองอีกครั้ง
          </p>
          <p className="go-fine">เปิดดูหรือยกเลิกหน้านี้ยังไม่เปลี่ยนข้อมูลกลุ่ม</p>
          {error && (
            <p className="go-error" role="alert">
              {error}
            </p>
          )}
          <button className="go-primary" disabled={busy || !selected.length}>
            {busy ? "กำลังบันทึก…" : "ยืนยันผู้ร่วมสั่ง"}
          </button>
        </form>
      </section>
    </div>
  );
}
