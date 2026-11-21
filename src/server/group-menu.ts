import { catalog } from "@/adapters/catalog";
import { checkMenu } from "@/domain/feasibility";
import type { Option } from "@/contracts";
import type { StoredMember } from "./state";

export function availableDishes(option: Option, member: StoredMember) {
  const restaurant = catalog.find((r) => r.id === option.restaurantId);
  const assignment = option.assignments.find((a) => a.memberId === member.id);
  if (!restaurant || !member.preference || !assignment) return [];
  return restaurant.menus.flatMap((menu) => {
    const { feasible, cost } = checkMenu(
      member.preference!,
      restaurant,
      menu,
      "delivery",
      assignment.allocatedFeeSatang,
      member.id,
    );
    return feasible &&
      cost.itemCostSatang !== null &&
      cost.totalCostSatang !== null
      ? [
          {
            menuId: menu.id,
            menuName: menu.name,
            itemCostSatang: cost.itemCostSatang,
            totalCostSatang: cost.totalCostSatang,
          },
        ]
      : [];
  });
}
