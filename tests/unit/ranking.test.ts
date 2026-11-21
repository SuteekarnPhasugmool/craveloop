import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import {
  emptyPreference,
  type Menu,
  type Preference,
  type RankSnapshot,
  type Restaurant,
} from "../../src/contracts";
import { catalog, CATALOG_VERSION } from "../../src/adapters/catalog";
import { allocateFee } from "../../src/domain/costs";
import { checkMenu } from "../../src/domain/feasibility";
import {
  compareOptions,
  groupScores,
  menuFit,
  rankRestaurants,
} from "../../src/domain/ranking";
import { generateCatalog } from "../../scripts/generate-catalog";

const pref = (patch: Partial<Preference> = {}): Preference => ({
  ...structuredClone(emptyPreference),
  ...patch,
});
const snapshot = (
  preferences: Preference[],
  mode: "dine_in" | "delivery" = "dine_in",
): RankSnapshot => ({
  areaId: "bangkok_demo",
  mode,
  members: preferences.map((preference, i) => ({
    id: `member-${i}`,
    preference,
  })),
  preferenceVersion: 1,
  rosterVersion: 1,
  catalogVersion: CATALOG_VERSION,
});
const restaurant = (patch: Partial<Restaurant> = {}): Restaurant => ({
  ...structuredClone(catalog[0]),
  menus: [structuredClone(catalog[0].menus[0])],
  ...patch,
});
const menu = (patch: Partial<Menu> = {}): Menu => ({
  ...structuredClone(catalog[0].menus[0]),
  ...patch,
});
const demoPrefs = () => [
  pref({
    flavorTags: ["savory"],
    textureTags: ["crispy"],
    budgetMaxSatang: 18000,
  }),
  pref({
    flavorTags: ["mild"],
    excludedIngredients: ["pork"],
    budgetMaxSatang: 16000,
  }),
  pref({
    textureTags: ["brothy", "chewy"],
    dietaryRequirements: ["vegetarian"],
    budgetMaxSatang: 15000,
  }),
  pref({ flavorTags: ["spicy"], budgetMaxSatang: 20000 }),
];

describe("catalog provenance and reproducibility", () => {
  it("has exactly12 fictional venues and60 stable menus, no live links", () => {
    expect(catalog).toEqual(generateCatalog());
    expect(catalog).toHaveLength(12);
    expect(catalog.flatMap((r) => r.menus)).toHaveLength(60);
    expect(
      catalog.every(
        (r) =>
          r.name.startsWith("Demo ") &&
          r.dataOrigin === "synthetic" &&
          r.catalogVersion === "seed-v1",
      ),
    ).toBe(true);
    expect(JSON.stringify(catalog)).not.toMatch(/https?:/);
  });
  it.each(["dine_in", "delivery"] as const)(
    "first3 each serve all four demo members after110 budget cut in %s",
    (mode) => {
      const preferences = demoPrefs();
      preferences[3].budgetMaxSatang = 11000;
      for (const r of catalog.slice(0, 3)) {
        const result = rankRestaurants(snapshot(preferences, mode), [r]);
        expect(result.options).toHaveLength(1);
        expect(result.options[0].assignments).toHaveLength(4);
      }
    },
  );
});

