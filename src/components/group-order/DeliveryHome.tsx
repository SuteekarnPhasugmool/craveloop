"use client";
import { useRouter } from "next/navigation";
import ChatInvite from "./ChatInvite";
import "./chat-room.css";
import { useMemo, useRef, useState } from "react";
import { api } from "@/components/api";
import { CraveMark, baht } from "./Shared";
import type { HomeCatalogItem } from "./home-catalog";
import { HomeIcon } from "./HomeIcons";
import FoodPhoto from "./FoodPhoto";
import "./group-order.css";
import "./delivery-home.css";
type Filter =
  | "all"
  | "budget"
  | "vegetarian"
  | "thai"
  | "japanese"
  | "spicy"
  | "mild"
  | "crispy";
const filterNames: Record<Filter, string> = {
  all: "เมนูทั้งหมด",
  budget: "อาหารไม่เกิน 100 บาท",
  vegetarian: "เมนูมังสวิรัติ",
  thai: "อาหารไทย",
  japanese: "อาหารญี่ปุ่น",
  spicy: "รสเผ็ด",
  mild: "รสอ่อน",
  crispy: "เมนูกรอบ",
};
const tagWords: Record<string, string> = {
  thai: "ไทย",
  japanese: "ญี่ปุ่น",
  chinese: "จีน",
  korean: "เกาหลี",
  western: "ตะวันตก",
  indian: "อินเดีย",
  spicy: "เผ็ด",
  mild: "รสอ่อน",
  savory: "กลมกล่อม",
  sweet: "หวาน",
  sour: "เปรี้ยว",
  crispy: "กรอบ",
  brothy: "ซุป เส้น",
  grilled: "ย่าง",
  creamy: "ครีม",
  fresh: "สด",
  chewy: "เส้น หนึบ",
  vegetarian: "มังสวิรัติ",
};
export default function DeliveryHome({
  catalog,
}: {
  catalog: HomeCatalogItem[];
}) {
  const router = useRouter();
  const [createdRoom, setCreatedRoom] = useState<string>();
  const [chatJourney, setChatJourney] = useState(false);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<"home" | "catalog">("home");
  const [overlay, setOverlay] = useState<"zone" | "cart" | "about" | null>(
    null,
  );
  const [detail, setDetail] = useState<HomeCatalogItem | null>(null);
  const [groupLink, setGroupLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const [lastGroup, setLastGroup] = useState<string | null>(null);
  const [zoneSaved, setZoneSaved] = useState(false);
  const catalogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ sessionId: string }>("/api/sessions", "POST", {
        hostName: name,
        areaId: "bangkok_demo",
        mode: "delivery",
        expectedSize: 4,
        experience: "group_order",
        ...(chatJourney ? { chatJourney: true } : {}),
      });
      try {
        localStorage.setItem("craveloop:last-group", r.sessionId);
      } catch {}
      if (chatJourney) {
        setCreatedRoom(r.sessionId);
        setStep(0);
        setBusy(false);
        setChatJourney(false);
      } else router.push(`/group/${r.sessionId}`);
    } catch {
      setError("สร้างกลุ่มไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง");
      setBusy(false);
    }
  }
  function browse(next: Filter = "all") {
    setFilter(next);
    setQuery("");
    setTab("catalog");
    setTimeout(
      () =>
        catalogRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      30,
    );
  }
  function openCart() {
    setOverlay("cart");
    setLinkError("");
    try {
      setLastGroup(localStorage.getItem("craveloop:last-group"));
    } catch {
      setLastGroup(null);
    }
  }
  function openGroup(e: React.FormEvent) {
    e.preventDefault();
    const match = groupLink
      .trim()
      .match(
        /(?:\/group\/)?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:[/?#].*)?$/i,
      );
    if (!match) {
      setLinkError("ใส่ลิงก์ Group Order หรือรหัสกลุ่มที่ถูกต้อง");
      return;
    }
    router.push(`/group/${match[1]}`);
  }
  const filtered = useMemo(
    () =>
      catalog.filter((item) => {
        const tags = [
          ...item.cuisineTags,
          ...item.flavorTags,
          ...item.textureTags,
          ...item.dietaryTags,
        ];
        const haystack = [
          item.restaurantName,
          item.menuName,
          item.categoryTh,
          ...tags,
          ...tags.map((t) => tagWords[t] ?? ""),
        ]
          .join(" ")
          .toLowerCase();
        const keyword =
          !query.trim() || haystack.includes(query.trim().toLowerCase());
        const category =
          filter === "all" ||
          (filter === "budget" && item.priceSatang <= 10000) ||
          (filter === "vegetarian" &&
            item.dietaryTags.includes("vegetarian")) ||
          (["thai", "japanese"].includes(filter) &&
            item.cuisineTags.includes(filter)) ||
          (["spicy", "mild"].includes(filter) &&
            item.flavorTags.includes(filter)) ||
          (filter === "crispy" && item.textureTags.includes("crispy"));
        return keyword && category;
      }),
    [catalog, query, filter],
  );
  const showResults = tab === "catalog" || !!query.trim() || filter !== "all";
  const featured = catalog
    .filter(
      (item, i, all) =>
        all.findIndex((other) => other.restaurantId === item.restaurantId) ===
        i,
    )
    .slice(0, 8);
  const shortcuts: {
    label: string;
    icon: string;
    tone: string;
    action: () => void;
    aria?: string;
    badge?: string;
  }[] = [
    {
      label: "Group Order",
      icon: "people",
      tone: "orange",
      action: () => setStep(1),
      aria: "เริ่ม Group Order",
      badge: "ใหม่",
    },
    {
      label: "อาหารไทย",
      icon: "rice",
      tone: "gold",
      action: () => browse("thai"),
    },
    {
      label: "เมนูไม่เกิน 100",
      icon: "budget",
      tone: "green",
      action: () => browse("budget"),
    },
    {
      label: "รสอ่อน",
      icon: "mild",
      tone: "blue",
      action: () => browse("mild"),
    },
    {
      label: "มังสวิรัติ",
      icon: "leaf",
      tone: "green",
      action: () => browse("vegetarian"),
    },
    {
      label: "ญี่ปุ่น",
      icon: "bowl",
      tone: "red",
      action: () => browse("japanese"),
    },
    {
      label: "เมนูเผ็ด",
      icon: "flame",
      tone: "red",
      action: () => browse("spicy"),
    },
    {
      label: "กรอบ ๆ",
      icon: "crispy",
      tone: "gold",
      action: () => browse("crispy"),
    },
    {
      label: "โซนสาธิต",
      icon: "pin",
      tone: "blue",
      action: () => setOverlay("zone"),
    },
    { label: "ดูทุกเมนู", icon: "menu", tone: "orange", action: () => browse() },
  ];
  function menuCard(item: HomeCatalogItem) {
    return (
      <button
        className="dh-menu-card"
        key={item.menuId}
        data-testid={`home-menu-${item.menuId}`}
        onClick={() => setDetail(item)}
      >
        <div className="dh-menu-image">
          <FoodPhoto menuId={item.menuId} menuName={item.menuName} />
          <span>ภาพถ่ายตัวอย่าง</span>
          <i>DEMO</i>
        </div>
        <div className="dh-menu-meta">
          <small>{item.restaurantName}</small>
          <strong data-testid="home-menu-name">{item.menuName}</strong>
          <b data-testid="home-menu-price">{baht(item.priceSatang)}</b>
          <span>ราคาอาหาร · ยังไม่รวมส่วนแบ่งค่าส่ง</span>
        </div>
      </button>
    );
  }
  return (
    <div className="go-page dh-page">
      <div className="go-app dh-app">
        <header className="dh-header">
          <div className="dh-platform-label">
            <span>
              ShopeeFood <b>integration concept</b>
            </span>
            <small>เว็บแนวคิดอิสระ</small>
          </div>
          <div className="dh-location-row">
            <button
              className="dh-icon-button"
              aria-label="กลับหน้าหลัก"
              onClick={() => {
                setTab("home");
                setQuery("");
                setFilter("all");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <HomeIcon name="back" />
            </button>
            <button
              className="dh-address"
              onClick={() => setOverlay("zone")}
              aria-label="เลือกพื้นที่จัดส่ง"
            >
              <HomeIcon name="pin" />
              <span>Bangkok demo · โซนสาธิต</span>
              <HomeIcon name="arrow" />
            </button>
            <button
              className="dh-icon-button"
              onClick={openCart}
              aria-label="เปิดตะกร้ากลุ่ม"
            >
              <HomeIcon name="cart" />
            </button>
          </div>
          <div className="dh-search">
            <HomeIcon name="search" />
            <input
              ref={searchRef}
              type="search"
              aria-label="ค้นหาร้านหรือเมนู"
              placeholder="ค้นหาร้านหรือเมนูใน catalog จำลอง"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTab("catalog");
              }}
            />
            {query && (
              <button aria-label="ล้างคำค้นหา" onClick={() => setQuery("")}>
                <HomeIcon name="close" />
              </button>
            )}
          </div>
        </header>
        <p className="dh-concept-note">
          แนวคิดอิสระ ไม่ใช่ความร่วมมือทางการ · ข้อมูลร้าน/ราคาสมมติ · ไม่สั่งหรือชำระเงินจริง
        </p>
        <main>
          <section
            className="dh-shortcuts"
            data-testid="delivery-shortcuts"
            aria-label="ทางลัดอาหารและ Group Order"
          >
            <div className="dh-shortcut-scroll">
              {shortcuts.map((item) => (
                <button
                  key={item.label}
                  aria-label={item.aria}
                  onClick={item.action}
                >
                  <span className={`dh-shortcut-icon ${item.tone}`}>
                    <HomeIcon name={item.icon} />
                    {item.badge && <i>{item.badge}</i>}
                  </span>
                  <strong>{item.label}</strong>
                </button>
              ))}
            </div>
            <div className="dh-carousel-indicator" aria-hidden="true">
              <span />
            </div>
          </section>
          <section className="dh-crave-entry">
            <CraveMark />
            <div>
              <strong>CraveLoop · แชตเลือกมื้อกลุ่ม</strong>
              <p>ชวนเพื่อนคุยแล้วเลือกร้านด้วยกัน</p>
            </div>
            <button
              onClick={() => {
                setChatJourney(true);
                setStep(2);
              }}
            >
              สร้างห้องแชต <span aria-hidden="true">›</span>
            </button>
          </section>
          {showResults ? (
            <section
              className="dh-catalog-results"
              ref={catalogRef}
              data-testid="delivery-catalog"
            >
              <div className="dh-section-heading">
                <div>
                  <h1>
                    {query.trim()
                      ? `ผลค้นหา “${query.trim()}”`
                      : filterNames[filter]}
                  </h1>
                  <p>
                    {filtered.length} เมนูจาก catalog จำลอง · ยังไม่ตรวจเงื่อนไขทั้งกลุ่ม
                  </p>
                </div>
                {(filter !== "all" || query) && (
                  <button
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    ล้างตัวกรอง
                  </button>
                )}
              </div>
              <div className="dh-filter-pills">
                {(
                  [
                    "all",
                    "budget",
                    "vegetarian",
                    "thai",
                    "spicy",
                    "mild",
                  ] as Filter[]
                ).map((value) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {filterNames[value]}
                  </button>
                ))}
              </div>
              {filtered.length ? (
                <div className="dh-catalog-grid">{filtered.map(menuCard)}</div>
              ) : (
                <div className="dh-no-results" data-testid="home-no-results">
                  <HomeIcon name="search" />
                  <h2>ไม่พบเมนูที่ตรงคำค้นหา</h2>
                  <p>ลองใช้ชื่อเมนูภาษาอังกฤษ หรือคำว่า ไทย เผ็ด กรอบ มังสวิรัติ</p>
                  <button
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    ดูเมนูทั้งหมด
                  </button>
                </div>
              )}
            </section>
          ) : (
            <>
              <section
                className="dh-catalog-rail"
                data-testid="delivery-catalog"
              >
                <div className="dh-rail-heading">
                  <div>
                    <span>อร่อยจากโซนสาธิต</span>
                    <h1>
                      เมนูน่าลอง <b>เลือกให้ครบกลุ่ม</b>
                    </h1>
                  </div>
                  <button onClick={() => browse()}>
                    ดูทั้งหมด <HomeIcon name="arrow" />
                  </button>
                </div>
                <p className="dh-rail-note">
                  ราคาอาหาร ยังไม่รวมส่วนแบ่งค่าส่ง/บริการ · ไม่มีโปรโมชันสด
                </p>
                <div className="dh-horizontal-cards">
                  {featured.map(menuCard)}
                </div>
              </section>
              <section className="dh-promo-panel">
                <div className="dh-section-heading">
                  <h2>มื้อเดียว ลงตัวได้ทุกคน</h2>
                  <button onClick={() => setOverlay("about")}>
                    ทำงานอย่างไร <HomeIcon name="arrow" />
                  </button>
                </div>
                <div className="dh-promo-rail">
                  <button
                    className="dh-promo-banner"
                    onClick={() => setStep(1)}
                  >
                    <div>
                      <small>GROUP ORDER × CRAVELOOP</small>
                      <h3>
                        ไม่ต้องเดา
                        <br />
                        ว่าเพื่อนอยากกินอะไร
                      </h3>
                      <span>ชวนเพื่อนยืนยันเอง แล้วค่อยเลือกร้าน</span>
                      <b>
                        รวมกลุ่มมื้ออร่อย <HomeIcon name="arrow" />
                      </b>
                    </div>
                    <HomeIcon name="people" />
                    <i>CONCEPT</i>
                  </button>
                  <button
                    className="dh-promo-banner dh-fairness-banner"
                    onClick={() => setOverlay("about")}
                  >
                    <div>
                      <small>TRANSPARENT PREFERENCE FIT</small>
                      <h3>60 : 40</h3>
                      <span>ค่าเฉลี่ยกลุ่ม + คนที่ได้คะแนนต่ำสุด</span>
                      <b>
                        ดูหลักการคำนวณ <HomeIcon name="arrow" />
                      </b>
                    </div>
                    <HomeIcon name="leaf" />
                    <i>สูตรสาธิต ไม่ใช่การวัดความสุข</i>
                  </button>
                </div>
              </section>
              <div className="dh-bottom-disclosure">
                ร้าน เมนู ราคา ค่าส่ง และหลักฐานอาหารเป็นข้อมูลสมมติ
                <br />
                ภาพถ่ายอาหารตัวอย่าง · ร้านและเมนูเป็นข้อมูลสาธิต
              </div>
            </>
          )}
        </main>
        <nav
          className="dh-bottom-nav"
          data-testid="delivery-bottom-nav"
          aria-label="เมนูหลัก"
        >
          <button
            className={
              tab === "home" && !overlay && !showResults ? "active" : ""
            }
            onClick={() => {
              setTab("home");
              setQuery("");
              setFilter("all");
              setOverlay(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <HomeIcon name="bowl" />
            <span>หน้าหลัก</span>
          </button>
          <button
            className={showResults && !overlay ? "active" : ""}
            onClick={() => browse()}
          >
            <HomeIcon name="menu" />
            <span>ดูเมนู</span>
          </button>
          <button
            className={overlay === "cart" ? "active" : ""}
            onClick={openCart}
          >
            <HomeIcon name="cart" />
            <span>ตะกร้ากลุ่ม</span>
          </button>
          <button
            className={overlay === "about" ? "active" : ""}
            onClick={() => setOverlay("about")}
          >
            <HomeIcon name="info" />
            <span>เกี่ยวกับ</span>
          </button>
        </nav>
        {overlay && (
          <div
            className="go-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOverlay(null);
            }}
          >
            <section
              className="go-drawer dh-info-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dh-overlay-title"
            >
              <div className="go-grip" />
              <button
                className="go-close"
                aria-label="ปิดหน้าข้อมูล"
                onClick={() => setOverlay(null)}
              >
                ×
              </button>
              <h2 id="dh-overlay-title">
                {overlay === "zone"
                  ? "พื้นที่จัดส่งร่วมกัน"
                  : overlay === "cart"
                    ? "ตะกร้ากลุ่ม"
                    : "ShopeeFood integration concept"}
              </h2>
              {overlay === "zone" ? (
                <>
                  <p className="go-muted">
                    รองรับโซนเดียวสำหรับการสาธิต ไม่ได้อ่านตำแหน่งหรือที่อยู่จริงของคุณ
                  </p>
                  <label htmlFor="dh-zone">โซน catalog</label>
                  <select id="dh-zone" value="bangkok_demo" onChange={() => {}}>
                    <option value="bangkok_demo">
                      Bangkok demo · ข้อมูลสมมติ
                    </option>
                  </select>
                  <button
                    className="go-primary"
                    onClick={() => {
                      setZoneSaved(true);
                      setOverlay(null);
                      setTimeout(() => setZoneSaved(false), 3000);
                    }}
                  >
                    ใช้โซน Bangkok demo
                  </button>
                </>
              ) : overlay === "cart" ? (
                <>
                  <p className="go-muted">
                    ตะกร้าจำลองจะเกิดหลังผู้ร่วมทุกคนยอมรับร้านเดียวกัน
                    และผู้ดูแลส่งต่อการตัดสินใจ ไม่มีคำสั่งซื้อจริง
                  </p>
                  {lastGroup && (
                    <a className="go-outline" href={`/group/${lastGroup}`}>
                      กลับไปที่กลุ่มล่าสุด
                    </a>
                  )}
                  <form onSubmit={openGroup}>
                    <label htmlFor="dh-group-link">ลิงก์ Group Order</label>
                    <input
                      id="dh-group-link"
                      placeholder="วางลิงก์กลุ่มที่มีอยู่"
                      value={groupLink}
                      onChange={(e) => setGroupLink(e.target.value)}
                    />
                    {linkError && (
                      <p className="go-error" role="alert">
                        {linkError}
                      </p>
                    )}
                    <button className="go-primary">เปิดกลุ่มและตรวจตะกร้า</button>
                  </form>
                  <button
                    className="go-outline"
                    onClick={() => {
                      setOverlay(null);
                      setStep(1);
                    }}
                  >
                    สร้างกลุ่มใหม่
                  </button>
                </>
              ) : (
                <>
                  <div className="go-crave-intro">
                    <CraveMark />
                    <span>CraveLoop</span>
                  </div>
                  <p className="go-muted">
                    นี่คือเว็บแนวคิดอิสระ ไม่ใช่ผลิตภัณฑ์หรือความร่วมมืออย่างเป็นทางการของ
                    ShopeeFood ไม่มีการเชื่อมต่อ สั่งอาหาร หรือชำระเงินจริง
                  </p>
                  <div className="go-info-note">
                    1. สมาชิกเข้าร่วมและยืนยันความต้องการเอง
                    <br />
                    2. โค้ดคัดเมนูที่ผ่านเงื่อนไขครบทุกคน
                    <br />
                    3. คะแนน = 60% ค่าเฉลี่ย + 40% คะแนนต่ำสุด
                    <br />
                    4. ทุกคนยอมรับ แล้วจึงสรุปตะกร้าจำลอง
                  </div>
                  <p className="go-fine">
                    Group Order จัดอันดับจาก 12 ร้าน / 60 เมนูจำลอง ·
                    หน้าหลักมีเมนูตัวอย่างเพิ่มเติมตามหมวด ShopeeFood
                  </p>
                  <a className="go-outline" href="/web">
                    เปิด prototype เว็บเดิม
                  </a>
                  <a className="dh-legacy-link" href="/legacy-line">
                    เปิดแชตจำลองเดิม
                  </a>
                </>
              )}
            </section>
          </div>
        )}
        {detail && (
          <div
            className="go-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDetail(null);
            }}
          >
            <section
              className="go-drawer dh-menu-detail"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dh-detail-title"
            >
              <div className="go-grip" />
              <button
                className="go-close"
                aria-label="ปิดรายละเอียดเมนู"
                onClick={() => setDetail(null)}
              >
                ×
              </button>
              <div className="dh-detail-art">
                <FoodPhoto menuId={detail.menuId} menuName={detail.menuName} />
                <span>ภาพถ่ายอาหารตัวอย่าง</span>
              </div>
              <p className="go-eyebrow">{detail.restaurantName}</p>
              <h2 id="dh-detail-title">{detail.menuName}</h2>
              {detail.categoryTh && (
                <p className="go-fine">{detail.categoryTh}</p>
              )}
              <p className="dh-detail-price">{baht(detail.priceSatang)}</p>
              <div className="go-summary-row">
                <span>ค่าจัดส่ง/บริการรวมต่อร้าน (สมมติ)</span>
                <b>{baht(detail.feeSatang)}</b>
              </div>
              <p className="go-fine">
                ราคาอาหารยังไม่รวมส่วนแบ่งค่าจัดส่งรายคน
                ยังไม่ได้ตรวจงบหรือข้อจำกัดของสมาชิกทั้งกลุ่ม ไม่มีคำสั่งซื้อจากหน้านี้
              </p>
              <button
                className="go-primary"
                onClick={() => {
                  setDetail(null);
                  setStep(1);
                }}
              >
                เลือกพร้อมกลุ่ม <span aria-hidden="true">→</span>
              </button>
            </section>
          </div>
        )}
        {zoneSaved && (
          <p className="dh-toast" role="status">
            เลือกโซน Bangkok demo แล้ว
          </p>
        )}
        {createdRoom && (
          <ChatInvite
            sessionId={createdRoom}
            onContinue={() => {
              router.push(`/group/${createdRoom}`);
              setCreatedRoom(undefined);
            }}
          />
        )}
        {step > 0 && (
          <div
            className="go-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy) {
                setStep(0);
                setChatJourney(false);
              }
            }}
          >
            <section
              className="go-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="go-start-title"
            >
              <div className="go-grip" />
              <button
                className="go-close"
                aria-label="ปิดการสร้างกลุ่ม"
                onClick={() => {
                  setStep(0);
                  setChatJourney(false);
                }}
                disabled={busy}
              >
                ×
              </button>
              <div className="go-crave-intro">
                <CraveMark />
                <span>CraveLoop</span>
                <small>GROUP MEAL ASSISTANT</small>
              </div>
              <h2 id="go-start-title">
                {chatJourney
                  ? "สร้างห้องแชตมื้อนี้"
                  : step === 1
                    ? "ต่างคนต่างอยาก ก็ลงตัวได้"
                    : "สร้าง Group Order ของคุณ"}
              </h2>
              {step === 1 ? (
                <>
                  <p className="go-muted">
                    ให้เพื่อนแต่ละคนระบุงบ ความอยาก และข้อจำกัด
                    เราจะหาร้านที่มีเมนูผ่านเงื่อนไขให้ทุกคน ก่อนให้ทั้งกลุ่มตกลงร่วมกัน
                  </p>
                  <div className="go-info-note">
                    ใช้โค้ดคำนวณจาก catalog สมมติ · โหมดกรอกเอง
                    <br />
                    ไม่มีการเรียก AI หรือบริการ ShopeeFood สด
                  </div>
                  <button className="go-primary" onClick={() => setStep(2)}>
                    ให้ CraveLoop ช่วยเลือก <span aria-hidden="true">→</span>
                  </button>
                </>
              ) : (
                <form onSubmit={create}>
                  <p className="go-muted">
                    {chatJourney
                      ? "ตั้งชื่อที่เพื่อนจะเห็นในแชต แล้วแชร์ลิงก์ชวนเพื่อนมาร่วมมื้อ"
                      : "คุณเป็นผู้ดูแลกลุ่ม แชร์ลิงก์ให้เพื่อนเข้ามาได้สูงสุด 5 คน และเลือกผู้ร่วมมื้อได้เอง"}
                  </p>
                  <label htmlFor="go-host-name">ชื่อของคุณ</label>
                  <input
                    id="go-host-name"
                    placeholder="เช่น May"
                    autoComplete="given-name"
                    required
                    maxLength={40}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {!chatJourney && (
                    <>
                      <label htmlFor="go-delivery-area">พื้นที่จัดส่งร่วมกัน</label>
                      <select
                        id="go-delivery-area"
                        value="bangkok_demo"
                        onChange={() => {}}
                      >
                        <option value="bangkok_demo">
                          Bangkok demo · โซนจำลองเดียวที่รองรับ
                        </option>
                      </select>
                      <p className="go-fine">ไม่มีการอ่านตำแหน่งหรือพื้นที่จัดส่งสด</p>
                      <div className="go-summary-row">
                        <span>รูปแบบมื้อนี้</span>
                        <b>เดลิเวอรี · Bangkok demo</b>
                      </div>
                    </>
                  )}
                  {error && (
                    <p role="alert" className="go-error">
                      {error}
                    </p>
                  )}
                  <button className="go-primary" disabled={busy}>
                    {busy
                      ? "กำลังสร้างกลุ่ม…"
                      : chatJourney
                        ? "สร้างห้องและชวนเพื่อน"
                        : "สร้าง Group Order"}{" "}
                    <span aria-hidden="true">↗</span>
                  </button>
                  <p className="go-fine">
                    {chatJourney
                      ? "การสร้างห้องจะเข้าร่วมมื้อนี้ในชื่อของคุณ"
                      : "สร้างกลุ่มแล้ว คุณยังต้องกดเข้าร่วมมื้อนี้และยืนยันข้อมูลด้วยตัวเอง"}
                  </p>
                </form>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
