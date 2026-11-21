import {
  PreferenceSchema,
  type Assignment,
  type Menu,
  type Option,
  type Preference,
  type RankResult,
  type RankSnapshot,
  type RankMember,
  type Restaurant,
} from "../contracts";
import { allocateFee, deliveryFee } from "./costs";
import { checkMenu, normalizeIngredientId } from "./feasibility";

export const ALGORITHM_VERSION = "semantic-fit-60-40-v6";
export function groupScores(scores: number[]) {
  if (
    scores.length === 0 ||
    scores.some((s) => !Number.isFinite(s) || s < 0 || s > 100)
  )
    throw new Error("INVALID_SCORES");
  const meanScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const minimumScore = Math.min(...scores);
  return {
    meanScore,
    minimumScore,
    groupScore: 0.6 * meanScore + 0.4 * minimumScore,
  };
}

export function menuFit(
  preference: Preference,
  menu: Menu,
): { score: number; matchedTags: string[] } {
  const families: [string[], string[], number][] = [
    [preference.cuisinePreferences, menu.cuisineTags, 0.5],
    [preference.flavorTags, menu.flavorTags, 0.3],
    [preference.textureTags, menu.textureTags, 0.2],
  ];
  if (preference.foodBase) {
    const bases = [];
    if (menu.noodleStyle) bases.push("noodles");
    if (menu.ingredients.includes("rice") && !menu.noodleStyle) bases.push("rice");
    families.push([[preference.foodBase], bases, 0.5]);
  } else if (preference.noodle) {
    const requested =
      preference.noodle === "any" ? ["noodle"] : ["noodle", preference.noodle];
    families.push([
      requested,
      menu.noodleStyle ? ["noodle", menu.noodleStyle] : [],
      0.5,
    ]);
  }
  if (preference.servingStyle) {
    const soup = menu.noodleStyle === "broth" || menu.textureTags.includes("brothy");
    families.push([[preference.servingStyle], [soup ? "soup" : "dry"], 0.3]);
  }
  if (preference.desiredDish) {
    families.push([[preference.desiredDish], [menu.name], 0.5]);
  }
  if (preference.videoMenuIds?.length) {
    // A specific clip match outweighs generic rice, cuisine and texture cues.
    families.push([["video"], preference.videoMenuIds.includes(menu.id) ? ["video"] : [], 2.5]);
  }
  let weighted = 0,
    weight = 0;
  const matched = new Set<string>();
  for (const [requested, available, familyWeight] of families) {
    const tags = [...new Set(requested)];
    if (tags.length === 0) continue;
    const overlap = tags.filter((t) => available.includes(t));
    overlap.forEach((t) => matched.add(t));
    weighted += (familyWeight * overlap.length) / tags.length;
    weight += familyWeight;
  }
  const allTags = new Set([
    ...menu.ingredients,
    ...menu.cuisineTags,
    ...menu.flavorTags,
    ...menu.textureTags,
  ]);
  const disliked = [...new Set(preference.dislikes)].filter((tag) =>
    allTags.has(normalizeIngredientId(tag)),
  ).length;
  const base = weight === 0 ? 50 : (weighted / weight) * 100;
  return {
    score: Math.max(0, Math.min(100, base - Math.min(40, disliked * 20))),
    matchedTags: [...matched].sort(),
  };
}

