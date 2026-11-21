import { config } from "dotenv";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { z } from "zod";
import {
  PreferenceDraftSchema,
  PreferenceSchema,
  type RankSnapshot,
  type Assignment,
  type Preference,
  type Restaurant,
  type Menu,
  type Mode,
} from "../src/contracts";
import { CatalogSchema, catalog } from "../src/adapters/catalog";
import { groupScores, rankRestaurants } from "../src/domain/ranking";
import { aiStatus, extractPreferences } from "../src/adapters/openai";
config({ path: [".env.local", ".env"], quiet: true });

const ExtractionCase = z.object({
  id: z.string(),
  kind: z.literal("extraction"),
  input: z.object({
    text: z.string().max(2000),
    imagePath: z.string().optional(),
  }),
  expected: z.object({
    hard: z.record(z.string(), z.unknown()),
    allowedSoft: z.object({
      cuisinePreferences: z.array(z.string()),
      flavorTags: z.array(z.string()),
      textureTags: z.array(z.string()),
    }),
    clarificationRequired: z.boolean(),
    needsConfirmation: z.literal(true),
  }),
  explicitForm: z.unknown().optional(),
  verificationNote: z.string().optional(),
});
const RankingCase = z.object({
  id: z.string(),
  kind: z.literal("ranking"),
  fixture: z.object({
    snapshot: z.object({
      preferenceVersion: z.number().int(),
      rosterVersion: z.number().int(),
      areaId: z.string(),
      mode: z.enum(["dine_in", "delivery"]),
      members: z.array(
        z.object({ id: z.string(), preference: PreferenceSchema }),
      ),
      catalogVersion: z.string(),
    }),
    catalog: CatalogSchema,
  }),
  expected: z.object({
    feasibleIds: z.array(z.string()),
    scores: z.record(z.string(), z.number()),
    requiredRejectionCodes: z.array(z.string()),
    assignmentTotalsSatang: z.array(z.number().int()).optional(),
  }),
});
const SeedCase = z.object({
  id: z.string(),
  kind: z.literal("seed_ranking"),
  fixture: z.object({
    snapshot: RankingCase.shape.fixture.shape.snapshot,
    catalogRef: z.literal("seed-v1"),
  }),
  expected: z.object({
    feasibleIds: z.array(z.string()),
    scores: z.record(z.string(), z.number()),
  }),
});
const Others = z.object({
  id: z.string(),
  kind: z.enum(["score_fixture", "integration", "adapter_failure"]),
  fixture: z.record(z.string(), z.array(z.number())).optional(),
  expected: z.record(z.string(), z.unknown()),
  verification: z.string().optional(),
});
const suite = z
  .object({
    version: z.string(),
    provenance: z.string(),
    cases: z
      .array(z.union([ExtractionCase, RankingCase, SeedCase, Others]))
      .min(20),
  })
  .parse(JSON.parse(readFileSync("data/evaluation.json", "utf8")));
const live = process.argv.includes("--live");
const ids = suite.cases.map((item) => item.id);
assert.equal(new Set(ids).size, ids.length, "Case IDs must be unique");
let rankings = 0,
  scoreFixtures = 0,
  imageFixtures = 0,
  schemaCases = 0,
  assignments = 0,
  violations = 0,
  determinism = 0;
let hardCases = 0,
  hardExact = 0,
  tp = 0,
  fp = 0,
  fn = 0,
  clarificationCases = 0,
  clarificationCorrect = 0,
  liveCases = 0,
  liveFailures = 0;
const durations: number[] = [];
const compare = (actual: unknown, expected: unknown) =>
  JSON.stringify(Array.isArray(actual) ? [...actual].sort() : actual) ===
  JSON.stringify(Array.isArray(expected) ? [...expected].sort() : expected);

