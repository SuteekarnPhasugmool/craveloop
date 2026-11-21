export function DeliveryBrand() {
  return (
    <a className="go-brand" href="/" aria-label="หน้าหลัก Group Order">
      <span className="go-bag">S</span>
      <span>
        Shopee<span>Food</span>
        <small>INTEGRATION CONCEPT</small>
      </span>
    </a>
  );
}
export function ConceptNotice() {
  return (
    <div className="go-concept">
      <span>CONCEPT DEMO</span>
      <p>
        ShopeeFood integration concept · ไม่ใช่ผลิตภัณฑ์หรือความร่วมมืออย่างเป็นทางการ ·
        ร้าน เมนู และราคาสมมติ · ไม่เชื่อมต่อ ไม่สั่งหรือชำระเงินจริง
      </p>
    </div>
  );
}
export function CraveMark() {
  return (
    <span className="go-crave-mark" aria-hidden="true">
      c<span>↗</span>
    </span>
  );
}
export function baht(value: number | null) {
  return value === null
    ? "ไม่ทราบ"
    : new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(value / 100);
}
