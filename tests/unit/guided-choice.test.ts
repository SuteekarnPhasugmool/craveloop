import { expect, it } from "vitest";
import { catalog } from "../../src/adapters/catalog";
import { emptyPreference } from "../../src/contracts";
import { checkMenu } from "../../src/domain/feasibility";
import { simulateNoodleChoice } from "../../src/domain/guided-choice";
import { rankRestaurants } from "../../src/domain/ranking";
import { noodleScenarios } from "../fixtures/noodle-policy";
import { draftIngredientFacts } from "../../scripts/draft-ingredients";
import sources from "../../data/ingredient-sources.json";

it.each(noodleScenarios)(
  "simulates $name without changing inputs",
  (fixture) => {
    const before = structuredClone(fixture);
    const result = simulateNoodleChoice(
      fixture.snapshot,
      fixture.catalog,
      "May",
    );
    expect(result).toEqual({
      available: ["broth", "stir_fried"],
      changesResult: fixture.changes,
    });
    const winners = result.available.map((noodle) => {
      const members = fixture.snapshot.members.map((m) =>
        m.id === "May" ? { ...m, preference: { ...m.preference, noodle } } : m,
      );
      return rankRestaurants({ ...fixture.snapshot, members }, fixture.catalog)
        .options[0];
    });
    expect(winners.map((w) => w.restaurantId)).toEqual(
      fixture.changes ? ["r01", "r02"] : ["r01", "r01"],
    );
    if (!fixture.changes) {
      expect(winners[0].assignments.map((a) => a.menuId)).toEqual(
        winners[1].assignments.map((a) => a.menuId),
      );
      expect(winners[0].groupScore).not.toBe(winners[1].groupScore);
    }
    expect(fixture).toEqual(before);
  },
);

it("considers only dishes at restaurants feasible for the full group", () => {
  const { snapshot, catalog: venues } = noodleScenarios[0];
  const members = snapshot.members.map((m) =>
    m.id === "Nat"
      ? { ...m, preference: { ...m.preference, budgetMaxSatang: 9500 } }
      : m,
  );
  expect(simulateNoodleChoice({ ...snapshot, members }, venues, "May")).toEqual(
    { available: ["stir_fried"], changesResult: false },
  );
});

it("rejects a catalog-eligible SKU solely on a sourced hidden ingredient path", () => {
  const r = catalog[2],
    menu = r.menus[2];
  const result = checkMenu(
    { ...emptyPreference, excludedIngredients: ["shellfish"] },
    r,
    menu,
    "delivery",
    1333,
    "May",
  );
  expect(result.reasons).toEqual([
    {
      code: "INGREDIENT_GRAPH_CONFLICT",
      memberId: "May",
      restaurantId: r.id,
      menuId: menu.id,
      graphFacts: ["recipe-03-03", "label-x", "class-shrimp"],
    },
  ]);
  expect(
    checkMenu(
      { ...emptyPreference, excludedIngredients: ["peanut"] },
      r,
      menu,
      "delivery",
      1333,
      "May",
    ).feasible,
  ).toBe(true);
  const allergy = { ...emptyPreference, allergies: ["peanut"] };
  expect(
    checkMenu(allergy, r, menu, "delivery", 1333, "May").reasons,
  ).toContainEqual(
    expect.objectContaining({
      graphFacts: ["recipe-03-03", "trace-x"],
    }),
  );
  const missing = checkMenu(
    { ...allergy, budgetMaxSatang: 0 },
    r,
    r.menus[0],
    "delivery",
    1333,
    "May",
  );
  expect(missing.reasons.map((r) => r.code)).toEqual(
    expect.arrayContaining([
      "BUDGET_EXCEEDED",
      "ALLERGEN_ABSENCE_UNVERIFIED",
      "CROSS_CONTACT_UNKNOWN",
    ]),
  );
});

it("drafts scoped recipe and label facts, and holds contradictory evidence for review", () => {
  const draft = draftIngredientFacts();
  expect(draft.corroborated.map((e) => e.factId)).toEqual([
    "recipe-03-03",
    "label-x",
    "trace-x",
  ]);
  expect(draft.proposed.map((e) => [e.from, e.to])).toEqual([
    ["r10-m01", "paste-y"],
    ["paste-y", "soy"],
    ["paste-y", "sesame"],
  ]);
  const label = sources.find((s) => s.subject === "paste-y")!;
  const conflict = draftIngredientFacts([
    ...sources,
    { ...label, lines: ["Free of: ถั่วเหลือง."] },
  ]);
  expect(conflict.conflicts).toHaveLength(2);
  expect(conflict.proposed.some((e) => e.to === "soy")).toBe(false);
  expect(draftIngredientFacts()).toEqual(draft);
});
