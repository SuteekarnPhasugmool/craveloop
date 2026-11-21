import type { Menu, RankSnapshot, Restaurant } from "../contracts";
import { rankRestaurants } from "./ranking";

export type NoodleStyle = NonNullable<Menu["noodleStyle"]>;
export const noodleStyles = ["broth", "stir_fried"] as const;

export function simulateNoodleChoice(
  snapshot: RankSnapshot,
  catalog: Restaurant[],
  memberId: string,
) {
  const available = new Set<NoodleStyle>();
  const member = snapshot.members.find((m) => m.id === memberId);
  if (member?.preference.noodle !== "any")
    return { available: [], changesResult: false };

  // Inspect every viable restaurant, including those outside the broad top three.
  for (const restaurant of catalog) {
    const result = rankRestaurants(snapshot, [restaurant]);
    if (!result.options.length) continue;
    const rejected = new Set(
      result.rejections
        .filter((r) => r.memberId === memberId)
        .map((r) => r.menuId),
    );
    for (const menu of restaurant.menus) {
      if (menu.noodleStyle && !rejected.has(menu.id))
        available.add(menu.noodleStyle);
    }
  }
  const choices = noodleStyles.filter((style) => available.has(style));
  if (choices.length < 2) return { available: choices, changesResult: false };
  const outcomes = (["any", ...choices] as const).map((noodle) => {
    const members = snapshot.members.map((m) =>
      m.id === memberId ? { ...m, preference: { ...m.preference, noodle } } : m,
    );
    const { options } = rankRestaurants({ ...snapshot, members }, catalog);
    return JSON.stringify(
      options.map((o) => [
        o.restaurantId,
        o.assignments.find((a) => a.memberId === memberId)!.menuId,
      ]),
    );
  });
  return { available: choices, changesResult: new Set(outcomes).size > 1 };
}
