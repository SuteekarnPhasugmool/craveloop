import type { Menu, Mode, Restaurant } from "../contracts";

export function isSatang(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Integer shares reconcile exactly. IDs, never join order, receive the remainder. */
export function allocateFee(
  totalSatang: number,
  memberIds: string[],
): Record<string, number> {
  if (
    !isSatang(totalSatang) ||
    memberIds.length === 0 ||
    new Set(memberIds).size !== memberIds.length
  ) {
    throw new Error("INVALID_FEE_ALLOCATION");
  }
  const ids = [...memberIds].sort();
  const base = Math.floor(totalSatang / ids.length);
  const remainder = totalSatang % ids.length;
  return Object.fromEntries(
    ids.map((id, index) => [id, base + (index < remainder ? 1 : 0)]),
  );
}

export function deliveryFee(restaurant: Restaurant): number | null {
  const quote = restaurant.feeQuote;
  if (
    !quote ||
    quote.currency !== "THB" ||
    !isSatang(quote.deliveryFeeSatang) ||
    !isSatang(quote.serviceFeeSatang)
  )
    return null;
  const total = quote.deliveryFeeSatang + quote.serviceFeeSatang;
  return isSatang(total) ? total : null;
}

export function menuCost(
  menu: Menu,
  mode: Mode,
  allocatedFeeSatang: number | null,
) {
  const price = menu.prices[mode];
  const itemCostSatang = isSatang(price) ? price : null;
  const total =
    itemCostSatang !== null && allocatedFeeSatang !== null
      ? itemCostSatang + allocatedFeeSatang
      : null;
  return {
    itemCostSatang,
    allocatedFeeSatang,
    totalCostSatang:
      total !== null && isSatang(total) && menu.priceIncludesFees
        ? total
        : null,
  };
}
