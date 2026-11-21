"use client";
import { useEffect, useRef, useState } from "react";
import { HomeIcon } from "./HomeIcons";

export function roomInviteUrl(sessionId: string) {
  const url = new URL(`/group/${sessionId}`, location.origin);
  if (
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    process.env.NEXT_PUBLIC_DEV_LAN_HOST
  )
    url.hostname = process.env.NEXT_PUBLIC_DEV_LAN_HOST;
  return url.href;
}

export default function ChatInvite({
  sessionId,
  onContinue,
}: {
  sessionId: string;
  onContinue: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(roomInviteUrl(sessionId));
      setNotice("คัดลอกลิงก์แล้ว");
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice("เลือกคัดลอกลิงก์ แล้วส่งให้เพื่อนได้เลย");
    }
  }
  return (
    <dialog
      ref={dialog}
      className="room-invite"
      aria-label="แชร์ห้องแชต"
      onCancel={(e) => {
        e.preventDefault();
        onContinue();
      }}
    >
      <header>
        <HomeIcon name="people" />
        <h2>ชวนเพื่อนเข้าห้องแชต</h2>
      </header>
      <p>ส่งลิงก์ให้เพื่อน แล้วคุยกันว่ามื้อนี้อยากกินอะไร</p>
      <div>
        <input
          ref={input}
          readOnly
          aria-label="ลิงก์ห้องแชต"
          value={roomInviteUrl(sessionId)}
          onFocus={(e) => e.target.select()}
        />
        <button onClick={() => void copy()}>คัดลอก</button>
      </div>
      {typeof navigator.share === "function" && (
        <button
          className="go-outline"
          onClick={async () => {
            try {
              await navigator.share({
                title: "CraveLoop Group Order",
                url: roomInviteUrl(sessionId),
              });
            } catch (e) {
              if (!(e instanceof DOMException && e.name === "AbortError"))
                setNotice("คัดลอกลิงก์เพื่อแชร์ได้เลย");
            }
          }}
        >
          แชร์ไปยังแอป
        </button>
      )}
      {notice && <small role="status">{notice}</small>}
      <button className="go-primary" onClick={onContinue}>
        เข้าห้องแชต
      </button>
    </dialog>
  );
}
