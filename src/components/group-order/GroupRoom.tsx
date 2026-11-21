"use client";
import FoodPhoto from "./FoodPhoto";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Option, SessionView } from "@/contracts";
import ChatShell from "./ChatShell";
import ChatInvite, { roomInviteUrl } from "./ChatInvite";
import MealChat from "./MealChat";
import { redirect } from "next/navigation";
import RestaurantShop, { ShopFrame } from "./RestaurantShop";
import type { ChatDraft } from "@/contracts/chat";
import { api, requestId, RequestError } from "../api";
import { baht, DeliveryBrand, ConceptNotice, CraveMark } from "./Shared";
import Preferences from "./Preferences";
import ChatPreferences from "./ChatPreferences";
import Configure from "./Configure";
import "./group-order.css";
const reasons: Record<string, string> = {
  INSUFFICIENT_CATALOG_DATA: "ข้อมูลราคา ส่วนผสม หรือหลักฐานใน catalog ไม่ครบ",
  UNAVAILABLE: "ร้านหรือเมนูไม่พร้อมสำหรับเดลิเวอรี",
  CONSTRAINT_NOT_MET: "ยังไม่มีเมนูที่ผ่านเงื่อนไขที่กลุ่มยืนยันครบ",
  BUDGET_EXCEEDED: "ค่าใช้จ่ายเกินงบที่ยืนยัน",
  PRICE_UNKNOWN: "ข้อมูลราคาไม่ครบ",
  INGREDIENTS_UNKNOWN: "ข้อมูลส่วนผสมไม่ครบ",
  EXCLUSION_PRESENT: "มีวัตถุดิบที่ต้องหลีกเลี่ยง",
  DIET_UNVERIFIED: "หลักฐานข้อกำหนดอาหารไม่ครบ",
  CROSS_CONTACT_UNKNOWN: "หลักฐานอาการแพ้และ cross-contact ไม่ครบ",
  CHANNEL_UNAVAILABLE: "ไม่รองรับการจัดส่ง",
  RESTAURANT_UNAVAILABLE: "ร้านไม่พร้อม",
  NO_AVAILABLE_MENU: "ไม่มีเมนูพร้อม",
  UNKNOWN_RESTRICTION: "ยังตรวจสอบข้อจำกัดนี้กับ catalog ไม่ได้",
  FEE_UNKNOWN: "ค่าจัดส่งไม่ทราบ",
};
function errorText(e: unknown) {
  if (e instanceof RequestError) {
    if (e.status === 409) return "ข้อมูลกลุ่มเปลี่ยนแล้ว กรุณาตรวจสถานะล่าสุดและลองอีกครั้ง";
    if (e.status === 401) return "สิทธิ์ของคุณหมดอายุหรือยังไม่ได้เข้าร่วมกลุ่ม";
    if (e.status === 403) return "คุณไม่มีสิทธิ์ทำรายการนี้สำหรับมื้อนี้";
    if (e.status === 429) return "ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่";
    if (e.status === 422)
      return "ข้อมูลหรือเงื่อนไขยังไม่พร้อม ตรวจความพร้อมและค่าใช้จ่ายแล้วลองใหม่";
    if (e.status === 404) return "ไม่พบกลุ่มนี้ ตรวจลิงก์หรือสร้างกลุ่มใหม่";
  }
  return "เชื่อมต่อไม่สำเร็จ เราเก็บข้อมูลที่ยืนยันแล้วไว้ ลองอีกครั้งได้เลย";
}
export default function GroupRoom({
  sessionId,
  shopId,
}: {
  sessionId: string;
  shopId?: string;
}) {
  const [s, setS] = useState<SessionView | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<ChatDraft>();
  const [invite, setInvite] = useState(false);
  useEffect(() => {
    if (location.hash === "#invite") {
      setInvite(true);
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  const [form, setForm] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [connected, setConnected] = useState(true);
  const [copied, setCopied] = useState("");
  const [shareFallback, setShareFallback] = useState(false);
  const generation = useRef(0);
  const joinId = useRef<string | null>(null);
  const base = `/api/sessions/${sessionId}`;
  const initialized = useRef(false);
  const resultsRef = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    const gen = generation.current;
    try {
      const next = await api<SessionView>(base);
      if (gen === generation.current) {
        setS(next);
        initialized.current = true;
      }
      setConnected(true);
      return next;
    } catch (e) {
      setConnected(false);
      if (!initialized.current) setError(errorText(e));
      return null;
    }
  }, [base]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      if (document.visibilityState === "visible") {
        const next = await refresh();
        failures = next ? 0 : Math.min(failures + 1, 3);
      }
      if (!stopped) timer = setTimeout(poll, 2000 * 2 ** failures);
    }
    void poll();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    label: string,
  ) {
    setBusy(label);
    setError("");
    generation.current++;
    try {
      const next = await api<SessionView>(base + path, method, body);
      setS(next);
      return next;
    } catch (e) {
      setError(errorText(e));
      await refresh();
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
  function choice(o: Option) {
    return {
      ...versions(),
      rankingId: s!.ranking!.id,
      restaurantId: o.restaurantId,
    };
  }
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy("join");
    setError("");
    try {
      joinId.current ??= requestId();
      await api(base + "/join", "POST", {
        displayName: name,
        clientJoinId: joinId.current,
      });
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(roomInviteUrl(sessionId));
      setCopied("คัดลอกลิงก์เชิญแล้ว");
      setTimeout(() => setCopied(""), 3000);
    } catch {
      setShareFallback(true);
    }
  }
  async function rank() {
    const next = await mutate("/rank", "POST", versions(), "rank");
    if (next)
      setTimeout(
        () =>
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        50,
      );
  }
  if (shopId && !s)
    return (
      <ShopFrame>
        <div className="chat-empty" role="status">
          {error || "กำลังเปิดหน้าร้าน…"}
          {error && (
            <button className="go-outline" onClick={() => void refresh()}>
              ลองอีกครั้ง
            </button>
          )}
        </div>
      </ShopFrame>
    );
  const groupUrl = `/group/${encodeURIComponent(sessionId)}`;
  // Use the shared decision for redirects after finalize, refresh or a host reopening the meal.
  const chosenShop =
    s?.chatJourney && s.me && s.status === "finalized"
      ? s.finalizedOptionId
      : null;
  if (chosenShop && shopId !== chosenShop)
    redirect(`${groupUrl}/shop/${encodeURIComponent(chosenShop)}`);
  if (shopId && !chosenShop) redirect(groupUrl);
  if (!s)
    return (
      <ChatShell title="Group Order" subtitle="ShopeeFood">
        <div className="chat-empty" role="status">
          {error ? (
            <>
              <p>{error}</p>
              <button className="go-outline" onClick={() => void refresh()}>
                ลองอีกครั้ง
              </button>
            </>
          ) : (
            <p>กำลังเปิดห้อง…</p>
          )}
        </div>
      </ChatShell>
    );
  if (s.experience !== "group_order")
    return (
      <div className="go-page">
        <div className="go-app">
          <header className="go-header">
            <DeliveryBrand />
          </header>
          <ConceptNotice />
          <main className="go-loading">
            <CraveMark />
            <h1>ห้องนี้ใช้ประสบการณ์แบบเดิม</h1>
            <p className="go-muted">
              ข้อมูลห้องเดิมยังอยู่ เปิดผ่านหน้าที่รองรับ หรือสร้าง Group Order ใหม่
            </p>
            <a className="go-outline" href={`/line/${sessionId}`}>
              เปิดห้องแชตจำลองเดิม
            </a>
            <a href={`/s/${sessionId}`}>เปิดห้องเว็บเดิม</a>
            <a href="/">สร้าง Group Order ใหม่</a>
          </main>
        </div>
      </div>
    );
  const group = s.members.filter((m) => m.active);
  const selected = group.filter(
    (m) => !s.meal || s.meal.selectedMemberIds.includes(m.id),
  );
  const joined = (id: string) => !s.meal || s.meal.joinedMemberIds.includes(id);
  const ready = selected.filter((m) => joined(m.id) && m.confirmed).length;
  const mine = !!s.me && selected.some((m) => m.id === s.me!.id);
  const canEdit = mine && joined(s.me!.id) && s.status !== "finalized";
  const allReady = selected.length > 0 && ready === selected.length;
  const final = s.ranking?.options.find(
    (o) => o.restaurantId === s.finalizedOptionId,
  );
  const ownVote = s.acceptances.find((a) => a.memberId === s.me?.id);
  const handoff = s.handoff;
  const currentCart =
    !!handoff &&
    handoff.status !== "invalidated" &&
    s.status === "finalized" &&
    handoff.rankingId === s.ranking?.id &&
    handoff.catalogVersion === s.catalogVersion &&
    handoff.catalogVersion === s.ranking?.catalogVersion &&
    handoff.algorithmVersion === s.ranking?.algorithmVersion &&
    !!handoff.graphVersion &&
    handoff.graphVersion === s.ranking?.graphVersion &&
    handoff.preferenceVersion === s.preferenceVersion &&
    handoff.rosterVersion === s.rosterVersion &&
    handoff.restaurantId === s.finalizedOptionId;
  const cartFinite =
    !!final &&
    final.assignments.every((a) =>
      [a.totalCostSatang, a.itemCostSatang, a.allocatedFeeSatang].every(
        (cost) => Number.isSafeInteger(cost) && Number(cost) >= 0,
      ),
    );
  const stage = currentCart
    ? handoff!.status === "checkout_summary"
      ? 4
      : 3
    : s.status === "finalized"
      ? 2
      : s.ranking
        ? 1
        : 0;
  const joinPanel = (
    <section className="go-card">
      <p className="go-eyebrow">YOU’RE INVITED</p>
      <h2>มีที่ให้คุณในมื้อนี้</h2>
      <p className="go-muted">
        {s.chatJourney
          ? "ใส่ชื่อเพื่อเข้าร่วมมื้อนี้และคุยกับเพื่อนในห้องแชต"
          : "ใส่ชื่อเพื่อเข้ากลุ่ม แล้วเข้าร่วมมื้อนี้และระบุความต้องการของคุณเอง"}
      </p>
      {s.membershipOpen && group.length < 5 ? (
        <form onSubmit={join}>
          <label htmlFor="group-join-name">ชื่อของคุณ</label>
          <input
            id="group-join-name"
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น Nat"
          />
          <button className="go-primary" disabled={!!busy}>
            {busy === "join" ? "กำลังเข้าร่วม…" : "เข้าร่วม Group Order"}
          </button>
        </form>
      ) : (
        <p className="go-info-note">
          กลุ่มปิดรับสมาชิกแล้ว ให้ผู้ดูแลจัดการผู้ร่วมสั่งเพื่อเปิดกลุ่มใหม่ก่อน
        </p>
      )}
    </section>
  );
  const PreferenceDialog = s.chatJourney ? ChatPreferences : Preferences;
  const drawers = (
    <>
      {" "}
      {form && canEdit && (
        <PreferenceDialog
          draft={draft}
          session={s}
          onClose={() => setForm(false)}
          onConflict={() => void refresh()}
          onSaved={(next) => {
            generation.current++;
            setS(next);
            setForm(false);
            setError("");
            setTimeout(
              () =>
                resultsRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                }),
              50,
            );
          }}
        />
      )}
      {configure && s.isHost && (
        <Configure
          session={s}
          onClose={() => setConfigure(false)}
          onSave={async (ids) => {
            const next = await mutate(
              "/meal",
              "POST",
              {
                action: "configure",
                selectedMemberIds: ids,
                areaId: "bangkok_demo",
                ...versions(),
              },
              "configure",
            );
            if (next) {
              setConfigure(false);
              setForm(false);
              return true;
            }
            return false;
          }}
        />
      )}
    </>
  );
  const orderPanels = (
    <>
      {final && !s.chatJourney && (
        <section className="go-card go-handoff">
          <p className="go-eyebrow">GROUP DECISION CONFIRMED</p>
          <h2>ตกลงร้านเดียวกันแล้ว ✓</h2>
          <p className="go-muted">
            {final.restaurantName} · สมาชิกทุกคนยอมรับผลล่าสุด การตกลงนี้ไม่ใช่คำสั่งซื้อ
          </p>
          {s.isHost && !currentCart && (
            <button
              className="go-primary"
              disabled={!!busy || !cartFinite}
              onClick={() =>
                void mutate("/handoff", "POST", choice(final), "handoff")
              }
            >
              {busy === "handoff" ? "กำลังเตรียมตะกร้า…" : "ส่งต่อไปยังตะกร้าจำลอง"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          )}
          {!cartFinite && (
            <p className="go-info-note">
              ยังมีค่าใช้จ่ายที่ไม่ทราบ ไม่สามารถเตรียมตะกร้าโดยประมาณราคาได้
            </p>
          )}
          {!s.isHost && !currentCart && (
            <p className="go-fine">รอผู้ดูแลส่งต่อการตัดสินใจไปยังตะกร้าจำลอง</p>
          )}
        </section>
      )}
      {handoff && (
        <section
          className={`go-card go-cart ${!currentCart ? "go-cart-invalid" : ""}`}
          data-testid="group-cart"
        >
          <div className="go-section-heading">
            <div>
              <p className="go-eyebrow">
                {currentCart ? "GROUP CART · SIMULATED" : "CART INVALIDATED"}
              </p>
              <h2>{currentCart ? "ตะกร้าร่วมของกลุ่ม" : "ตะกร้าเดิมใช้ไม่ได้แล้ว"}</h2>
            </div>
            <span className="go-cart-symbol">▱</span>
          </div>
          <p className="go-muted">{handoff.restaurantName}</p>
          {!currentCart ? (
            <p className="go-info-note">
              ข้อมูลกลุ่มหรือผลการตัดสินใจเปลี่ยนแล้ว ต้องตกลงผลล่าสุดและเตรียมตะกร้าใหม่ ปุ่ม
              Checkout ถูกปิดไว้
            </p>
          ) : (
            <>
              <div className="go-cart-items">
                {handoff.items.map((item) => (
                  <div key={item.memberId}>
                    <span>
                      <strong>{item.displayName}</strong>
                      <span>
                        {item.quantity} × {item.menuName}
                      </span>
                      <small>
                        อาหาร {baht(item.itemCostSatang)} + ค่าจัดส่ง/บริการ{" "}
                        {baht(item.allocatedFeeSatang)}
                      </small>
                    </span>
                    <b>{baht(item.totalCostSatang)}</b>
                  </div>
                ))}
              </div>
              <div className="go-cart-totals">
                <p>
                  <span>รวมราคาอาหาร</span>
                  <b>{baht(handoff.subtotalSatang)}</b>
                </p>
                <p>
                  <span>ค่าจัดส่งและบริการ (สมมติ)</span>
                  <b>{baht(handoff.allocatedFeesSatang)}</b>
                </p>
                <p className="go-grand-total">
                  <span>รวมทั้งกลุ่ม</span>
                  <b>{baht(handoff.totalSatang)}</b>
                </p>
              </div>
              <p className="go-fine">
                ข้อมูลตะกร้าจาก snapshot ที่ทุกคนยอมรับ ไม่ใช่ตะกร้าในแอป ShopeeFood จริง
              </p>
              {s.isHost && handoff.status === "cart" && final && (
                <button
                  className="go-primary"
                  disabled={!!busy}
                  onClick={() =>
                    void mutate(
                      "/checkout",
                      "POST",
                      { ...choice(final), handoffId: handoff.id },
                      "checkout",
                    )
                  }
                >
                  {busy === "checkout"
                    ? "กำลังเตรียมสรุป…"
                    : "ดูสรุป Checkout จำลอง"}
                </button>
              )}
            </>
          )}
        </section>
      )}
      {currentCart && handoff?.status === "checkout_summary" && (
        <section className="go-checkout" data-testid="group-checkout">
          <span>✓</span>
          <p className="go-eyebrow">SIMULATED CHECKOUT SUMMARY</p>
          <h2>
            มื้อนี้พร้อมไปต่อ
            <br />
            ในแนวคิด Group Order
          </h2>
          <p>
            สรุป {handoff.items.length} เมนู · รวม {baht(handoff.totalSatang)}
          </p>
          <strong>ยังไม่ได้สร้างคำสั่งซื้อหรือชำระเงิน</strong>
          <p className="go-fine">
            ไม่มีเลขคำสั่งซื้อ ไม่มีการส่งข้อมูลไป ShopeeFood และไม่มีการตัดเงิน
            หน้านี้สาธิตการส่งต่อจากการตัดสินใจร่วมกันเท่านั้น
          </p>
        </section>
      )}
    </>
  );
  if (shopId && final && s.me) {
    return (
      <RestaurantShop
        session={s}
        restaurant={final}
        busy={!!busy}
        onSelect={(menuId) =>
          void mutate("/dish", "PUT", { ...choice(final), menuId }, "dish")
        }
        onBasket={() =>
          void mutate("/handoff", "POST", choice(final), "handoff")
        }
        onManage={() => setConfigure(true)}
        basket={currentCart ? orderPanels : undefined}
        notice={
          <>
            {!connected && (
              <p className="chat-notice" role="status">
                กำลังเชื่อมต่ออีกครั้ง…
              </p>
            )}
            {error && (
              <p className="chat-notice" role="alert">
                {error}
              </p>
            )}
          </>
        }
      >
        {drawers}
      </RestaurantShop>
    );
  }
  if (s.chatJourney) {
    const title = `มื้อของ ${s.members[0]?.displayName ?? "กลุ่ม"}`;
    return (
      <ChatShell
        title={title}
        subtitle={`Group Order · ${group.length} คน`}
        onMembers={s.me ? () => setMembersOpen((v) => !v) : undefined}
        onInvite={s.me ? () => setInvite(true) : undefined}
      >
        {membersOpen && (
          <section className="chat-roster" aria-label="สมาชิกในมื้อนี้">
            <div>
              <strong>ผู้ร่วมมื้อ</strong>
              <button onClick={() => setMembersOpen(false)}>ปิด</button>
            </div>
            {group.map((m) => (
              <p key={m.id}>
                {m.displayName}
                <small>
                  {!selected.some((p) => p.id === m.id)
                    ? "ไม่ได้ร่วมมื้อ"
                    : m.confirmed
                      ? "พร้อมแล้ว"
                      : "ยังไม่ยืนยัน"}
                </small>
              </p>
            ))}
            {s.isHost && (
              <button
                onClick={() => {
                  setMembersOpen(false);
                  setConfigure(true);
                }}
              >
                จัดการผู้ร่วมสั่ง
              </button>
            )}
          </section>
        )}
        {!connected && (
          <p className="chat-notice" role="status">
            กำลังเชื่อมต่ออีกครั้ง…
          </p>
        )}
        {error && (
          <p className="chat-notice" role="alert">
            {error}
          </p>
        )}
        {!s.me ? (
          <main className="chat-order">{joinPanel}</main>
        ) : (
          <MealChat
            session={s}
            onSent={(r) => {
              generation.current++;
              setS(r.session);
              if (r.draft) {
                setDraft(r.draft);
                setForm(true);
              }
            }}
            tools={
              <div className="chat-tools">
                {canEdit && (
                  <button
                    onClick={() => {
                      setDraft(undefined);
                      setForm(true);
                    }}
                  >
                    {s.me.confirmed
                      ? "แก้ความต้องการของฉัน"
                      : "กรอกความต้องการของฉัน"}
                  </button>
                )}
                {mine && !joined(s.me.id) && (
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      void mutate(
                        "/meal",
                        "POST",
                        { action: "join", ...versions() },
                        "joinMeal",
                      )
                    }
                  >
                    เข้าร่วมมื้อนี้
                  </button>
                )}
                {!mine && <small>ขอผู้จัดเพิ่มชื่อเพื่อร่วมมื้อนี้</small>}
                <small role="status">
                  ยืนยันแล้ว {ready}/{selected.length} คน
                </small>
                {s.isHost &&
                  ready > 0 &&
                  !allReady &&
                  !s.preliminaryRestaurants && (
                    <button
                      className="chat-accent"
                      disabled={!!busy}
                      onClick={() =>
                        void mutate(
                          "/rank",
                          "POST",
                          { ...versions(), confirmedOnly: true },
                          "rank",
                        )
                      }
                    >
                      ค้นหาจากคนที่ยืนยันแล้ว
                    </button>
                  )}
                {s.preliminaryRestaurants && (
                  <section aria-label="ผลค้นหาเบื้องต้น">
                    <strong>ผลเบื้องต้นจาก {ready} คน</strong>
                    {s.preliminaryRestaurants.length ? (
                      <ul>
                        {s.preliminaryRestaurants.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    ) : (
                      <div>ยังไม่มีร้านที่ตรงเงื่อนไข</div>
                    )}
                    <small>เมื่อทุกคนยืนยัน เราจะค้นหาอีกครั้งให้ทั้งกลุ่ม</small>
                  </section>
                )}
                {allReady && !s.ranking && s.isHost ? (
                  <button
                    className="chat-accent"
                    disabled={!!busy}
                    onClick={() => void rank()}
                  >
                    ค้นหาร้านสำหรับกลุ่ม
                  </button>
                ) : s.ranking ? (
                  <button
                    onClick={() =>
                      resultsRef.current?.scrollIntoView({ block: "nearest" })
                    }
                  >
                    ดูผลเลือกร้าน
                  </button>
                ) : null}
              </div>
            }
            actions={
              s.ranking && (
                <section
                  className="chat-results"
                  ref={resultsRef}
                  aria-label="ร้านที่ CraveLoop แนะนำ"
                >
                  <h2>
                    {s.ranking.options.length
                      ? "เลือกร้านสำหรับมื้อนี้"
                      : "ยังไม่มีร้านที่ตรงเงื่อนไข"}
                  </h2>
                  {!s.ranking.options.length && (
                    <p>ตรวจงบและความต้องการของคุณอีกครั้งได้ที่ปุ่มด้านล่าง</p>
                  )}
                  {s.ingredientProofs?.length ? (
                    <details>
                      <summary>เหตุผลที่บางเมนูไม่ผ่านเงื่อนไขของฉัน</summary>
                      <ul>
                        {s.ingredientProofs.map((proof) => (
                          <li key={proof}>{proof}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {s.ranking.options.map((o) => {
                    const votes = s.acceptances.filter(
                      (a) =>
                        a.rankingId === s.ranking!.id &&
                        a.restaurantId === o.restaurantId,
                    ).length;
                    const accepted =
                      ownVote?.rankingId === s.ranking!.id &&
                      ownVote.restaurantId === o.restaurantId;
                    return (
                      <article key={o.restaurantId}>
                        {o.assignments[0] && (
                          <div className="go-option-illustration">
                            <FoodPhoto
                              menuId={o.assignments[0].menuId}
                              menuName={o.assignments[0].menuName}
                            />
                          </div>
                        )}
                        <h3>{o.restaurantName}</h3>
                        <p>
                          รวมกลุ่ม {baht(o.totalGroupCostSatang)} · ยอมรับ {votes}/
                          {selected.length} คน
                        </p>
                        <details>
                          <summary>ดูเมนูและยอดต่อคน</summary>
                          {o.assignments.map((a) => (
                            <p key={a.memberId}>
                              <b>
                                {
                                  s.members.find((m) => m.id === a.memberId)
                                    ?.displayName
                                }
                              </b>{" "}
                              · {a.menuName} · {baht(a.totalCostSatang)}
                            </p>
                          ))}
                        </details>
                        <div>
                          {canEdit && (
                            <button
                              disabled={!!busy}
                              onClick={() =>
                                void mutate(
                                  "/acceptance/me",
                                  accepted ? "DELETE" : "PUT",
                                  choice(o),
                                  "accept",
                                )
                              }
                            >
                              {accepted ? "ถอนเสียง" : "ยอมรับร้านนี้"}
                            </button>
                          )}
                          {s.isHost && (
                            <button
                              className="chat-accent"
                              disabled={!!busy || votes !== selected.length}
                              onClick={() =>
                                void mutate(
                                  "/finalize",
                                  "POST",
                                  choice(o),
                                  "finalize",
                                )
                              }
                            >
                              สรุปร้านนี้
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </section>
              )
            }
          />
        )}
        {invite && s.me && (
          <ChatInvite
            sessionId={sessionId}
            onContinue={() => setInvite(false)}
          />
        )}
        {drawers}
      </ChatShell>
    );
  }
  return (
    <div className="go-page">
      <div className="go-app">
        <header className="go-header">
          <DeliveryBrand />
          <span className="go-header-demo">GROUP ORDER</span>
        </header>
        <ConceptNotice />
        <main className="go-room-main">
          <div className="go-room-title">
            <div>
              <p className="go-eyebrow">DELIVERY · BANGKOK DEMO</p>
              <h1>มื้อนี้ สั่งด้วยกัน</h1>
              <p>เลือกเมนูที่ผ่านเงื่อนไขของทุกคนก่อนรวมตะกร้า</p>
            </div>
            <span className="go-order-icon">♧</span>
          </div>
          <div className="go-progress" aria-label="ขั้นตอน Group Order">
            {["ความต้องการ", "เลือกร้าน", "ตกลงร่วมกัน", "ตะกร้า", "Checkout"].map(
              (label, i) => (
                <div key={label} className={stage >= i ? "active" : ""}>
                  <span>{stage > i ? "✓" : i + 1}</span>
                  <small>{label}</small>
                </div>
              ),
            )}
          </div>
          <div className="go-room-meta">
            <span>
              กลุ่ม {sessionId.slice(0, 6)} · {group.length}/5 คน
            </span>
            <span data-testid="group-version">
              {s.preferenceVersion}/{s.rosterVersion}
            </span>
          </div>
          {!connected && (
            <p className="go-info-note" role="status">
              การเชื่อมต่อขาดหาย แสดงข้อมูลที่บันทึกล่าสุด กำลังเชื่อมต่อใหม่…
            </p>
          )}
          {error && (
            <div className="go-error go-error-row" role="alert">
              <span>{error}</span>
              <button aria-label="ปิดข้อผิดพลาด" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {copied && (
            <p className="go-copy-toast" role="status">
              {copied}
            </p>
          )}
          <section className="go-share-card">
            <span className="go-share-icon">↗</span>
            <div>
              <strong>ชวนเพื่อนมาร่วมสั่ง</strong>
              <p>แชร์ลิงก์ให้เปิดคนละเบราว์เซอร์ ไม่ต้องสมัครสมาชิก</p>
            </div>
            <button onClick={() => void share()} className="go-small-button">
              แชร์ลิงก์
            </button>
            {shareFallback && (
              <label className="go-share-fallback">
                ลิงก์เชิญ
                <input
                  aria-label="ลิงก์เชิญ"
                  readOnly
                  value={
                    typeof location === "undefined"
                      ? ""
                      : roomInviteUrl(sessionId)
                  }
                  onFocus={(e) => e.target.select()}
                />
                <small>เลือกข้อความแล้วคัดลอกด้วยตัวเอง</small>
              </label>
            )}
          </section>
          <div className="go-room-grid">
            <div className="go-room-side">
              <section className="go-card go-people">
                <div className="go-section-heading">
                  <div>
                    <p className="go-eyebrow">THE GROUP</p>
                    <h2>
                      พร้อม {ready}/{selected.length} คน
                    </h2>
                  </div>
                  <span className="go-people-icon">♧</span>
                </div>
                <div className="go-ready-track">
                  <span
                    style={{
                      width: `${selected.length ? (ready / selected.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <ul>
                  {group.map((m, i) => {
                    const included = selected.some((p) => p.id === m.id);
                    return (
                      <li key={m.id}>
                        <span className={`go-avatar tone-${i % 4}`}>
                          {m.displayName.slice(0, 1)}
                        </span>
                        <div>
                          <strong>
                            {m.displayName}
                            {m.id === s.me?.id ? " (คุณ)" : ""}
                          </strong>
                          <small>
                            {!included
                              ? "ไม่ได้ร่วมมื้อนี้"
                              : !joined(m.id)
                                ? "รอกดเข้าร่วมมื้อ"
                                : m.confirmed
                                  ? "ยืนยันแล้ว ✓"
                                  : "รอความต้องการ"}
                          </small>
                        </div>
                        <span
                          className={`go-ready-dot ${included && joined(m.id) && m.confirmed ? "yes" : ""}`}
                        />
                      </li>
                    );
                  })}
                </ul>
                <p className="go-fine">
                  ผู้ร่วมที่ยังไม่ตอบยังถูกนับครบ ไม่มีการตัดใครออกอัตโนมัติ
                  เริ่มได้เมื่อผู้ที่เลือกพร้อมทุกคน
                </p>
                {s.isHost && (
                  <button
                    className="go-text-button"
                    disabled={!!busy}
                    onClick={() => setConfigure(true)}
                  >
                    จัดการผู้ร่วมสั่ง
                  </button>
                )}
              </section>
              {s.isHost && (
                <section className="go-card go-host-tools">
                  <div className="go-crave-inline">
                    <CraveMark />
                    <div>
                      <strong>CraveLoop</strong>
                      <small>จับคู่จากเงื่อนไขที่ยืนยัน</small>
                    </div>
                  </div>
                  <p>มีร้านที่ใช่ เมื่อทุกคนมีเมนูที่กินได้และอยู่ในงบของตัวเอง</p>
                  <button
                    className="go-primary"
                    disabled={!!busy || !allReady || s.status === "finalized"}
                    onClick={() => void rank()}
                  >
                    {busy === "rank" ? "กำลังคำนวณ…" : "ค้นหาร้านสำหรับกลุ่ม"}{" "}
                    <span aria-hidden="true">✦</span>
                  </button>
                  {!allReady && (
                    <p className="go-fine">รอให้ผู้ร่วมที่เลือกกดเข้าร่วมและยืนยันครบ</p>
                  )}
                </section>
              )}
            </div>
            <div className="go-room-content">
              {!s.me ? (
                joinPanel
              ) : !mine ? (
                <section className="go-card go-personal-card">
                  <h2>คุณไม่ได้ร่วมมื้อนี้</h2>
                  <p className="go-muted">
                    คุณดูความคืบหน้าได้ แต่ไม่ถูกนับในคะแนนหรือเสียงยอมรับ ขอให้ผู้ดูแลเพิ่มคุณผ่าน
                    “จัดการผู้ร่วมสั่ง”
                  </p>
                </section>
              ) : !joined(s.me.id) ? (
                <section className="go-card go-personal-card">
                  <p className="go-eyebrow">YOUR SEAT IS WAITING</p>
                  <h2>{s.me.displayName} พร้อมสั่งด้วยกันไหม?</h2>
                  <p className="go-muted">
                    ผู้ดูแลเลือกคุณไว้แล้ว
                    แต่คุณต้องเข้าร่วมมื้อนี้ด้วยตัวเองก่อนกรอกงบและความต้องการ
                  </p>
                  <button
                    className="go-primary"
                    disabled={!!busy}
                    onClick={() =>
                      void mutate(
                        "/meal",
                        "POST",
                        { action: "join", ...versions() },
                        "optin",
                      )
                    }
                  >
                    เข้าร่วมมื้อนี้ <span aria-hidden="true">→</span>
                  </button>
                </section>
              ) : (
                <section className="go-card go-personal-card">
                  <div className="go-personal-header">
                    <span
                      className={
                        s.me.confirmed ? "go-check-circle" : "go-wait-circle"
                      }
                    >
                      {s.me.confirmed ? "✓" : "✎"}
                    </span>
                    <div>
                      <p className="go-eyebrow">ONLY YOU CAN CONFIRM</p>
                      <h2>
                        {s.me.confirmed
                          ? "ความต้องการของคุณพร้อมแล้ว"
                          : "บอกมื้อที่คุณอยากกิน"}
                      </h2>
                    </div>
                  </div>
                  <p className="go-muted">
                    {s.me.confirmed
                      ? `งบ ${s.me.preference?.budgetMaxSatang === null ? "ไม่จำกัด" : baht(s.me.preference?.budgetMaxSatang ?? null)} รวมส่วนแบ่งค่าจัดส่งแล้ว · ฟอร์มส่วนตัวของคุณ`
                      : "ระบุงบ ความอยาก และข้อจำกัด ตรวจแล้วกดยืนยันด้วยตัวเอง"}
                  </p>
                  <button
                    className="go-outline"
                    disabled={!!busy || !canEdit}
                    onClick={() => {
                      setDraft(undefined);
                      setForm(true);
                    }}
                  >
                    {s.me.confirmed
                      ? "แก้ความต้องการของฉัน"
                      : "กรอกความต้องการของฉัน"}
                  </button>
                  {!!s.ingredientProofs?.length && (
                    <details className="go-advanced">
                      <summary>ทำไมบางเมนูจึงถูกตัดออกสำหรับฉัน</summary>
                      <p className="go-fine">
                        หลักฐานสูตรและฉลากจำลอง · {s.ranking?.graphVersion}
                      </p>
                      <ul>
                        {s.ingredientProofs.map((proof) => (
                          <li key={proof}>{proof}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {s.status === "finalized" && (
                    <p className="go-fine">
                      ตกลงร้านแล้ว
                      หากต้องการแก้ไขให้ผู้ดูแลเปิดการตัดสินใจใหม่ผ่านจัดการผู้ร่วมสั่ง
                    </p>
                  )}
                </section>
              )}
              {s.ranking ? (
                <section className="go-results" ref={resultsRef}>
                  <div className="go-results-title">
                    <div>
                      <p className="go-eyebrow">CURATED FOR YOUR GROUP</p>
                      <h2>
                        {s.ranking.status === "no_match"
                          ? "ลองปรับมื้อนี้ด้วยกัน"
                          : "ตัวเลือกที่ลงตัวทั้งกลุ่ม"}
                      </h2>
                    </div>
                    <span>{s.ranking.options.length} ร้าน</span>
                  </div>
                  <div
                    className="go-calculation"
                    role="status"
                    data-testid="group-update"
                  >
                    <strong>
                      ✓ คำนวณจากข้อมูลที่ยืนยันล่าสุด · v{s.ranking.preferenceVersion}
                    </strong>
                    <p>
                      อัปเดต{" "}
                      {new Intl.DateTimeFormat("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Bangkok",
                      }).format(new Date(s.ranking.createdAt))}{" "}
                      น. · เวลา Bangkok
                    </p>
                    <p>
                      ความชอบกลุ่ม = 60% คะแนนเฉลี่ย + 40% คะแนนคนที่ต่ำสุด เป็นสูตรสาธิต
                      ไม่ใช่การวัดความสุข
                    </p>
                    {s.ranking.update?.outcome === "unchanged" && (
                      <p>
                        ผลคำนวณใหม่ ร้าน เมนู ราคา และคะแนนยังเหมือนเดิมใน catalog ชุดนี้
                        เสียงยอมรับเก่าถูกล้างแล้ว
                      </p>
                    )}
                  </div>
                  {s.ranking.status === "no_match" ? (
                    <div
                      className="go-card go-no-match"
                      data-testid="group-no-match"
                    >
                      <span>⌕</span>
                      <h3>ไม่พบร้านที่ตรงเงื่อนไขทุกคน</h3>
                      <p>
                        เราไม่ผ่อนข้อจำกัดลับ ๆ ลองแก้ความต้องการของคุณ
                        หรือให้ผู้ดูแลปรับผู้ร่วมมื้ออย่างชัดเจน
                      </p>
                      <ul>
                        {[
                          ...new Set(s.ranking.rejections.map((r) => r.code)),
                        ].map((code) => (
                          <li key={code}>
                            {reasons[code] ?? "ข้อมูลหรือเงื่อนไขไม่ครบสำหรับกลุ่ม"}
                          </li>
                        ))}
                      </ul>
                      <p className="go-fine">
                        แสดงเหตุผลรวมของกลุ่ม ไม่เปิดเผยข้อจำกัดรายบุคคล
                      </p>
                    </div>
                  ) : (
                    s.ranking.options
                      .filter(
                        (o) => !final || o.restaurantId === final.restaurantId,
                      )
                      .map((o, index) => {
                        const votes = s.acceptances.filter(
                          (a) =>
                            a.rankingId === s.ranking!.id &&
                            a.restaurantId === o.restaurantId,
                        ).length;
                        const accepted =
                          ownVote?.rankingId === s.ranking!.id &&
                          ownVote.restaurantId === o.restaurantId;
                        return (
                          <article
                            className={`go-option ${index === 0 ? "go-top-option" : ""}`}
                            key={o.restaurantId}
                            data-testid={`group-option-${o.restaurantId}`}
                          >
                            <div className="go-option-banner">
                              <span>
                                {final
                                  ? "✓ ตกลงร่วมกัน"
                                  : index === 0
                                    ? "✦ GROUP FAVORITE"
                                    : `ตัวเลือก ${index + 1}`}
                              </span>
                              <span>CATALOG จำลอง</span>
                            </div>
                            <div className="go-option-top">
                              <div
                                className="go-option-illustration"
                                aria-hidden="true"
                              >
                                {o.assignments[0] && <FoodPhoto menuId={o.assignments[0].menuId} menuName={o.assignments[0].menuName} />}
                              </div>
                              <div className="go-option-name">
                                <small>{o.restaurantId} · ภาพอาหารตัวอย่าง</small>
                                <h3>{o.restaurantName}</h3>
                                <p>
                                  เมนูที่ผ่านเงื่อนไขครบ {o.assignments.length} คน
                                </p>
                              </div>
                              <div className="go-score">
                                <strong>{o.groupScore.toFixed(1)}</strong>
                                <small>GROUP FIT</small>
                              </div>
                            </div>
                            <div className="go-score-row">
                              <span>
                                เฉลี่ย <b>{o.meanScore.toFixed(1)}</b>
                              </span>
                              <span>
                                ต่ำสุด <b>{o.minimumScore.toFixed(1)}</b>
                              </span>
                              <span>
                                รวมกลุ่ม <b>{baht(o.totalGroupCostSatang)}</b>
                              </span>
                            </div>
                            <div className="go-assigned-meals">
                              {o.assignments.map((a) => (
                                <div className="go-meal" key={a.memberId}>
                                  <div>
                                    <strong>
                                      {
                                        s.members.find(
                                          (m) => m.id === a.memberId,
                                        )?.displayName
                                      }
                                      {a.memberId === s.me?.id ? " · คุณ" : ""}
                                    </strong>
                                    <small>fit {a.fitScore.toFixed(1)}</small>
                                  </div>
                                  <p>
                                    <span>{a.menuName}</span>
                                    <b>{baht(a.totalCostSatang)}</b>
                                  </p>
                                  <small>
                                    อาหาร {baht(a.itemCostSatang)} +
                                    ค่าจัดส่ง/บริการ {baht(a.allocatedFeeSatang)}{" "}
                                    <code>{a.menuId}</code>
                                  </small>
                                </div>
                              ))}
                            </div>
                            <div className="go-option-footer">
                              <div className="go-votes">
                                <span>
                                  {selected.map((m) => (
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
                                  ยอมรับ {votes}/{selected.length} คน
                                </b>
                              </div>
                              {s.status !== "finalized" && (
                                <div className="go-option-actions">
                                  {canEdit && (
                                    <button
                                      className={
                                        accepted ? "go-accepted" : "go-primary"
                                      }
                                      disabled={!!busy}
                                      onClick={() =>
                                        void mutate(
                                          "/acceptance/me",
                                          accepted ? "DELETE" : "PUT",
                                          choice(o),
                                          "accept",
                                        )
                                      }
                                    >
                                      {accepted
                                        ? "✓ ยอมรับแล้ว · ถอนเสียง"
                                        : "ยอมรับร้านนี้"}
                                    </button>
                                  )}
                                  {s.isHost && (
                                    <button
                                      className="go-outline"
                                      disabled={
                                        !!busy ||
                                        votes !== selected.length ||
                                        !selected.length
                                      }
                                      onClick={() =>
                                        void mutate(
                                          "/finalize",
                                          "POST",
                                          choice(o),
                                          "finalize",
                                        )
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
                </section>
              ) : (
                <section className="go-waiting">
                  <CraveMark />
                  <h2>มื้อที่ดี เริ่มจากทุกคน</h2>
                  <p>
                    เมื่อผู้ร่วมที่เลือกเข้าร่วมและยืนยันครบ ผู้ดูแลจะค้นหาได้สูงสุด 3
                    ร้านที่มีเมนูผ่านเงื่อนไขให้ทุกคน
                  </p>
                  <span>
                    {s.ai.available
                      ? "กรอกเองหรือขอร่างจาก AI ในฟอร์มส่วนตัว"
                      : "Manual mode · ไม่มีการเรียก AI หรือบริการสด"}
                  </span>
                </section>
              )}
              {orderPanels}
            </div>
          </div>
          <footer className="go-room-footer">
            CraveLoop · ShopeeFood integration concept · เว็บแนวคิดอิสระ
            <br />
            ข้อมูลจำลองทั้งหมด · ไม่มีการสั่งอาหารจริง
          </footer>
        </main>
        {drawers}
      </div>
    </div>
  );
}
