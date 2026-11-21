import "dotenv/config";
import { seedCatalog } from "../src/server/seed";
import { closeDatabase } from "../src/server/database";
import { catalog, CATALOG_VERSION } from "../src/adapters/catalog";
import { shopeeFoodListings } from "../src/adapters/shopeefood-catalog";
const scope = process.argv.includes("--shopeefood-only") ? "shopeefood" : "all";
await seedCatalog(scope);
if (scope === "all") {
  console.log(
    `Seeded ${catalog.length} synthetic restaurants / ${catalog.reduce((n, r) => n + r.menus.length, 0)} menus (${CATALOG_VERSION}).`,
  );
}
console.log(
  `ShopeeFood discovery catalog: ${shopeeFoodListings.length} categories / ${shopeeFoodListings.length} demo shops / ${shopeeFoodListings.reduce((n, l) => n + l.restaurant.menus.length, 0)} mock dishes.`,
);
await closeDatabase();