const knownFirst = (a: number | null, b: number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b;
const textOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function compareOptions(a: Option, b: Option) {
  return (
    b.groupScore - a.groupScore ||
    b.minimumScore - a.minimumScore ||
    knownFirst(a.totalGroupCostSatang, b.totalGroupCostSatang) ||
    knownFirst(a.distanceM, b.distanceM) ||
    textOrder(a.restaurantId, b.restaurantId)
  );
}

function semanticScore(member: RankMember, snapshot: RankSnapshot, menuId: string) {
  const fit = member.semanticFit;
  if (!fit || fit.catalogVersion !== snapshot.catalogVersion) return undefined;
  if ("scores" in fit) return fit.scores[menuId];
  const vector = snapshot.menuVectorIndexes?.[fit.indexKey]?.[menuId];
  if (!vector || vector.length !== fit.vector.length) return undefined;
  const cosine = vector.reduce((sum, v, i) => sum + v * fit.vector[i], 0);
  return 50 * (1 + Math.max(-1, Math.min(1, cosine)));
}

export function rankRestaurants(
  snapshot: RankSnapshot,
  catalog: Restaurant[],
): RankResult {
  if (
    !snapshot.members.length ||
    snapshot.members.length > 5 ||
    new Set(snapshot.members.map((m) => m.id)).size !== snapshot.members.length
  )
    throw new Error("INVALID_ROSTER");
  const members = snapshot.members
    .map((member) => ({
      ...member,
      preference: PreferenceSchema.parse(member.preference),
    }))
    .sort((a, b) => textOrder(a.id, b.id));
  const options: Option[] = [],
    rejections: RankResult["rejections"] = [];
  for (const restaurant of [...catalog].sort((a, b) => textOrder(a.id, b.id))) {
    if (restaurant.catalogVersion !== snapshot.catalogVersion) {
      rejections.push({
        code: "CATALOG_VERSION_MISMATCH",
        restaurantId: restaurant.id,
      });
      continue;
    }
    if (
      !restaurant.available ||
      restaurant.areaId !== snapshot.areaId ||
      !restaurant.channels.includes(snapshot.mode)
    ) {
      rejections.push({
        code: !restaurant.available
          ? "RESTAURANT_UNAVAILABLE"
          : restaurant.areaId !== snapshot.areaId
            ? "AREA_UNAVAILABLE"
            : "CHANNEL_UNAVAILABLE",
        restaurantId: restaurant.id,
      });
      continue;
    }
    const feeTotal = snapshot.mode === "dine_in" ? 0 : deliveryFee(restaurant);
    const fees =
      feeTotal === null
        ? null
        : allocateFee(
            feeTotal,
            members.map((m) => m.id),
          );
    const assignments: Assignment[] = [];
    for (const member of members) {
      const feasible: Assignment[] = [];
      if (restaurant.menus.length === 0)
        rejections.push({
          code: "NO_AVAILABLE_MENU",
          restaurantId: restaurant.id,
          memberId: member.id,
        });
      for (const menu of [...restaurant.menus].sort((a, b) =>
        textOrder(a.id, b.id),
      )) {
        const checked = checkMenu(
          member.preference,
          restaurant,
          menu,
          snapshot.mode,
          fees?.[member.id] ?? null,
          member.id,
        );
        rejections.push(...checked.reasons);
        if (!checked.feasible) continue;
        const fit = menuFit(member.preference, menu);
        feasible.push({
          memberId: member.id,
          menuId: menu.id,
          menuName: menu.name,
          fitScore: semanticScore(member, snapshot, menu.id) ?? fit.score,
          ...checked.cost,
          matchedTags: fit.matchedTags,
          constraintEvidence: checked.evidence,
        });
      }
      feasible.sort(
        (a, b) =>
          b.fitScore - a.fitScore ||
          (member.semanticFit ? 0 : knownFirst(a.totalCostSatang, b.totalCostSatang)) ||
          textOrder(a.menuId, b.menuId),
      );
      if (feasible[0]) assignments.push(feasible[0]);
    }
    if (assignments.length !== members.length) continue;
    const knownTotal = assignments.every((a) => a.totalCostSatang !== null);
    const warnings = [
      "Synthetic catalog: menu, ingredient and dietary evidence are fictional fixture records, not live restaurant facts.",
    ];
    if (!knownTotal)
      warnings.push(
        "One or more assigned costs are unknown. No price or fee estimate has been invented.",
      );
    if (members.some((m) => m.preference.allergies.length))
      warnings.push(
        "Allergy evidence status is shown; this prototype does not guarantee medical safety.",
      );
    options.push({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      dataOrigin: "synthetic",
      catalogVersion: restaurant.catalogVersion,
      ...groupScores(assignments.map((a) => a.fitScore)),
      totalGroupCostSatang: knownTotal
        ? assignments.reduce((sum, a) => sum + a.totalCostSatang!, 0)
        : null,
      distanceM: restaurant.distanceM,
      assignments,
      warnings,
      explanation: `Every active member has one feasible catalog meal. Fit = 60% group mean + 40% lowest member fit; confirmed hard constraints were checked before scoring.`,
    });
  }
  if (members.some(member => member.semanticFit)) {
    options.sort((a, b) => b.groupScore - a.groupScore || b.minimumScore - a.minimumScore || textOrder(a.restaurantId, b.restaurantId));
  } else {
    options.sort(compareOptions);
  }
  return {
    status: options.length ? "ok" : "no_match",
    options: options.slice(0, 3),
    rejections,
  };
}
