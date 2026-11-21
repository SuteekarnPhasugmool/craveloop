import { catalog } from "@/adapters/catalog";
import { pool, sqlite } from "./database";
import { env } from "./env";
export async function seedCatalog() {
  const isPg = env().driver === "postgres";
  const c = isPg ? await pool().connect() : null;
  const d = isPg ? null : sqlite();
  const exec = async (sql: string, values: unknown[]) => {
    if (c) {
      let n = 0;
      await c.query(
        sql.replace(/\?/g, () => `$${++n}`),
        values,
      );
    } else {
      d!
        .prepare(sql)
        .run(...values.map((x) => (typeof x === "boolean" ? Number(x) : x)));
    }
  };
  try {
    if (c) await c.query("BEGIN");
    else d!.exec("BEGIN IMMEDIATE");
    for (const r of catalog) {
      await exec(
        "INSERT INTO restaurants(id,name,area_id,channels,available,distance_m,fee_quote,catalog_version,data_origin) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,channels=excluded.channels,available=excluded.available,distance_m=excluded.distance_m,fee_quote=excluded.fee_quote,catalog_version=excluded.catalog_version",
        [
          r.id,
          r.name,
          r.areaId,
          JSON.stringify(r.channels),
          r.available,
          r.distanceM,
          JSON.stringify(r.feeQuote),
          r.catalogVersion,
          r.dataOrigin,
        ],
      );
      for (const m of r.menus)
        await exec(
          "INSERT INTO menus(id,restaurant_id,name,channel_prices_satang,ingredients,ingredients_complete,dietary_evidence,cross_contact_evidence,cuisine_tags,flavor_tags,texture_tags,available,price_includes_fees) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,channel_prices_satang=excluded.channel_prices_satang,ingredients=excluded.ingredients,ingredients_complete=excluded.ingredients_complete,dietary_evidence=excluded.dietary_evidence,cross_contact_evidence=excluded.cross_contact_evidence,cuisine_tags=excluded.cuisine_tags,flavor_tags=excluded.flavor_tags,texture_tags=excluded.texture_tags,available=excluded.available,price_includes_fees=excluded.price_includes_fees",
          [
            m.id,
            r.id,
            m.name,
            JSON.stringify(m.prices),
            JSON.stringify(m.ingredients),
            m.ingredientsComplete,
            JSON.stringify(m.dietaryEvidence),
            JSON.stringify(m.crossContactEvidence),
            JSON.stringify(m.cuisineTags),
            JSON.stringify(m.flavorTags),
            JSON.stringify(m.textureTags),
            m.available,
            m.priceIncludesFees,
          ],
        );
    }
    if (c) await c.query("COMMIT");
    else d!.exec("COMMIT");
  } catch (e) {
    if (c) await c.query("ROLLBACK");
    else d!.exec("ROLLBACK");
    throw e;
  } finally {
    c?.release();
  }
}