describe("hard constraint feasibility", () => {
  it("accepts exactly150baht and rejects150.01, without rounding away satang", () => {
    for (const [amount, expected] of [
      [15000, "ok"],
      [15001, "no_match"],
    ] as const)
      expect(
        rankRestaurants(snapshot([pref({ budgetMaxSatang: 15000 })]), [
          restaurant({ menus: [menu({ prices: { dine_in: amount } })] }),
        ]).status,
      ).toBe(expected);
  });
  it("rejects present pork and cannot prove absence from incomplete ingredients", () => {
    const s = snapshot([pref({ excludedIngredients: ["pork"] })]);
    for (const [m, code] of [
      [menu({ ingredients: ["pork"] }), "EXCLUSION_PRESENT"],
      [menu({ ingredientsComplete: false }), "INGREDIENTS_UNKNOWN"],
    ] as const) {
      const r = rankRestaurants(s, [restaurant({ menus: [m] })]);
      expect(r.status).toBe("no_match");
      expect(r.rejections.some((x) => x.code === code)).toBe(true);
    }
  });
  it("normalizes known Thai ingredient aliases and fails closed on unsupported freeform restriction", () => {
    const blocked = rankRestaurants(
      snapshot([pref({ excludedIngredients: ["หมู"] })]),
      [restaurant({ menus: [menu({ ingredients: ["pork"] })] })],
    );
    expect(blocked.status).toBe("no_match");
    expect(blocked.rejections[0].code).toBe("EXCLUSION_PRESENT");
    const unsupported = rankRestaurants(
      snapshot([pref({ excludedIngredients: ["mystery forbidden thing"] })]),
      [restaurant()],
    );
    expect(unsupported.status).toBe("no_match");
    expect(unsupported.rejections[0].code).toBe("UNKNOWN_RESTRICTION");
  });
  it("matches supported seafood/nuts families while ambiguous Thai restriction remains unknown", () => {
    for (const [restriction, ingredient] of [
      ["อาหารทะเล", "shrimp"],
      ["nuts", "peanut"],
      ["pork", "bacon"],
      ["milk", "cheese"],
    ]) {
      const result = rankRestaurants(
        snapshot([pref({ excludedIngredients: [restriction] })]),
        [restaurant({ menus: [menu({ ingredients: [ingredient] })] })],
      );
      expect(result.status).toBe("no_match");
      expect(result.rejections[0].code).toBe("EXCLUSION_PRESENT");
    }
    expect(
      rankRestaurants(snapshot([pref({ excludedIngredients: ["ถั่ว"] })]), [
        restaurant(),
      ]).rejections[0].code,
    ).toBe("UNKNOWN_RESTRICTION");
  });
  it("requires explicit verified dietary evidence and rejects false or absent proof", () => {
    for (const dietaryEvidence of [
      {},
      { vegetarian: { verified: false, evidenceId: "false" } },
    ] as Menu["dietaryEvidence"][]) {
      const result = rankRestaurants(
        snapshot([pref({ dietaryRequirements: ["vegetarian"] })]),
        [restaurant({ menus: [menu({ dietaryEvidence })] })],
      );
      expect(result.status).toBe("no_match");
      expect(result.rejections[0].code).toBe("DIET_UNVERIFIED");
    }
  });
  it("requires allergen absence, full ingredient data and cross-contact proof independently", () => {
    const p = pref({ allergies: ["peanut"] });
    const r = restaurant();
    expect(
      checkMenu(p, r, menu(), "dine_in", 0, "m").reasons.map((x) => x.code),
    ).toEqual(["ALLERGEN_ABSENCE_UNVERIFIED", "CROSS_CONTACT_UNKNOWN"]);
    const proved = menu({
      dietaryEvidence: {
        "absence:peanut": { verified: true, evidenceId: "absence" },
      },
      crossContactEvidence: {
        peanut: { verified: true, evidenceId: "cross-contact" },
      },
    });
    expect(checkMenu(p, r, proved, "dine_in", 0, "m").feasible).toBe(true);
    expect(
      checkMenu(
        p,
        r,
        { ...proved, ingredientsComplete: false },
        "dine_in",
        0,
        "m",
      ).feasible,
    ).toBe(false);
    expect(
      checkMenu(p, r, { ...proved, ingredients: ["peanut"] }, "dine_in", 0, "m")
        .feasible,
    ).toBe(false);
  });
  it("unknown price fails finite budget; no-budget option states unknown cost", () => {
    const r = restaurant({ menus: [menu({ prices: { dine_in: null } })] });
    expect(
      rankRestaurants(snapshot([pref({ budgetMaxSatang: 100000 })]), [r])
        .status,
    ).toBe("no_match");
    const option = rankRestaurants(snapshot([pref()]), [r]).options[0];
    expect(option.assignments[0].totalCostSatang).toBeNull();
    expect(option.warnings.join(" ")).toContain("unknown");
  });
  it("unknown delivery fees fail finite budget, including a zero budget", () => {
    const r = restaurant({
      feeQuote: null,
      menus: [menu({ prices: { delivery: 0 } })],
    });
    expect(
      rankRestaurants(snapshot([pref({ budgetMaxSatang: 0 })], "delivery"), [r])
        .status,
    ).toBe("no_match");
    expect(
      rankRestaurants(snapshot([pref()], "delivery"), [r]).options[0]
        .totalGroupCostSatang,
    ).toBeNull();
  });
  it("never assumes unprovided tax or service charges", () => {
    const r = restaurant({ menus: [menu({ priceIncludesFees: false })] });
    expect(rankRestaurants(snapshot([pref()]), [r]).status).toBe("no_match");
  });
  it.each([
    { available: false },
    { channels: ["delivery"] },
    { areaId: "other" },
  ] as Partial<Restaurant>[])(
    "excludes unavailable restaurant/area/channel: %j",
    (patch) => {
      expect(
        rankRestaurants(snapshot([pref()]), [restaurant(patch)]).status,
      ).toBe("no_match");
    },
  );
  it("excludes unavailable or absent menus and reports structured reasons", () => {
    for (const menus of [[], [menu({ available: false })]]) {
      const r = rankRestaurants(snapshot([pref()]), [restaurant({ menus })]);
      expect(r.status).toBe("no_match");
      expect(r.options).toEqual([]);
      expect(r.rejections[0].code).toBe("NO_AVAILABLE_MENU");
    }
  });
  it("a single member with no feasible menu excludes the entire restaurant", () => {
    const result = rankRestaurants(
      snapshot([pref(), pref({ budgetMaxSatang: 1 })]),
      [restaurant()],
    );
    expect(result.options).toEqual([]);
    expect(
      result.rejections.some(
        (r) => r.memberId === "member-1" && r.code === "BUDGET_EXCEEDED",
      ),
    ).toBe(true);
  });
  it("does not accept catalog version drift", () => {
    expect(
      rankRestaurants(snapshot([pref()]), [
        restaurant({ catalogVersion: "changed" }),
      ]).rejections[0].code,
    ).toBe("CATALOG_VERSION_MISMATCH");
  });
});

