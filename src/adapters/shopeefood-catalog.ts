import fixture from "../../data/shopeefood-categories.seed.json";
import type { Restaurant } from "../contracts";

export const shopeeFoodSource = fixture.sourcePage;

// Only category labels and listing IDs come from the public page. Each
// category has one fictional shop with locally assigned menu SKUs and prices.
export const shopeeFoodListings = fixture.categories.map((category) => {
  const id = `sf-demo-${category.listingId}`;
  const restaurant: Restaurant = {
    id,
    name: `ร้านจำลอง ${category.restaurantTh}`,
    dataOrigin: "synthetic",
    catalogVersion: fixture.catalogVersion,
    areaId: "bangkok_demo",
    channels: ["delivery"],
    available: true,
    distanceM: null,
    feeQuote: null,
    menus: category.menus.map((menu) => ({
      id: `${id}-${menu.sku}`,
      name: menu.nameTh,
      prices: { delivery: menu.deliveryPriceSatang },
      available: true,
      priceIncludesFees: true,
      ingredients: [],
      ingredientsComplete: false,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: [category.cuisineTag],
      flavorTags: [],
      textureTags: [],
    })),
  };
  return {
    listingId: category.listingId,
    nameTh: category.nameTh,
    sectionTh: category.sectionTh,
    restaurant,
  };
});
