import { z } from "zod";
import seed from "../../data/catalog.seed.json";
import type { Restaurant } from "../contracts";
import { ALGORITHM_VERSION } from "../domain/ranking";
import { GRAPH_VERSION } from "../domain/ingredient-graph";
export { ALGORITHM_VERSION };
export const CATALOG_VERSION = "seed-v2";
export function currentSnapshot(snapshot: {
  catalogVersion: string;
  algorithmVersion: string;
  graphVersion?: string;
}) {
  return (
    snapshot.catalogVersion === CATALOG_VERSION &&
    snapshot.algorithmVersion === ALGORITHM_VERSION &&
    snapshot.graphVersion === GRAPH_VERSION
  );
}
const money = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const proof = z
  .object({ verified: z.boolean(), evidenceId: z.string().min(1) })
  .strict();
const price = z
  .object({
    dine_in: money.nullable().optional(),
    delivery: money.nullable().optional(),
  })
  .strict();
const menu = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    prices: price,
    ingredients: z.array(z.string()),
    ingredientsComplete: z.boolean(),
    dietaryEvidence: z.record(z.string(), proof),
    crossContactEvidence: z.record(z.string(), proof),
    cuisineTags: z.array(z.string()),
    flavorTags: z.array(z.string()),
    noodleStyle: z.enum(["broth", "stir_fried"]).optional(),
    textureTags: z.array(z.string()),
    available: z.boolean(),
    priceIncludesFees: z.boolean(),
  })
  .strict();
export const CatalogSchema = z
  .array(
    z
      .object({
        id: z.string().min(1),
        name: z.string().startsWith("Demo "),
        areaId: z.literal("bangkok_demo"),
        dataOrigin: z.literal("synthetic"),
        catalogVersion: z.literal(CATALOG_VERSION),
        channels: z.array(z.enum(["dine_in", "delivery"])).min(1),
        available: z.boolean(),
        distanceM: money.nullable(),
        feeQuote: z
          .object({
            currency: z.literal("THB"),
            deliveryFeeSatang: money,
            serviceFeeSatang: money,
            source: z.literal("synthetic"),
          })
          .strict()
          .nullable(),
        menus: z.array(menu),
      })
      .strict(),
  )
  .superRefine((restaurants, ctx) => {
    const ids = new Set<string>();
    for (const restaurant of restaurants) {
      if (ids.has(restaurant.id))
        ctx.addIssue({ code: "custom", message: "Duplicate restaurant ID" });
      ids.add(restaurant.id);
      for (const item of restaurant.menus) {
        if (ids.has(item.id))
          ctx.addIssue({ code: "custom", message: "Duplicate menu ID" });
        ids.add(item.id);
      }
    }
  });
export const catalog: Restaurant[] = CatalogSchema.parse(seed);
