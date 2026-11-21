import "dotenv/config";
import { seedCatalog } from "../src/server/seed";
import { closeDatabase } from "../src/server/database";
import { catalog, CATALOG_VERSION } from "../src/adapters/catalog";
await seedCatalog();
console.log(
  `Seeded ${catalog.length} synthetic restaurants / ${catalog.reduce((n, r) => n + r.menus.length, 0)} menus (${CATALOG_VERSION}); safe to repeat.`,
);
await closeDatabase();