describe("fit and fairness", () => {
  it("uses specified numerical fairness trade-off; better mean can lose", () => {
    const a = groupScores([100, 100, 100, 20]),
      b = groupScores([75, 75, 75, 75]);
    expect(a).toEqual({ meanScore: 80, minimumScore: 20, groupScore: 56 });
    expect(b).toEqual({ meanScore: 75, minimumScore: 75, groupScore: 75 });
    expect(a.meanScore).toBeGreaterThan(b.meanScore);
    expect(a.groupScore).toBeLessThan(b.groupScore);
  });
  it("matches documented historical numerical fixture", () => {
    expect(groupScores([95, 95, 95, 20]).groupScore).toBeCloseTo(53.75);
    expect(groupScores([78, 80, 82, 84]).groupScore).toBeCloseTo(79.8);
    expect(groupScores([50, 60, 65, 80]).groupScore).toBeCloseTo(58.25);
  });
  it("empty requests produce neutral50 and no NaN", () => {
    expect(menuFit(pref(), menu()).score).toBe(50);
  });
  it("renormalizes only requested families and does not credit unknown tags", () => {
    expect(
      menuFit(pref({ textureTags: ["crispy", "brothy"] }), menu()).score,
    ).toBe(50);
    expect(
      menuFit(pref({ cuisinePreferences: ["japanese"] }), menu()).score,
    ).toBe(0);
    expect(
      menuFit(
        pref({ cuisinePreferences: ["thai"], flavorTags: ["spicy"] }),
        menu(),
      ).score,
    ).toBeCloseTo(62.5);
  });
  it("soft dislikes penalize tags by20 capped40 without becoming hard exclusions", () => {
    const p = pref({ dislikes: ["thai", "savory", "crispy"] });
    expect(menuFit(p, menu()).score).toBe(10);
    expect(rankRestaurants(snapshot([p]), [restaurant()]).status).toBe("ok");
  });
  it("menu tie chooses cheaper total then stable menuID", () => {
    const r = restaurant({
      menus: [
        menu({ id: "z", prices: { dine_in: 7000 } }),
        menu({ id: "a", prices: { dine_in: 7000 } }),
        menu({ id: "0", prices: { dine_in: 8000 } }),
      ],
    });
    expect(
      rankRestaurants(snapshot([pref()]), [r]).options[0].assignments[0].menuId,
    ).toBe("a");
  });
  it("restaurant ties use lower known cost then distance thenID; preserve exact scores", () => {
    const r = restaurant();
    const option = rankRestaurants(snapshot([pref()]), [r]).options[0];
    expect(
      compareOptions(
        { ...option, restaurantId: "b", distanceM: 500 },
        { ...option, restaurantId: "a", distanceM: 600 },
      ),
    ).toBeLessThan(0);
    expect(
      compareOptions(
        { ...option, totalGroupCostSatang: 0 },
        { ...option, totalGroupCostSatang: null },
      ),
    ).toBeLessThan(0);
    expect(
      compareOptions(
        { ...option, minimumScore: 51 },
        { ...option, minimumScore: 50 },
      ),
    ).toBeLessThan(0);
  });
  it("is deterministic across input permutations and repeated calls", () => {
    const s = snapshot(demoPrefs());
    const original = rankRestaurants(s, catalog);
    const reversed = rankRestaurants(
      { ...s, members: [...s.members].reverse() },
      [...catalog]
        .reverse()
        .map((r) => ({ ...r, menus: [...r.menus].reverse() })),
    );
    expect(reversed).toEqual(original);
    for (let i = 0; i < 5; i++)
      expect(rankRestaurants(s, catalog)).toEqual(original);
  });
});