function hasHardViolation(
  preference: Preference,
  restaurant: Restaurant,
  menu: Menu,
  mode: Mode,
  assignment: Assignment,
): boolean {
  const ingredients = [
    ...preference.excludedIngredients,
    ...preference.allergies,
  ];
  return (
    !restaurant.available ||
    !restaurant.channels.includes(mode) ||
    !menu.available ||
    !menu.priceIncludesFees ||
    (preference.budgetMaxSatang !== null &&
      (assignment.totalCostSatang === null ||
        assignment.totalCostSatang > preference.budgetMaxSatang)) ||
    ingredients.some(
      (ingredient) =>
        !menu.ingredientsComplete || menu.ingredients.includes(ingredient),
    ) ||
    preference.dietaryRequirements.some(
      (requirement) => !menu.dietaryEvidence[requirement]?.verified,
    ) ||
    preference.allergies.some(
      (allergen) =>
        !menu.dietaryEvidence[`absence:${allergen}`]?.verified ||
        !menu.crossContactEvidence[allergen]?.verified,
    ) ||
    assignment.itemCostSatang !== (menu.prices[mode] ?? null) ||
    (assignment.totalCostSatang !== null &&
      assignment.totalCostSatang !==
        assignment.itemCostSatang! + assignment.allocatedFeeSatang!)
  );
}

