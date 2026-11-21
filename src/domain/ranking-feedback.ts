import type { Ranking, RankingUpdate } from "../contracts";
type Recommendation = Pick<
  Ranking,
  "status" | "options" | "rosterVersion" | "catalogVersion"
>;
// Compare actual recommendation evidence, not IDs/timestamps or explanatory wording.
// A preference update does not imply that a different restaurant should win.
function choices(r: Recommendation) {
  return JSON.stringify({
    status: r.status,
    options: r.options.map((o) => ({
      restaurantId: o.restaurantId,
      meanScore: o.meanScore,
      minimumScore: o.minimumScore,
      groupScore: o.groupScore,
      totalGroupCostSatang: o.totalGroupCostSatang,
      assignments: o.assignments.map((a) => ({
        memberId: a.memberId,
        menuId: a.menuId,
        fitScore: a.fitScore,
        itemCostSatang: a.itemCostSatang,
        allocatedFeeSatang: a.allocatedFeeSatang,
        totalCostSatang: a.totalCostSatang,
        matchedTags: a.matchedTags,
      })),
    })),
  });
}
export function rankingUpdate(
  current: Recommendation,
  previous: Ranking | null,
): RankingUpdate {
  if (
    !previous ||
    previous.rosterVersion !== current.rosterVersion ||
    previous.catalogVersion !== current.catalogVersion
  )
    return { outcome: "initial", previousRankingId: null };
  return {
    outcome: choices(current) === choices(previous) ? "unchanged" : "changed",
    previousRankingId: previous.id,
  };
}
