import { expect, it, vi } from "vitest";
import { catalog, CATALOG_VERSION } from "@/adapters/catalog";
import { semanticFit } from "@/adapters/semantic-ranking";
import { emptyPreference } from "@/contracts";
import { rankRestaurants } from "@/domain/ranking";

const { describeMeal, embed } = vi.hoisted(() => ({
  describeMeal: vi.fn(),
  embed: vi.fn(),
}));
vi.mock("@/adapters/structured-response", () => ({
  structuredResponse: describeMeal,
}));
vi.mock("openai", () => ({
  default: class {
    embeddings = { create: embed };
  },
}));

it("embeds each generated description against one shared menu index and ranks eligible dishes per member", async () => {
  const restaurant = catalog[0];
  const [first, second, unavailable] = restaurant.menus;
  const dishes = catalog.flatMap((r) => r.menus);
  describeMeal
    .mockResolvedValueOnce({ description: "meal A" })
    .mockResolvedValueOnce({ description: "meal B" });
  embed.mockImplementation(async ({ input }: { input: string[] }) => ({
    data: input
      .map((line, index) => {
        let embedding = [0, 1];
        if (line === "meal A" || line === "meal B")
          embedding = [line === "meal A" ? 2 : -2, 0];
        else if (dishes[index].id === first.id) embedding = [3, 1];
        else if (dishes[index].id === second.id) embedding = [-4, 0];
        else if (dishes[index].id === unavailable.id) embedding = [1, 0];
        return { index, embedding };
      })
      .reverse(),
  }));
  const prepared = await Promise.all(
    ["A", "B"].map(async (id) => ({
      id,
      preference: emptyPreference,
      semanticFit: await semanticFit(emptyPreference, id),
    })),
  );
  const inputs = prepared[0].semanticFit!;
  const members = prepared.map((m) => ({
    ...m,
    preference: {
      ...emptyPreference,
      budgetMaxSatang: 100000,
      excludedIngredients: ["lamb"],
    },
    semanticFit: m.semanticFit!.member,
  }));
  const rejected = vi.fn(() => {
    throw new Error("Rejected menu was scored");
  });
  for (const id of [unavailable.id, "outside", "expensive", "restricted"])
    Object.defineProperty(inputs.menus, id, { get: rejected });
  expect(embed).toHaveBeenCalledTimes(3);
  expect(describeMeal).toHaveBeenCalledTimes(2);
  const result = rankRestaurants(
    {
      members,
      menuVectorIndexes: { [inputs.member.indexKey]: inputs.menus },
      areaId: restaurant.areaId,
      mode: "delivery",
      catalogVersion: CATALOG_VERSION,
      preferenceVersion: 1,
      rosterVersion: 1,
    },
    [
      {
        ...restaurant,
        menus: [
          first,
          second,
          { ...unavailable, available: false },
          { ...first, id: "expensive", prices: { delivery: 100001 } },
          { ...first, id: "restricted", ingredients: ["lamb"] },
        ],
      },
      {
        ...restaurant,
        id: "other",
        areaId: "other",
        menus: [{ ...first, id: "outside" }],
      },
    ],
  );
  expect(result.options[0].assignments.map((a) => a.menuId)).toEqual([
    first.id,
    second.id,
  ]);
  expect(result.options[0].assignments[1].fitScore).toBe(100);
  expect(rejected).not.toHaveBeenCalled();
});