async function main() {
  for (const item of suite.cases) {
    if (item.kind === "seed_ranking") {
      const start = performance.now();
      const result = rankRestaurants(
        item.fixture.snapshot as RankSnapshot,
        catalog,
      );
      durations.push(performance.now() - start);
      assert.deepEqual(
        result.options.map((option) => option.restaurantId),
        item.expected.feasibleIds,
        `${item.id}: seed feasible IDs`,
      );
      for (const option of result.options) {
        assert.equal(
          option.groupScore,
          item.expected.scores[option.restaurantId],
        );
        assert.equal(
          option.assignments.length,
          item.fixture.snapshot.members.length,
        );
        for (const assignment of option.assignments) {
          assignments++;
          const member = item.fixture.snapshot.members.find(
            (m) => m.id === assignment.memberId,
          )!;
          const restaurant = catalog.find((r) => r.id === option.restaurantId)!;
          const menu = restaurant.menus.find(
            (menu) => menu.id === assignment.menuId,
          )!;
          assert.ok(menu);
          if (
            hasHardViolation(
              member.preference,
              restaurant,
              menu,
              item.fixture.snapshot.mode,
              assignment,
            )
          )
            violations++;
        }
      }
      assert.deepEqual(
        rankRestaurants(
          {
            ...item.fixture.snapshot,
            members: [...item.fixture.snapshot.members].reverse(),
          } as RankSnapshot,
          [...catalog].reverse(),
        ),
        result,
      );
      determinism++;
      rankings++;
    } else if (item.kind === "ranking") {
      const start = performance.now();
      const result = rankRestaurants(
        item.fixture.snapshot as RankSnapshot,
        item.fixture.catalog,
      );
      durations.push(performance.now() - start);
      assert.deepEqual(
        result.options.map((option) => option.restaurantId),
        item.expected.feasibleIds,
        `${item.id}: feasible IDs`,
      );
      for (const option of result.options) {
        assert.equal(
          option.groupScore,
          item.expected.scores[option.restaurantId],
          `${item.id}: score`,
        );
        assert.equal(
          option.assignments.length,
          item.fixture.snapshot.members.length,
        );
        for (const assignment of option.assignments) {
          assignments++;
          const member = item.fixture.snapshot.members.find(
            (m) => m.id === assignment.memberId,
          )!;
          const restaurant = item.fixture.catalog.find(
            (r) => r.id === option.restaurantId,
          )!;
          const menu = restaurant.menus.find(
            (m) => m.id === assignment.menuId,
          )!;
          assert.ok(menu);
          if (
            hasHardViolation(
              member.preference,
              restaurant,
              menu,
              item.fixture.snapshot.mode,
              assignment,
            )
          )
            violations++;
        }
        if (item.expected.assignmentTotalsSatang)
          assert.deepEqual(
            option.assignments.map((assignment) => assignment.totalCostSatang),
            item.expected.assignmentTotalsSatang,
            `${item.id}: costs`,
          );
      }
      for (const code of item.expected.requiredRejectionCodes)
        assert.ok(
          result.rejections.some((rejection) => rejection.code === code),
          `${item.id}: missing ${code}`,
        );
      assert.deepEqual(
        rankRestaurants(
          {
            ...item.fixture.snapshot,
            members: [...item.fixture.snapshot.members].reverse(),
          } as RankSnapshot,
          [...item.fixture.catalog].reverse(),
        ),
        result,
        `${item.id}: determinism`,
      );
      determinism++;
      rankings++;
    } else if (item.kind === "extraction") {
      schemaCases++;
      if (item.input.imagePath) {
        assert.ok(
          existsSync(item.input.imagePath),
          `${item.id}: image fixture missing`,
        );
        imageFixtures++;
      }
      if (!live) continue;
      const imageDataUrl = item.input.imagePath
        ? `data:image/png;base64,${readFileSync(item.input.imagePath).toString("base64")}`
        : undefined;
      const start = performance.now();
      try {
        const draft = PreferenceDraftSchema.parse(
          await extractPreferences({ text: item.input.text, imageDataUrl }),
        );
        liveCases++;
        const hard = Object.entries(item.expected.hard);
        if (hard.length) {
          hardCases++;
          if (
            hard.every(([field, value]) =>
              compare(draft[field as keyof typeof draft], value),
            )
          )
            hardExact++;
        }
        for (const family of [
          "cuisinePreferences",
          "flavorTags",
          "textureTags",
        ] as const) {
          const predicted = new Set<string>(draft[family]);
          const labeled = new Set<string>(item.expected.allowedSoft[family]);
          for (const tag of predicted) {
            if (labeled.has(tag)) tp++;
            else fp++;
          }
          for (const tag of labeled) {
            if (!predicted.has(tag)) fn++;
          }
        }
        clarificationCases++;
        if (draft.questions.length > 0 === item.expected.clarificationRequired)
          clarificationCorrect++;
        console.log(
          `live ${item.id}: ${Math.round(performance.now() - start)}ms; hard fields ${hard.every(([field, value]) => compare(draft[field as keyof typeof draft], value)) ? "match" : "MISMATCH"}`,
        );
      } catch (error) {
        liveFailures++;
        console.log(
          `live ${item.id}: FAILED ${error instanceof Error ? error.name : "error"} (no private input logged)`,
        );
      }
    } else if (item.kind === "score_fixture") {
      assert.ok(item.fixture);
      const a = groupScores(item.fixture.A),
        b = groupScores(item.fixture.B);
      assert.deepEqual(a, { meanScore: 80, minimumScore: 20, groupScore: 56 });
      assert.deepEqual(b, { meanScore: 75, minimumScore: 75, groupScore: 75 });
      assert.ok(a.meanScore > b.meanScore && b.groupScore > a.groupScore);
      scoreFixtures++;
    }
  }
  assert.equal(violations, 0);
  console.log(
    JSON.stringify(
      {
        suite: suite.version,
        mode: live
          ? "live extraction + offline deterministic fixtures"
          : "offline deterministic fixtures and fixture-schema validation ONLY",
        fixtureCases: suite.cases.length,
        rankingCasesPassed: rankings,
        scoreFixturesPassed: scoreFixtures,
        determinismChecksPassed: determinism,
        feasibleAssignmentCoverage: { valid: assignments, total: assignments },
        hardViolationCount: violations,
        rankingLatencyMs: {
          samples: durations.length,
          maximum: Math.max(...durations),
          mean:
            durations.reduce((sum, value) => sum + value, 0) / durations.length,
        },
        extractionFixtureSchemasChecked: schemaCases,
        imageFixtureReferencesChecked: imageFixtures,
        uniqueImageFixtureFiles: 4,
        liveExtraction: {
          attempted: liveCases + liveFailures,
          completed: liveCases,
          failed: liveFailures,
          hardFieldExactMatch: { matches: hardExact, total: hardCases },
          softTagPrecision: tp + fp ? tp / (tp + fp) : null,
          softTagRecall: tp + fn ? tp / (tp + fn) : null,
          softCounts: {
            truePositive: tp,
            falsePositive: fp,
            falseNegative: fn,
          },
          clarificationCorrect: {
            matches: clarificationCorrect,
            total: clarificationCases,
          },
        },
        notExecutedHere: [
          "stale-acceptance API integration (npm run test:integration)",
          "upstream-timeout mocked adapter recovery (npm test)",
          "live image inference and extraction accuracy when --live is absent",
        ],
        limitations: [
          "Allowed soft tag labels are broad authored illustration/text expectations, not a photo benchmark.",
          "Numerical fairness fixture is an algorithm test, not a user study.",
          "Confirmed constraints still require human review, regardless of extraction scores.",
        ],
      },
      null,
      2,
    ),
  );
  if (liveFailures > 0) process.exitCode = 1;
}
if (live && !aiStatus().available) {
  console.error(
    "Live evaluation unavailable: configure server OPENAI_API_KEY and OPENAI_MODEL. No extraction calls were made.",
  );
  process.exitCode = 1;
} else
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
