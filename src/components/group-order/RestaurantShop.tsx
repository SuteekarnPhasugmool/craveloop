"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Option, SessionView } from "@/contracts";
import FoodPhoto from "./FoodPhoto";
import { HomeIcon } from "./HomeIcons";
import { baht } from "./Shared";
import "./restaurant-shop.css";

function dishCategory(name: string) {
  if (/noodle|broth/i.test(name)) return "เมนูเส้น";
  if (/salad/i.test(name)) return "สลัด";
  return "อาหารจานหลัก";
}

export function ShopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="go-page dh-page">
      <div className="go-app dh-app restaurant-shop">{children}</div>
    </div>
  );
}

export default function RestaurantShop({
  session,
  restaurant,
  busy,
  onSelect,
  onBasket,
  onManage,
  basket,
  notice,
  children,
}: {
  session: SessionView;
  restaurant: Option;
  busy: boolean;
  onSelect: (id: string) => void;
  onBasket: () => void;
  onManage: () => void;
  basket?: ReactNode;
  notice: ReactNode;
  children: ReactNode;
}) {
  const [tab, setTab] = useState<"menu" | "info">("menu");
  const [category, setCategory] = useState("ทั้งหมด");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const dishes = session.dishes ?? [];
  const me = session.me!;
  const assignments = restaurant.assignments;
  const myAssignment = assignments.find((a) => a.memberId === me.id);
  const selectedId = session.menuChoices?.[me.id];
  const myDish = dishes.find((d) => d.menuId === selectedId);
  const chosen = assignments.filter(
    (a) => session.menuChoices?.[a.memberId],
  ).length;
  const ready = chosen === assignments.length && chosen > 0;
  const cover = assignments[0];
  const groups = [
    "ทั้งหมด",
    ...new Set(dishes.map((d) => dishCategory(d.menuName))),
  ];
  const shown = dishes.filter(
    (d) =>
      (category === "ทั้งหมด" || category === dishCategory(d.menuName)) &&
      d.menuName.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const distance =
    restaurant.distanceM === null
      ? null
      : `${(restaurant.distanceM / 1000).toLocaleString("th-TH")} กม.`;
  function toggleSearch() {
    setTab("menu");
    setCategory("ทั้งหมด");
    setQuery("");
    setSearching(!searching);
  }
  return (
    <ShopFrame>
      <header className="shop-nav">
        <Link href="/" aria-label="กลับหน้าอาหาร">
          <HomeIcon name="back" />
        </Link>
        {basket && <strong>ตะกร้ากลุ่ม</strong>}
        <div className="shop-nav-actions">
          {!basket && (
            <button
              aria-label="ค้นหาเมนูในร้าน"
              aria-expanded={searching}
              onClick={toggleSearch}
            >
              <HomeIcon name="search" />
            </button>
          )}
          <button
            className="shop-group-pill"
            aria-expanded={groupOpen}
            onClick={() => setGroupOpen(!groupOpen)}
          >
            <HomeIcon name="people" />
            คำสั่งซื้อแบบกลุ่ม
          </button>
        </div>
      </header>
      {groupOpen && (
        <section className="shop-members" aria-label="ผู้ร่วมสั่ง">
          <strong>ผู้ร่วมสั่ง · {assignments.length} คน</strong>
          {assignments.map((a) => (
            <p key={a.memberId}>
              {session.members.find((m) => m.id === a.memberId)?.displayName}
              <span>
                {session.menuChoices?.[a.memberId] ? "เลือกแล้ว" : "กำลังเลือก"}
              </span>
            </p>
          ))}
          {session.isHost && (
            <button
              onClick={() => {
                setGroupOpen(false);
                onManage();
              }}
            >
              จัดการผู้ร่วมสั่ง
            </button>
          )}
        </section>
      )}
      {notice}
      {basket ? (
        <main className="shop-basket">{basket}</main>
      ) : (
        <>
          <main className="shop-scroll" aria-label="หน้าร้าน">
            <section className="shop-profile">
              {cover && (
                <div className="shop-cover">
                  <FoodPhoto menuId={cover.menuId} menuName={cover.menuName} />
                </div>
              )}
              <div className="shop-identity">
                {cover && (
                  <FoodPhoto menuId={cover.menuId} menuName={cover.menuName} />
                )}
                <div>
                  <h1>{restaurant.restaurantName}</h1>
                  <p>
                    <HomeIcon name="pin" /> Bangkok demo{" "}
                    {distance && <> · {distance}</>}
                  </p>
                </div>
              </div>
              <div className="shop-delivery">
                <span>
                  <HomeIcon name="bowl" />
                  จัดส่ง
                </span>
                <span>
                  {myAssignment?.allocatedFeeSatang != null
                    ? `ค่าส่งและบริการส่วนของคุณ ${baht(myAssignment.allocatedFeeSatang)}`
                    : "เดลิเวอรีแบบกลุ่ม"}
                </span>
              </div>
            </section>
            <nav className="shop-tabs" aria-label="ข้อมูลร้าน">
              <button
                aria-pressed={tab === "menu"}
                onClick={() => setTab("menu")}
              >
                เมนู
              </button>
              <button
                aria-pressed={tab === "info"}
                onClick={() => setTab("info")}
              >
                ข้อมูลร้าน
              </button>
            </nav>
            {tab === "info" ? (
              <section className="shop-info">
                <h2>{restaurant.restaurantName}</h2>
                <p>พื้นที่จัดส่ง · Bangkok demo{distance && ` · ${distance}`}</p>
                <p>สั่งร่วมกัน {assignments.length} คน เลือกได้คนละหนึ่งจาน</p>
                <p>ร้าน เมนู และราคาเป็นข้อมูลจำลอง</p>
              </section>
            ) : (
              <>
                {searching && (
                  <div className="shop-search">
                    <HomeIcon name="search" />
                    <input
                      type="search"
                      autoFocus
                      aria-label="ค้นหาเมนู"
                      placeholder="ค้นหาเมนูในร้านนี้"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                )}
                <div className="shop-menu">
                  <nav aria-label="หมวดเมนู">
                    {groups.map((c) => (
                      <button
                        key={c}
                        aria-pressed={category === c}
                        onClick={() => setCategory(c)}
                      >
                        {c}
                      </button>
                    ))}
                  </nav>
                  <section className="shop-list" aria-label="รายการอาหาร">
                    <header>
                      <h2>{category === "ทั้งหมด" ? "เมนูทั้งหมด" : category}</h2>
                      <small>{shown.length} รายการ</small>
                    </header>
                    {shown.map((d) => (
                      <article key={d.menuId}>
                        <FoodPhoto menuId={d.menuId} menuName={d.menuName} />
                        <div>
                          <h3>{d.menuName}</h3>
                          {d.menuId === myAssignment?.menuId && (
                            <small>แนะนำสำหรับคุณ</small>
                          )}
                          <div className="shop-price">
                            <b>{baht(d.itemCostSatang)}</b>
                            <button
                              disabled={busy}
                              aria-label={`เลือก ${d.menuName}`}
                              aria-pressed={selectedId === d.menuId}
                              onClick={() => onSelect(d.menuId)}
                            >
                              {selectedId === d.menuId ? "✓" : "+"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!shown.length && (
                      <p>
                        {!myAssignment
                          ? "คุณไม่ได้ร่วมสั่งในมื้อนี้"
                          : !dishes.length
                            ? "ยังไม่มีเมนูที่ผ่านเงื่อนไขของคุณ"
                            : "ไม่พบเมนูที่ค้นหา"}
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
          </main>
          <footer className="shop-bottom">
            <div aria-live="polite">
              <strong>{myDish ? myDish.menuName : "เลือกเมนูของคุณ"}</strong>
              <small>
                เลือกแล้ว {chosen}/{assignments.length} คน
                {myDish && ` · รวมส่วนของคุณ ${baht(myDish.totalCostSatang)}`}
              </small>
            </div>
            {session.isHost ? (
              <button disabled={busy || !ready} onClick={onBasket}>
                <HomeIcon name="cart" />
                ดูตะกร้ากลุ่ม
              </button>
            ) : (
              <small>{ready ? "รอผู้จัดเปิดตะกร้า" : "คนละ 1 เมนู"}</small>
            )}
          </footer>
        </>
      )}
      {children}
    </ShopFrame>
  );
}
