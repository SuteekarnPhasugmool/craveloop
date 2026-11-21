import seed from "../../../data/catalog.seed.json";
import type { Restaurant } from "@/contracts";

/** Public fictional fixture facts only; no discounts, reviews or sales are inferred. */
export type HomeCatalogItem = {
  restaurantId: string;
  restaurantName: string;
  menuId: string;
  menuName: string;
  priceSatang: number;
  feeSatang: number | null;
  cuisineTags: string[];
  flavorTags: string[];
  textureTags: string[];
  dietaryTags: string[];
};

export const homeCatalog: HomeCatalogItem[] = (seed as Restaurant[]).flatMap(
  (restaurant) => {
    if (!restaurant.available || !restaurant.channels.includes("delivery"))
      return [];
    const quote = restaurant.feeQuote;
    const feeSatang = quote
      ? quote.deliveryFeeSatang + quote.serviceFeeSatang
      : null;
    return restaurant.menus.flatMap((menu) => {
      const price = menu.prices.delivery;
      if (
        !menu.available ||
        typeof price !== "number" ||
        !Number.isSafeInteger(price)
      )
        return [];
      return [
        {
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          menuId: menu.id,
          menuName: menu.name,
          priceSatang: price,
          feeSatang,
          cuisineTags: menu.cuisineTags,
          flavorTags: menu.flavorTags,
          textureTags: menu.textureTags,
          dietaryTags: Object.entries(menu.dietaryEvidence)
            .filter(
              ([key, value]) =>
                !key.startsWith("absence:") &&
                value.verified &&
                !!value.evidenceId,
            )
            .map(([key]) => key),
        },
      ];
    });
  },
);
