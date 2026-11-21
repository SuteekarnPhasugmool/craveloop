export function BotAvatar({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`line-bot-avatar ${small ? "small" : ""}`}
      aria-label="CraveLoop"
    >
      C<span>↗</span>
    </span>
  );
}
export function ChatHeader({
  count = 4,
  title = "มื้อนี้กินอะไรดี?",
}: {
  count?: number;
  title?: string;
}) {
  return (
    <header className="line-header">
      <a href="/" className="line-back" aria-label="กลับหน้าหลัก">
        ‹
      </a>
      <span className="line-group-avatar">🍜</span>
      <div className="line-group-title">
        <h1>
          {title} <span>({count})</span>
        </h1>
        <p>
          <span /> LINE-style simulation · ไม่เชื่อมต่อ LINE
        </p>
      </div>
      <span className="line-header-more" aria-hidden="true">
        ☰
      </span>
    </header>
  );
}
export function SimulationNotice() {
  return (
    <div className="line-simulation">
      <span>SIMULATION</span>
      <p>กลุ่มแชตจำลอง · ร้าน เมนู ราคา และหลักฐานอาหารเป็นข้อมูลสมมติ</p>
    </div>
  );
}
export function BotBubble({
  children,
  time,
}: {
  children: React.ReactNode;
  time?: string;
}) {
  return (
    <div className="line-message bot">
      <BotAvatar />
      <div className="line-message-main">
        <span className="line-sender">
          CraveLoop <i>BOT จำลอง</i>
        </span>
        <div className="line-bubble">{children}</div>
      </div>
      {time && <time>{time}</time>}
    </div>
  );
}
