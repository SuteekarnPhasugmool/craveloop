import { randomUUID } from "node:crypto";
import type { Option, Ranking } from "@/contracts";
import type { CartHandoff, CartItem } from "@/contracts/group-order";
import { assert } from "@/server/errors";

/** Local platform boundary: copies verified facts, never calls ShopeeFood. */
export function simulatedHandoff(
  option: Option,
  ranking: Ranking,
  members: { id: string; displayName: string }[],
): CartHandoff {
  const items: CartItem[] = option.assignments.map((a) => {
    const member = members.find((m) => m.id === a.memberId);
    assert(
      member &&
        [a.itemCostSatang, a.allocatedFeeSatang, a.totalCostSatang].every(
          (n) => n !== null && Number.isSafeInteger(n) && n >= 0,
        ),
      422,
      "CART_COST_UNKNOWN",
      "ยังส่งเข้าตะกร้าไม่ได้: ราคาหรือค่าส่งไม่ครบ กรุณาเลือกข้อเสนอที่มียอดแน่นอน",
    );
    assert(
      a.itemCostSatang! + a.allocatedFeeSatang! === a.totalCostSatang,
      409,
      "CART_TOTAL_MISMATCH",
      "ยอดรายคนไม่ตรงกัน กรุณาคำนวณใหม่",
    );
    return {
      memberId: a.memberId,
      displayName: member.displayName,
      menuId: a.menuId,
      menuName: a.menuName,
      quantity: 1,
      itemCostSatang: a.itemCostSatang!,
      allocatedFeeSatang: a.allocatedFeeSatang!,
      totalCostSatang: a.totalCostSatang!,
    };
  });
  assert(
    items.length === members.length &&
      new Set(items.map((i) => i.memberId)).size === members.length,
    409,
    "CART_ROSTER_MISMATCH",
    "เมนูต้องครบสมาชิกทุกคน",
  );
  const subtotalSatang = items.reduce((n, i) => n + i.itemCostSatang, 0);
  const allocatedFeesSatang = items.reduce(
    (n, i) => n + i.allocatedFeeSatang,
    0,
  );
  const totalSatang = subtotalSatang + allocatedFeesSatang;
  assert(
    Number.isSafeInteger(totalSatang) &&
      totalSatang === option.totalGroupCostSatang,
    409,
    "CART_TOTAL_MISMATCH",
    "ยอดรวมไม่ตรงกับข้อเสนอ กรุณาคำนวณใหม่",
  );
  return {
    id: randomUUID(),
    platform: "shopeefood_concept",
    simulated: true,
    status: "cart",
    rankingId: ranking.id,
    restaurantId: option.restaurantId,
    restaurantName: option.restaurantName,
    preferenceVersion: ranking.preferenceVersion,
    rosterVersion: ranking.rosterVersion,
    catalogVersion: ranking.catalogVersion,
    algorithmVersion: ranking.algorithmVersion,
    areaId: "bangkok_demo",
    items,
    subtotalSatang,
    allocatedFeesSatang,
    totalSatang,
    createdAt: new Date().toISOString(),
  };
}
