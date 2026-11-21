"use client";
import { useState, useEffect, useRef } from "react";
import type { SessionView } from "@/contracts";
import type { ChatResponse } from "@/contracts/chat";
import { api } from "../api";
import type { ReactNode } from "react";

export default function MealChat({
  session,
  onSent,
  actions,
  tools,
}: {
  session: SessionView;
  actions: ReactNode;
  tools: ReactNode;
  onSent: (r: ChatResponse) => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const history = useRef<HTMLDivElement>(null);
  const last = session.messages?.at(-1)?.id;
  useEffect(() => {
    if (history.current)
      history.current.scrollTop = history.current.scrollHeight;
  }, [last]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await api<ChatResponse>(
        `/api/sessions/${session.id}/chat`,
        "POST",
        { action: "message", text: message.trim() },
      );
      setMessage("");
      onSent(response);
    } catch {
      setError("ส่งข้อความไม่สำเร็จ ลองส่งอีกครั้ง");
    } finally {
      setSending(false);
    }
  }
  return (
    <main className="conversation" aria-label="แชตมื้อนี้">
      <div className="conversation-scroll" ref={history}>
        <div className="conversation-start">
          <img src="/food/rice.jpg" alt="" width="88" height="88" />
          <h2>มื้อนี้ กินอะไรดี?</h2>
          <p>คุยกันในกลุ่ม แล้วให้ CraveLoop ช่วยเลือกร้าน</p>
        </div>
        <div className="conversation-log" role="log" aria-label="ข้อความในกลุ่ม">
          <article className="bot">
            <b>
              CraveLoop <small>ผู้ช่วยจำลอง</small>
            </b>
            <p>
              ลองบอกเมนูที่อยากกินกับงบ เช่น “อยากกินกรอบ ๆ งบ 150 บาท”
              แล้วตรวจร่างก่อนยืนยันได้เลย
            </p>
          </article>
          {session.messages?.map((m) => (
            <article
              key={m.id}
              className={m.memberId === session.me?.id ? "mine" : m.kind}
            >
              <b>
                {m.kind === "bot"
                  ? "CraveLoop"
                  : m.kind === "system"
                    ? "กลุ่ม"
                    : session.members.find((p) => p.id === m.memberId)
                        ?.displayName}
              </b>
              <p>{m.text}</p>
            </article>
          ))}
        </div>
        {actions}
      </div>
      <footer className="conversation-dock">
        {error && <p role="alert">{error}</p>}
        {tools}
        <form onSubmit={send}>
          <input
            maxLength={2000}
            aria-label="ข้อความถึงกลุ่ม"
            placeholder="ส่งข้อความถึงทุกคน…"
            value={message}
            disabled={sending}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="go-primary" disabled={!message.trim() || sending}>
            ส่ง
          </button>
        </form>
      </footer>
    </main>
  );
}
