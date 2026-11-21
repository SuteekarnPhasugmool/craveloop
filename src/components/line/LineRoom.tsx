"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Option, SessionView } from "@/contracts";
import { emptyPreference } from "@/contracts";
import type { ChatDraft, ChatResponse } from "@/contracts/chat";
import { api, money, RequestError } from "../api";
import PreferenceForm from "../PreferenceForm";
import {
  BotAvatar,
  BotBubble,
  ChatHeader,
  SimulationNotice,
} from "./ChatShared";
import ReviewDrawer from "./ReviewDrawer";
import MealSetup from "./MealSetup";
import "./line.css";
const time = (date: string) =>
  new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(date));
const rejectionNames: Record<string, string> = {
  BUDGET_EXCEEDED: "เกินงบ",
  PRICE_UNKNOWN: "ไม่ทราบราคา",
  INGREDIENTS_UNKNOWN: "ส่วนผสมไม่ครบ",
  EXCLUSION_PRESENT: "มีวัตถุดิบที่ไม่กิน",
  DIET_UNVERIFIED: "ไม่มีหลักฐานข้อกำหนดอาหาร",
  CROSS_CONTACT_UNKNOWN: "ไม่มีหลักฐาน cross-contact",
  CHANNEL_UNAVAILABLE: "ไม่รองรับรูปแบบมื้อนี้",
  RESTAURANT_UNAVAILABLE: "ร้านไม่พร้อม",
  UNKNOWN_RESTRICTION: "ยังไม่รู้จักข้อจำกัดนี้",
  NO_AVAILABLE_MENU: "ไม่มีเมนูที่พร้อม",
};
export default function LineRoom({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<ChatResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [text, setText] = useState("");
  const [joinName, setJoinName] = useState("");
  const [draft, setDraft] = useState<ChatDraft | null>(null);
  const [aiDrawer, setAiDrawer] = useState(false);
  const [mealSetup, setMealSetup] = useState(false);
  const [copied, setCopied] = useState("");
  const [connected, setConnected] = useState(true);
  const generation = useRef(0);
  const joinId = useRef<string | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const lastRanking = useRef<string | null>(null);
  const lastRankingAttached = useRef(false);
  const base = `/api/sessions/${sessionId}`;
  const s = data?.session;
  const refresh = useCallback(async () => {
    const revision = generation.current;
    try {
      const next = await api<ChatResponse>(base + "/chat");
      if (revision === generation.current) setData(next);
      setConnected(true);
      return next;
    } catch (e) {
      setConnected(false);
      setError(e instanceof Error ? e.message : "เปิดกลุ่มไม่สำเร็จ");
      return null;
    }
  }, [base]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failed = 0;
    async function poll() {
      if (document.visibilityState === "visible") {
        const next = await refresh();
        failed = next ? 0 : Math.min(3, failed + 1);
      }
      if (!stopped) timer = setTimeout(poll, 2000 * 2 ** failed);
    }
    void poll();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
  useEffect(() => {
    const container = transcript.current;
    if (!container) return;
    const rankingId = s?.ranking?.id ?? null;
    const attached =
      !!rankingId &&
      !!data?.chat.messages.some((m) => m.rankingId === rankingId);
    // A save returns the new result before polling returns its chat message.
    // Keep the updated result visible through both renders instead of jumping to the last card.
    const isNewRanking =
      rankingId !== lastRanking.current ||
      attached !== lastRankingAttached.current;
    lastRanking.current = rankingId;
    lastRankingAttached.current = attached;
    const results = container.querySelector<HTMLElement>(
      '[data-testid="chat-results"]',
    );
    // Open a fresh result at its first option; ordinary new messages stay at the bottom.
    const top =
      isNewRanking && rankingId && !s?.finalizedOptionId && results
        ? results.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop -
          12
        : container.scrollHeight;
    container.scrollTo({ top, behavior: "smooth" });
  }, [data?.chat.messages.at(-1)?.id, s?.ranking?.id, s?.finalizedOptionId]);
  async function fail(e: unknown) {
    setError(
      e instanceof RequestError && e.status === 409
        ? "ข้อมูลกลุ่มเปลี่ยนแล้ว กรุณาตรวจผลล่าสุดและลองอีกครั้ง"
        : e instanceof Error
          ? e.message
          : "เกิดข้อผิดพลาด ลองอีกครั้งได้เลย",
    );
    await refresh();
  }
  async function act(
    path: string,
    method: string,
    body: unknown,
    label: string,
  ) {
    setBusy(label);
    setError("");
    generation.current++;
    try {
      await api(base + path, method, body);
      const next = await api<ChatResponse>(base + "/chat");
      setData(next);
      return next;
    } catch (e) {
      await fail(e);
      return null;
    } finally {
      generation.current++;
      setBusy("");
    }
  }
  function versions() {
    return {
      expectedPreferenceVersion: s!.preferenceVersion,
      expectedRosterVersion: s!.rosterVersion,
    };
  }
  async function chat(action: "invite_bot" | "message", value?: string) {
    setBusy("message");
    setError("");
    generation.current++;
    try {
      const next = await api<ChatResponse>(
        base + "/chat",
        "POST",
        action === "invite_bot" ? { action } : { action, text: value ?? text },
      );
      setData(next);
      if (action === "message") {
        setText("");
        if (
          next.draft &&
          (!next.session.meal ||
            (next.session.meal.phase === "collecting" &&
              next.session.meal.joinedMemberIds.includes(next.session.me!.id)))
        )
          setDraft(next.draft);
      }
    } catch (e) {
      await fail(e);
    } finally {
      generation.current++;
      setBusy("");
    }
  }
  async function openMealSetup() {
    if (s) setMealSetup(true);
  }
  async function startMeal(
    selectedMemberIds: string[],
    mode: "dine_in" | "delivery",
  ) {
    if (!s) return false;
    // Merely inspecting/cancelling setup must not destroy an existing decision.
    // Reopen only after the host confirms the reviewed participant/settings change.
    let current = s;
    if (!current.membershipOpen || current.status === "finalized") {
      const reopened = await act(
        "",
        "PATCH",
        {
          action: "reopen",
          expectedPreferenceVersion: current.preferenceVersion,
          expectedRosterVersion: current.rosterVersion,
        },
        "reopen",
      );
      if (!reopened) return false;
      current = reopened.session;
    }
    const next = await act(
      "/chat",
      "POST",
      {
        action: "start_meal",
        selectedMemberIds,
        areaId: "bangkok_demo",
        mode,
        expectedPreferenceVersion: current.preferenceVersion,
        expectedRosterVersion: current.rosterVersion,
      },
      "start_meal",
    );
    if (next) {
      setMealSetup(false);
      setDraft(null);
      setAiDrawer(false);
      return true;
    }
    return false;
  }
  function openOwnPreferences() {
    if (!s?.me) return;
    setDraft({
      preference: s.me.preference ?? emptyPreference,
      questions: [],
      source: "rules",
      recognized: false,
    });
  }
  function showOtherOptions() {
    const container = transcript.current;
    const cards = container?.querySelectorAll<HTMLElement>(
      '[data-testid^="chat-option-"]',
    );
    if (!container || !cards?.length) return;
    const card = cards.length > 1 ? cards[1] : cards[0];
    container.scrollTo({
      top:
        card.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        12,
      behavior: "smooth",
    });
  }
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy("join");
    setError("");
    try {
      joinId.current ??= crypto.randomUUID();
      await api(base + "/join", "POST", {
        displayName: joinName,
        clientJoinId: joinId.current,
      });
      await refresh();
    } catch (e) {
      await fail(e);
    } finally {
      setBusy("");
    }
  }
  async function copy(value: string, notice: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(notice);
      setTimeout(() => setCopied(""), 3500);
    } catch {
      setCopied("คัดลอกไม่สำเร็จ เลือกข้อความหรือคัดลอกจากแถบที่อยู่ได้");
    }
  }
  function choice(option: Option) {
    return {
      ...versions(),
      rankingId: s!.ranking!.id,
      restaurantId: option.restaurantId,
    };
  }
  function summary(option: Option) {
    return [
      "CraveLoop · กลุ่มแชตจำลอง / ข้อมูลร้านสมมติ",
      option.restaurantName,
      s!.mode === "delivery" ? "เดลิเวอรี · ค่าจัดส่งสมมติ" : "กินที่ร้าน",
      ...option.assignments.map(
        (a) =>
          `${s!.members.find((m) => m.id === a.memberId)?.displayName}: ${a.menuName} (${a.menuId}) ${money(a.totalCostSatang)}`,
      ),
      `รวม ${money(option.totalGroupCostSatang)} · คะแนน ${option.groupScore.toFixed(1)}`,
      typeof window !== "undefined" ? window.location.href : "",
      "ไม่ได้จองหรือสั่งอาหารจริง",
    ].join("\n");
  }
  if (!data || !s)
    return (
      <div className="line-page">
        <div className="line-app">
          <ChatHeader />
          <SimulationNotice />
          <main className="line-transcript line-loading">
            <BotAvatar />
            <h2>กำลังเปิดกลุ่ม…</h2>
            {error && (
              <p className="line-error" role="alert">
                {error}
              </p>
            )}
            <button className="line-outline" onClick={() => void refresh()}>
              ลองอีกครั้ง
            </button>
            <a href="/">สร้างกลุ่มใหม่</a>
          </main>
        </div>
      </div>
    );
  const groupMembers = s.members.filter((m) => m.active);
  const active = s.meal
    ? groupMembers.filter((m) => s.meal!.selectedMemberIds.includes(m.id))
    : groupMembers;
  const ready = active.filter(
    (m) => m.confirmed && (!s.meal || s.meal.joinedMemberIds.includes(m.id)),
  ).length;
  const selected =
    !!s.me && (!s.meal || s.meal.selectedMemberIds.includes(s.me.id));
  const joined =
    !!s.me && (!s.meal || s.meal.joinedMemberIds.includes(s.me.id));
  const canParticipate =
    selected && joined && (!s.meal || s.meal.phase === "collecting");
  const mealReady =
    active.length > 0 &&
    ready === active.length &&
    (!s.meal || s.meal.phase === "collecting");
  const mealStarted = s.meal?.phase === "collecting";
  const own = s.acceptances.find((a) => a.memberId === s.me?.id);
  const final = s.ranking?.options.find(
    (o) => o.restaurantId === s.finalizedOptionId,
  );
  const rankingMessageId = s.ranking
    ? data.chat.messages.find((m) => m.rankingId === s.ranking!.id)?.id
    : undefined;
  const rankingContent = s.ranking && (
    <div className="line-results-block" data-testid="chat-results">
      <div className="line-message bot">
        <BotAvatar />
        <div className="line-message-main">
          <span className="line-sender">
            CraveLoop <i>ผลจากโค้ดจัดอันดับ</i>
          </span>
          <div className="line-bubble line-result-intro">
            <h2>
              {s.status === "finalized"
                ? "ทุกคนตกลงร้านเดียวกันแล้ว 🎉"
                : s.ranking.status === "no_match"
                  ? "ยังไม่มีร้านที่ผ่านครบทุกคน"
                  : "เจอเมนูให้ทุกคนแล้ว 🍽"}
            </h2>
            <p>
              {s.ranking.status === "no_match"
                ? "ไม่มีการผ่อนข้อจำกัดลับ ๆ ลองปรับงบหรือเงื่อนไขของคุณ แล้วตรวจและยืนยันใหม่"
                : "คะแนนความชอบ = 60% ค่าเฉลี่ย + 40% คนที่ได้คะแนนต่ำสุด"}
            </p>
            <p className="line-subtle">
              {s.ranking.catalogVersion} · v{s.ranking.preferenceVersion}/
              {s.ranking.rosterVersion} · ร้านสมมติทั้งหมด
            </p>
            <div
              className="line-replan-note"
              role="status"
              data-testid="ranking-update"
            >
              <strong>
                ✓ คำนวณตามข้อมูลที่ยืนยันล่าสุดแล้ว · เวอร์ชัน{" "}
                {s.ranking.preferenceVersion}
              </strong>
              <p>
                อัปเดต {time(s.ranking.createdAt)} น. ·
                ผลและเสียงยอมรับเก่าใช้ไม่ได้กับเวอร์ชันใหม่
              </p>
              {s.ranking.update?.outcome === "unchanged" &&
                s.ranking.status === "ok" && (
                  <p>
                    ร้าน เมนู ราคา และคะแนนยังเหมือนเดิมใน catalog จำลองชุดนี้
                    ไม่ต้องกดหาให้หน่อยซ้ำ
                  </p>
                )}
            </div>
            {s.lastChange && (
              <p className="line-replan-note">↻ {s.lastChange}</p>
            )}
          </div>
        </div>
      </div>
      {s.ranking.status === "no_match" ? (
        <div className="line-no-match" data-testid="chat-no-match">
          <h3>ไม่พบร้านที่ตรงเงื่อนไข</h3>
          <ul>
            {Object.entries(
              s.ranking.rejections.reduce<Record<string, number>>(
                (r, item) => ({
                  ...r,
                  [item.code]: (r[item.code] ?? 0) + 1,
                }),
                {},
              ),
            ).map(([code, count]) => (
              <li key={code}>
                <span>{rejectionNames[code] ?? code}</span>
                <b>{count} checks</b>
              </li>
            ))}
          </ul>
          <details>
            <summary>ดูหลักฐานการคัดออก</summary>
            {s.ranking.rejections.map((r, i) => (
              <p key={i}>
                {r.restaurantId} {r.menuId} · {r.code}
              </p>
            ))}
          </details>
        </div>
      ) : (
        s.ranking.options
          .filter((o) => !final || o.restaurantId === final.restaurantId)
          .map((o, index) => {
            const count = s.acceptances.filter(
              (a) =>
                a.restaurantId === o.restaurantId &&
                a.rankingId === s.ranking!.id,
            ).length;
            const accepted =
              own?.restaurantId === o.restaurantId &&
              own?.rankingId === s.ranking!.id;
            return (
              <article
                className="line-restaurant-card"
                key={o.restaurantId}
                data-testid={`chat-option-${o.restaurantId}`}
              >
                <div className="line-card-visual">
                  <div className="line-food-icon">
                    {index === 0 ? "🍱" : index === 1 ? "🥗" : "🍜"}
                  </div>
                  <span>ภาพประกอบ · ข้อมูลสมมติ</span>
                  <span className="line-option-number">
                    {final ? "✓ ตกลงร่วมกัน" : `ตัวเลือก ${index + 1}`}
                  </span>
                </div>
                <div className="line-card-body">
                  <div className="line-card-heading">
                    <div>
                      <p className="line-kicker">
                        SYNTHETIC CATALOG · {o.restaurantId}
                      </p>
                      <h3>{o.restaurantName}</h3>
                    </div>
                    <div className="line-group-score">
                      <strong>{o.groupScore.toFixed(1)}</strong>
                      <small>GROUP FIT</small>
                    </div>
                  </div>
                  <div className="line-card-scores">
                    <span>
                      เฉลี่ย <b>{o.meanScore.toFixed(1)}</b>
                    </span>
                    <span>
                      ต่ำสุด <b>{o.minimumScore.toFixed(1)}</b>
                    </span>
                    <span>
                      รวม <b>{money(o.totalGroupCostSatang)}</b>
                    </span>
                  </div>
                  <div className="line-meals">
                    {o.assignments.map((a) => (
                      <div key={a.memberId} className="line-meal">
                        <div>
                          <strong>
                            {
                              s.members.find((m) => m.id === a.memberId)
                                ?.displayName
                            }
                            {a.memberId === s.me?.id ? " · คุณ" : ""}
                          </strong>
                          <span>fit {a.fitScore.toFixed(1)}</span>
                        </div>
                        <p>
                          <span>{a.menuName}</span>
                          <b>{money(a.totalCostSatang)}</b>
                        </p>
                        <small>
                          อาหาร {money(a.itemCostSatang)} + ค่าบริการ/ส่ง{" "}
                          {money(a.allocatedFeeSatang)} ·{" "}
                          <code>{a.menuId}</code>
                        </small>
                        <details>
                          <summary>หลักฐานจาก catalog</summary>
                          {a.constraintEvidence.map((e, i) => (
                            <p key={i}>
                              {e.field}: {e.evidenceId}
                            </p>
                          ))}
                        </details>
                      </div>
                    ))}
                  </div>
                  <p className="line-subtle">
                    ทุกคนมีเมนูผ่านข้อจำกัดที่ยืนยัน ข้อมูลเมนู ส่วนผสม และราคาเป็นสมมติ
                    ไม่ใช่คำรับรองความปลอดภัยหรือบริการสด
                  </p>
                  <div className="line-votes">
                    <span>
                      {active.map((m) => (
                        <i
                          key={m.id}
                          className={
                            s.acceptances.some(
                              (a) =>
                                a.memberId === m.id &&
                                a.rankingId === s.ranking!.id &&
                                a.restaurantId === o.restaurantId,
                            )
                              ? "yes"
                              : ""
                          }
                        />
                      ))}
                    </span>
                    <b>
                      ยอมรับ {count}/{active.length} คน
                    </b>
                  </div>
                  {(canParticipate || s.isHost) && s.status !== "finalized" && (
                    <div className="line-card-actions">
                      {canParticipate && (
                        <>
                          <button
                            className={
                              accepted ? "line-accepted" : "line-primary"
                            }
                            disabled={!!busy}
                            onClick={() =>
                              void act(
                                "/acceptance/me",
                                accepted ? "DELETE" : "PUT",
                                choice(o),
                                "accept",
                              )
                            }
                          >
                            {accepted ? "✓ ยอมรับแล้ว · ถอนเสียง" : "ยอมรับร้านนี้"}
                          </button>
                          <button
                            className="line-outline"
                            disabled={!!busy}
                            onClick={openOwnPreferences}
                          >
                            แก้ความต้องการของฉัน
                          </button>
                        </>
                      )}
                      <button
                        className="line-outline"
                        disabled={(s.ranking?.options.length ?? 0) < 2}
                        onClick={showOtherOptions}
                      >
                        ดูตัวเลือกอื่น
                      </button>
                      {s.isHost && (
                        <button
                          className="line-outline"
                          disabled={!!busy || count !== active.length}
                          onClick={() =>
                            void act("/finalize", "POST", choice(o), "finalize")
                          }
                        >
                          สรุปร้านนี้
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
      )}
    </div>
  );
  return (
    <div className="line-page">
      <div className="line-app">
        <ChatHeader count={groupMembers.length} />
        <SimulationNotice />
        <div className="line-room-tools">
          <details>
            <summary>
              <span className="line-small-avatars">
                {groupMembers.slice(0, 4).map((m, i) => (
                  <i key={m.id} className={`color-${i}`}>
                    {m.displayName.slice(0, 1)}
                  </i>
                ))}
              </span>
              <span data-testid="chat-ready">
                พร้อม {ready}/{active.length} คน
              </span>
              <span className="line-room-chevron">⌄</span>
            </summary>
            <div className="line-roster">
              {s.members.map((m, i) => (
                <div key={m.id} className={!m.active ? "line-inactive" : ""}>
                  <span className={`line-person-avatar color-${i % 4}`}>
                    {m.displayName.slice(0, 1)}
                  </span>
                  <strong>
                    {m.displayName}
                    {m.id === s.me?.id ? " (คุณ)" : ""}
                  </strong>
                  <span>
                    {!m.active
                      ? "ออกจากกลุ่ม"
                      : s.meal && !s.meal.selectedMemberIds.includes(m.id)
                        ? "ไม่ได้ร่วมมื้อนี้"
                        : s.meal && !s.meal.joinedMemberIds.includes(m.id)
                          ? "รอเข้าร่วมมื้อ"
                          : m.confirmed
                            ? "ยืนยันแล้ว ✓"
                            : "รอความต้องการ"}
                  </span>
                  {s.isHost &&
                    s.membershipOpen &&
                    m.active &&
                    m.id !== s.me?.id && (
                      <button
                        className="line-text-button"
                        disabled={!!busy}
                        onClick={() =>
                          void act(
                            "",
                            "PATCH",
                            { ...versions(), removeMemberId: m.id },
                            "remove",
                          )
                        }
                      >
                        นำออก
                      </button>
                    )}
                </div>
              ))}
              {s.isHost && !s.meal && (
                <label className="line-mode-label">
                  รูปแบบมื้ออาหาร
                  <select
                    aria-label="รูปแบบมื้ออาหาร"
                    disabled={!!busy || s.status === "finalized"}
                    value={s.mode}
                    onChange={(e) =>
                      void act(
                        "",
                        "PATCH",
                        { ...versions(), mode: e.target.value },
                        "mode",
                      )
                    }
                  >
                    <option value="dine_in">กินที่ร้าน</option>
                    <option value="delivery">เดลิเวอรี</option>
                  </select>
                </label>
              )}
              {s.isHost && data.chat.botJoined && (
                <button
                  className="line-outline"
                  disabled={!!busy}
                  onClick={() => void openMealSetup()}
                >
                  {mealStarted ? "เพิ่มผู้ร่วมมื้อ" : "เริ่มมื้อใหม่"}
                </button>
              )}
              {s.isHost && (!s.membershipOpen || s.status === "finalized") && (
                <button
                  className="line-outline"
                  disabled={!!busy}
                  onClick={() =>
                    void act(
                      "",
                      "PATCH",
                      { ...versions(), action: "reopen" },
                      "reopen",
                    )
                  }
                >
                  เปิดกลุ่มใหม่
                </button>
              )}
              <p>สมาชิกที่ขาดการเชื่อมต่อยังอยู่ในกลุ่ม · ปิดรับสมาชิกหลังจัดอันดับ</p>
            </div>
          </details>
          <button
            className="line-share-button"
            onClick={() => void copy(location.href, "คัดลอกลิงก์กลุ่มแล้ว")}
          >
            แชร์ลิงก์ ↗
          </button>
          <span className="line-version" data-testid="chat-version">
            {s.preferenceVersion}/{s.rosterVersion}
          </span>
        </div>
        {error && (
          <div className="line-error line-error-banner" role="alert">
            <span>{error}</span>
            <button aria-label="ปิดข้อผิดพลาด" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {!connected && (
          <div className="line-offline" role="status">
            การเชื่อมต่อขาดหาย กำลังลองใหม่…
          </div>
        )}
        {copied && (
          <div className="line-copy-toast" role="status">
            {copied}
          </div>
        )}
        <main className="line-transcript" ref={transcript}>
          <div className="line-date">
            วันนี้ · ห้องจำลอง {sessionId.slice(0, 6)}
          </div>
          <div className="line-system">สร้างกลุ่มมื้อนี้กินอะไรดี? · Bangkok demo</div>
          {data.chat.messages.map((message) => {
            if (message.kind === "system")
              return (
                <div key={message.id} className="line-system">
                  {message.text}
                </div>
              );
            if (message.kind === "bot")
              return (
                <div key={message.id}>
                  <BotBubble time={time(message.createdAt)}>
                    <p className="line-message-text">{message.text}</p>
                  </BotBubble>
                  {message.id === rankingMessageId && rankingContent}
                </div>
              );
            const member = s.members.find((m) => m.id === message.memberId);
            const isOwn = message.memberId === s.me?.id;
            return (
              <div
                key={message.id}
                className={`line-message ${isOwn ? "own" : ""}`}
              >
                {!isOwn && (
                  <span className="line-person-avatar">
                    {member?.displayName.slice(0, 1) ?? "?"}
                  </span>
                )}
                <div className="line-message-main">
                  {!isOwn && (
                    <span className="line-sender">
                      {member?.displayName ?? "สมาชิก"}
                    </span>
                  )}
                  <div className="line-bubble">
                    <p className="line-message-text">{message.text}</p>
                  </div>
                </div>
                <time>{time(message.createdAt)}</time>
              </div>
            );
          })}
          {!s.me && (
            <BotBubble>
              <h2>มาร่วมโต๊ะกัน 👋</h2>
              <p>ใส่ชื่อเพื่อเข้าร่วมกลุ่มจำลองนี้ ข้อความที่คุณส่งในกลุ่มจะเห็นร่วมกัน</p>
              {s.membershipOpen && groupMembers.length < 5 ? (
                <form onSubmit={join}>
                  <label htmlFor="line-join-name">ชื่อของคุณ</label>
                  <input
                    id="line-join-name"
                    placeholder="เช่น Nat"
                    maxLength={40}
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                  />
                  <button className="line-primary" disabled={!!busy}>
                    เข้าร่วมกลุ่ม
                  </button>
                </form>
              ) : (
                <p className="line-warning">
                  กลุ่มปิดรับสมาชิกแล้ว ให้เจ้าของกลุ่มเปิดใหม่ก่อน
                </p>
              )}
            </BotBubble>
          )}
          {s.me && !data.chat.botJoined && (
            <BotBubble>
              <div className="line-welcome-brand">✳ CraveLoop</div>
              <h2>ชวนผู้ช่วยเข้าวงสนทนา</h2>
              <p>แชร์ลิงก์ให้เพื่อน แล้วเพิ่ม CraveLoop เพื่อเริ่มรวบรวมความอยากของทุกคน</p>
              <p className="line-subtle">
                เป็นบอตจำลองในเว็บนี้ ไม่มีการเชื่อมต่อ LINE จริง
              </p>
              {s.isHost ? (
                <button
                  className="line-primary"
                  disabled={!!busy}
                  onClick={() => void chat("invite_bot")}
                >
                  เพิ่ม CraveLoop เข้ากลุ่ม ＋
                </button>
              ) : (
                <p className="line-warning">รอเจ้าของกลุ่มเพิ่ม CraveLoop</p>
              )}
            </BotBubble>
          )}
          {s.me &&
            data.chat.botJoined &&
            (!s.meal || s.meal.phase === "setup") && (
              <BotBubble>
                <p className="line-kicker">เริ่มจากตั้งค่ามื้อร่วมกัน</p>
                <h2>กลุ่มพร้อมแล้ว ใครร่วมมื้อนี้บ้าง?</h2>
                <p>
                  เจ้าของกลุ่มเลือกคนจากสมาชิกจริง พร้อมโซนและรูปแบบอาหาร
                  จากนั้นแต่ละคนต้องเข้าร่วมมื้อนี้ด้วยตัวเองก่อนบอกความต้องการ
                </p>
                {s.isHost ? (
                  <button
                    className="line-primary"
                    disabled={!!busy}
                    onClick={() => void openMealSetup()}
                  >
                    เริ่มมื้อใหม่
                  </button>
                ) : (
                  <p className="line-warning">รอเจ้าของกลุ่มเริ่มมื้อใหม่</p>
                )}
              </BotBubble>
            )}
          {s.me && mealStarted && (
            <section
              className="line-meal-status"
              data-testid="meal-participants"
            >
              <div className="line-meal-status-heading">
                <span>🍽</span>
                <div>
                  <p className="line-kicker">
                    มื้อที่กำลังวางแผน ·{" "}
                    {s.mode === "delivery" ? "เดลิเวอรี" : "กินที่ร้าน"}
                  </p>
                  <h2>
                    พร้อม {ready}/{active.length} คน
                  </h2>
                  <p>Bangkok demo · โซนสมมติร่วมกัน</p>
                </div>
              </div>
              <ul>
                {active.map((m) => {
                  const opted = s.meal!.joinedMemberIds.includes(m.id);
                  return (
                    <li key={m.id}>
                      <span>
                        {m.displayName}
                        {m.id === s.me?.id ? " (คุณ)" : ""}
                      </span>
                      <b className={opted && m.confirmed ? "is-ready" : ""}>
                        {!opted
                          ? "รอกดเข้าร่วมมื้อ"
                          : m.confirmed
                            ? "พร้อม ✓"
                            : "รอความต้องการ"}
                      </b>
                    </li>
                  );
                })}
              </ul>
              {!selected ? (
                <p className="line-bystander">
                  คุณไม่ได้ร่วมมื้อนี้ · คุยในกลุ่มได้โดยไม่ถูกนับในมื้ออาหาร
                </p>
              ) : !joined ? (
                <>
                  <p className="line-subtle">
                    คุณได้รับเลือก แต่ยังไม่ได้เข้าร่วม กดด้วยตัวเองก่อนกรอกความต้องการ
                  </p>
                  <button
                    className="line-primary"
                    disabled={!!busy}
                    onClick={() =>
                      void act(
                        "/chat",
                        "POST",
                        { action: "join_meal", ...versions() },
                        "join_meal",
                      )
                    }
                  >
                    เข้าร่วมมื้อนี้
                  </button>
                </>
              ) : s.status !== "finalized" ? (
                <>
                  <p className="line-subtle">
                    {s.me.confirmed
                      ? "คุณยืนยันแล้ว เปลี่ยนได้เฉพาะข้อมูลของตัวเอง"
                      : "คุณเข้าร่วมแล้ว เปิดฟอร์มส่วนตัวเพื่อยืนยันงบและเงื่อนไข"}
                  </p>
                  <button
                    className="line-outline"
                    disabled={!!busy}
                    onClick={openOwnPreferences}
                  >
                    {s.me.confirmed
                      ? "แก้ความต้องการของฉัน"
                      : "กรอกความต้องการของฉัน"}
                  </button>
                </>
              ) : null}
              {s.isHost && (
                <div className="line-meal-manage">
                  <button
                    className="line-text-button"
                    disabled={!!busy}
                    onClick={() => void openMealSetup()}
                  >
                    เพิ่มผู้ร่วมมื้อ
                  </button>
                  <span>แยกจากการแก้ความต้องการส่วนตัว</span>
                </div>
              )}
            </section>
          )}
          {s.me &&
            data.chat.botJoined &&
            canParticipate &&
            !s.ranking &&
            !s.meal && (
              <BotBubble>
                <h2>อยากกินอะไร บอกได้เลย ✨</h2>
                <p>
                  พิมพ์เช่น “อยากกินกรอบ ๆ งบ 180” หรือเปิดฟอร์มส่วนตัว
                  แล้วตรวจและยืนยันก่อนใช้คำนวณ
                </p>
                <p className="line-subtle">ตัวช่วยจับคำแบบกฎ ไม่ใช่ AI</p>
                <button className="line-outline" onClick={openOwnPreferences}>
                  กรอกความต้องการของฉัน
                </button>
              </BotBubble>
            )}
          {!rankingMessageId && rankingContent}
          {final && (
            <BotBubble>
              <div data-testid="chat-final-summary">
                <p className="line-kicker">เอกฉันท์ · CURRENT VERSION</p>
                <h2>สรุปมื้อนี้: {final.restaurantName}</h2>
                <p>สมาชิกทุกคนยอมรับตัวเลือกเดียวกันในผลล่าสุด ไม่มีการสั่งอาหารจริง</p>
                <button
                  className="line-primary"
                  onClick={() => void copy(summary(final), "คัดลอกสรุปมื้อแล้ว")}
                >
                  คัดลอกสรุปมื้อ ↗
                </button>
                <details>
                  <summary>ดูข้อความสรุป</summary>
                  <pre>{summary(final)}</pre>
                </details>
              </div>
            </BotBubble>
          )}
          <div className="line-transcript-bottom" />
        </main>
        <footer className="line-composer-area">
          {s.me && (
            <div className="line-quick-replies">
              {data.chat.botJoined && canParticipate && (
                <>
                  <button
                    disabled={!!busy || s.status === "finalized"}
                    onClick={() => setText("อยากกินกรอบ ๆ งบ 180")}
                  >
                    กรอบ ๆ งบ 180
                  </button>
                  <button
                    disabled={!!busy || s.status === "finalized"}
                    onClick={() => setText("ไม่กินหมู รสอ่อน งบ 160")}
                  >
                    ไม่กินหมู รสอ่อน
                  </button>
                  <button
                    disabled={!!busy || s.status === "finalized"}
                    onClick={() => setText("กินมังสวิรัติ อยากกินเส้น งบ 150")}
                  >
                    มังสวิรัติ + เส้น
                  </button>
                  <button
                    disabled={!!busy || s.status === "finalized"}
                    onClick={() =>
                      setDraft({
                        preference: s.me!.preference ?? emptyPreference,
                        questions: [],
                        source: "rules",
                        recognized: false,
                      })
                    }
                  >
                    แก้ความต้องการ
                  </button>
                  <button
                    disabled={!!busy || s.status === "finalized"}
                    onClick={() => setAiDrawer(true)}
                  >
                    รูป / AI / กรอกเอง
                  </button>
                </>
              )}
              {s.isHost && data.chat.botJoined && (!s.meal || mealStarted) && (
                <button
                  className="line-rank-chip"
                  disabled={!!busy || !mealReady || s.status === "finalized"}
                  onClick={() => void act("/rank", "POST", versions(), "rank")}
                >
                  หาให้หน่อย ✦
                </button>
              )}
            </div>
          )}
          <form
            className="line-composer"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void chat("message");
            }}
          >
            <button
              type="button"
              className="line-composer-add"
              aria-label="เปิดฟอร์มส่วนตัว"
              disabled={
                !canParticipate ||
                !data.chat.botJoined ||
                s.status === "finalized"
              }
              onClick={() => setAiDrawer(true)}
            >
              ＋
            </button>
            <textarea
              aria-label="ข้อความถึงกลุ่ม"
              placeholder={
                !s.me
                  ? "เข้าร่วมกลุ่มเพื่อส่งข้อความ"
                  : !data.chat.botJoined
                    ? "พิมพ์ข้อความคุยกับเพื่อน…"
                    : s.meal?.phase === "setup"
                      ? "คุยในกลุ่มได้ เจ้าของกลุ่มยังไม่ได้เริ่มมื้อ"
                      : !selected
                        ? "ข้อความถึงกลุ่ม · คุณไม่ได้ร่วมมื้อนี้"
                        : !joined
                          ? "เข้าร่วมมื้อนี้ก่อนส่งความต้องการ"
                          : "@CraveLoop วันนี้อยากกินอะไร…"
              }
              maxLength={2000}
              value={text}
              disabled={!s.me || s.status === "finalized"}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  if (text.trim() && !busy) void chat("message");
                }
              }}
            />
            <button
              className="line-send-button"
              aria-label="ส่งข้อความ"
              type="submit"
              disabled={
                !!busy || !text.trim() || !s.me || s.status === "finalized"
              }
            >
              {busy === "message" ? "…" : "➤"}
            </button>
          </form>
          <p className="line-composer-note">
            ข้อความในกลุ่มมองเห็นร่วมกัน · ตัวช่วยจับคำด้วยกฎ ไม่ใช่ AI
          </p>
        </footer>
        {mealSetup && s.isHost && (
          <MealSetup
            session={s}
            onClose={() => setMealSetup(false)}
            onStart={startMeal}
          />
        )}
        {draft && s.me && canParticipate && (
          <ReviewDrawer
            key={`${s.me.id}-${s.me.revision}-${JSON.stringify(draft.preference)}`}
            draft={draft}
            session={s}
            onClose={() => setDraft(null)}
            onError={(e) => void fail(e)}
            onSaved={(next) => {
              generation.current++;
              setData({ ...data, session: next });
              setDraft(null);
              setError("");
              void refresh();
            }}
          />
        )}
        {aiDrawer && s.me && canParticipate && (
          <div
            className="line-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAiDrawer(false);
            }}
          >
            <section
              className="line-drawer line-ai-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="ฟอร์มส่วนตัวและรูปภาพ"
            >
              <div className="line-drawer-header">
                <div>
                  <p className="line-kicker">PRIVATE INPUT</p>
                  <h2>รูปภาพ / ฟอร์มส่วนตัว</h2>
                </div>
                <button
                  className="line-icon-button"
                  aria-label="ปิดฟอร์มส่วนตัว"
                  onClick={() => setAiDrawer(false)}
                >
                  ×
                </button>
              </div>
              <p className="line-subtle">
                {s.ai.available
                  ? "OpenAI เสนอ draft ที่คุณต้องตรวจและยืนยัน"
                  : "การอ่านภาพด้วย AI ยังไม่พร้อม ใช้แบบกรอกเองได้"}
              </p>
              <PreferenceForm
                session={s}
                onError={(e) => void fail(e)}
                onSaved={(next) => {
                  generation.current++;
                  setData({ ...data, session: next });
                  setAiDrawer(false);
                  void refresh();
                }}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
