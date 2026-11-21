"use client";
import { useState } from "react";
import { api } from "@/components/api";
import {
  ChatHeader,
  SimulationNotice,
  BotBubble,
} from "@/components/line/ChatShared";
import "@/components/line/line.css";
export default function Home() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ sessionId: string }>("/api/sessions", "POST", {
        hostName: name,
        areaId: "bangkok_demo",
        mode: "dine_in",
        experience: "chat",
        expectedSize: 4,
      });
      location.assign(`/line/${r.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างกลุ่มไม่สำเร็จ");
      setBusy(false);
    }
  }
  return (
    <div className="line-page">
      <div className="line-app line-onboarding">
        <ChatHeader />
        <SimulationNotice />
        <main className="line-transcript">
          <div className="line-date">ตัวอย่างประสบการณ์ · ยังไม่ได้สร้างกลุ่ม</div>
          <div className="line-example-label">
            ข้อความตัวอย่างเพื่ออธิบายเท่านั้น ไม่ใช่สมาชิกจริง
          </div>
          <div className="line-message">
            <span className="line-person-avatar peach">ม</span>
            <div className="line-message-main">
              <span className="line-sender">May · ตัวอย่าง</span>
              <div className="line-bubble">เที่ยงนี้กินอะไรดี อยากกินกรอบ ๆ 😋</div>
            </div>
          </div>
          <div className="line-message own">
            <div className="line-message-main">
              <div className="line-bubble">
                เพิ่ม CraveLoop มาช่วยหามื้อที่ลงตัวกันไหม?
              </div>
            </div>
          </div>
          <BotBubble>
            <div className="line-welcome-brand">
              <span className="line-mini-flower">✳</span>CraveLoop
            </div>
            <h2>
              ต่างคนต่างอยาก
              <br />
              แต่อร่อยด้วยกันได้
            </h2>
            <p>
              เริ่มจากกลุ่มเพื่อน เลือกคนที่ร่วมมื้อนี้
              แล้วแต่ละคนเข้าร่วมและยืนยันความต้องการของตัวเอง
            </p>
            <div className="line-welcome-steps">
              <span>01 เลือกผู้ร่วมมื้อ</span>
              <span>02 เข้าร่วมและบอกความอยาก</span>
              <span>03 เลือกร้านร่วมกัน</span>
            </div>
            <p className="line-subtle">
              ตัวช่วยจับคำทำงานด้วยกฎ ไม่ใช่ AI · การอ่านข้อความและภาพด้วย AI
              เป็นตัวเลือกเมื่อพร้อมใช้งาน · ไม่มีการส่งข้อความออกไป LINE
            </p>
          </BotBubble>
          <section className="line-start-card">
            <p className="line-kicker">ลองใช้กับเพื่อน 4 คน</p>
            <h2>เริ่มกลุ่มมื้ออร่อยของคุณ</h2>
            <form onSubmit={create}>
              <label htmlFor="line-host-name">ชื่อของคุณ</label>
              <input
                id="line-host-name"
                autoComplete="given-name"
                placeholder="เช่น May"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={40}
              />
              <p className="line-subtle">
                ขั้นนี้สร้างเฉพาะกลุ่มแชต แชร์ลิงก์ให้เพื่อนเข้ามาก่อน แล้วค่อยเพิ่ม CraveLoop
                เลือกผู้ร่วมมื้อ โซน และรูปแบบอาหาร
              </p>
              {error && (
                <p role="alert" className="line-error">
                  {error}
                </p>
              )}
              <button className="line-primary" disabled={busy}>
                {busy ? "กำลังสร้างกลุ่ม…" : "สร้างกลุ่มจำลอง"} <span>↗</span>
              </button>
            </form>
            <p className="line-subtle">
              ไม่ต้องสมัครสมาชิก · แชร์ลิงก์ให้เพื่อนเปิดคนละเบราว์เซอร์
              <br />
              Bangkok demo · 12 ร้าน / 60 เมนูสมมติ
            </p>
            <a className="line-old-web" href="/web">
              เปิด prototype แบบเว็บเดิม ↗
            </a>
          </section>
        </main>
        <div className="line-onboarding-footer">
          <span>◉</span> ออกแบบให้เหมือนคุยในกลุ่ม · เป็นเว็บจำลองอิสระ
        </div>
      </div>
    </div>
  );
}