describe("cost reconciliation and replan", () => {
  it("allocates fee remainder in ascending memberID and reconciles exactly", () => {
    const allocated = allocateFee(4003, ["d", "c", "a", "b"]);
    expect(allocated).toEqual({ a: 1001, b: 1001, c: 1001, d: 1000 });
    expect(Object.values(allocated).reduce((a, b) => a + b, 0)).toBe(4003);
  });
  it("delivery total includes exactly item plus delivery/service shares", () => {
    const r = restaurant({
      feeQuote: {
        currency: "THB",
        deliveryFeeSatang: 4000,
        serviceFeeSatang: 3,
        source: "synthetic",
      },
      menus: [menu({ prices: { delivery: 9000 } })],
    });
    const result = rankRestaurants(
      snapshot([pref(), pref(), pref(), pref()], "delivery"),
      [r],
    );
    expect(result.options[0].totalGroupCostSatang).toBe(40003);
    expect(
      result.options[0].assignments.map((a) => a.allocatedFeeSatang),
    ).toEqual([1001, 1001, 1001, 1000]);
  });
  it("one-satang delivery boundary is enforced on the member receiving remainder", () => {
    const r = restaurant({
      feeQuote: {
        currency: "THB",
        deliveryFeeSatang: 1,
        serviceFeeSatang: 0,
        source: "synthetic",
      },
      menus: [menu({ prices: { delivery: 10000 } })],
    });
    expect(
      rankRestaurants(
        snapshot(
          [pref({ budgetMaxSatang: 10000 }), pref({ budgetMaxSatang: 10000 })],
          "delivery",
        ),
        [r],
      ).status,
    ).toBe("no_match");
  });
  it("budget reduction cannot retain an overbudget assignment; premium restaurant disappears", () => {
    const initial = demoPrefs(),
      r = catalog[3];
    expect(rankRestaurants(snapshot(initial), [r]).status).toBe("ok");
    initial[3].budgetMaxSatang = 11000;
    const revised = rankRestaurants(snapshot(initial), catalog);
    expect(rankRestaurants(snapshot(initial), [r]).status).toBe("no_match");
    for (const o of revised.options)
      for (const a of o.assignments)
        expect(a.totalCostSatang!).toBeLessThanOrEqual(
          initial[Number(a.memberId.slice(-1))].budgetMaxSatang!,
        );
  });
  it("every returned restaurant has exactly one catalog-backed eligible assignment for every member", () => {
    for (const mode of ["dine_in", "delivery"] as const) {
      const s = snapshot(demoPrefs(), mode),
        ranked = rankRestaurants(s, catalog);
      expect(ranked.options.length).toBeGreaterThan(0);
      for (const option of ranked.options) {
        expect(option.assignments.map((a) => a.memberId)).toEqual(
          s.members.map((m) => m.id),
        );
        const r = catalog.find((r) => r.id === option.restaurantId)!;
        for (const a of option.assignments) {
          const m = r.menus.find((m) => m.id === a.menuId)!;
          expect(m).toBeDefined();
          expect(
            checkMenu(
              s.members.find((m) => m.id === a.memberId)!.preference,
              r,
              m,
              mode,
              a.allocatedFeeSatang,
              a.memberId,
            ).feasible,
          ).toBe(true);
          expect(a.fitScore).toBeGreaterThanOrEqual(0);
          expect(a.fitScore).toBeLessThanOrEqual(100);
        }
      }
    }
  });
  it("returns structured no-match without choosing or relaxing any constraint", () => {
    const result = rankRestaurants(
      snapshot([pref({ budgetMaxSatang: 0, dietaryRequirements: ["halal"] })]),
      catalog,
    );
    expect(result.status).toBe("no_match");
    expect(result.options).toEqual([]);
    expect(result.rejections.some((r) => r.code === "DIET_UNVERIFIED")).toBe(
      true,
    );
  });
  it("measures rank time on seed without asserting machine-specific latency", () => {
    const s = snapshot(demoPrefs()),
      start = performance.now();
    for (let i = 0; i < 100; i++) rankRestaurants(s, catalog);
    const elapsed = performance.now() - start;
    console.info(
      `Seed ranking:100 runs,total ${elapsed.toFixed(2)}ms,mean ${(elapsed / 100).toFixed(3)}ms`,
    );
    expect(Number.isFinite(elapsed)).toBe(true);
  });
  it("rejects zero/duplicate roster and invalid monetary preferences", () => {
    expect(() => rankRestaurants(snapshot([]), catalog)).toThrow(
      "INVALID_ROSTER",
    );
    const s = snapshot([pref(), pref()]);
    s.members[1].id = s.members[0].id;
    expect(() => rankRestaurants(s, catalog)).toThrow("INVALID_ROSTER");
    expect(() =>
      rankRestaurants(snapshot([pref({ budgetMaxSatang: 1.5 })]), catalog),
    ).toThrow();
  });
});
