import Link from "next/link";
import type { ReactNode } from "react";
import { HomeIcon } from "./HomeIcons";
import "./delivery-home.css";
import "./chat-room.css";

export default function ChatShell({
  title,
  subtitle,
  onInvite,
  onMembers,
  children,
}: {
  title: string;
  subtitle?: string;
  onInvite?: () => void;
  onMembers?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="go-page dh-page">
      <div className="go-app dh-app chat-screen">
        <header className="chat-bar">
          <Link href="/" aria-label="กลับหน้าอาหาร">
            <HomeIcon name="back" />
          </Link>
          <img src="/food/rice.jpg" alt="" width="38" height="38" />
          <div className="chat-title">
            <h1>{title}</h1>
            {onMembers ? (
              <button onClick={onMembers} aria-label="ดูสมาชิกในมื้อนี้">
                {subtitle} ›
              </button>
            ) : (
              <small>{subtitle}</small>
            )}
          </div>
          {onInvite && (
            <button className="chat-invite-button" onClick={onInvite}>
              <HomeIcon name="people" />
              ชวนเพื่อน
            </button>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}
