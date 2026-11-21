import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Menu, Restaurant } from "../src/contracts";

/** Fictional author-created fixtures. No venue, price, ingredient or certification is live. */
export function generateCatalog(): Restaurant[] {
  const names = [
    "Mixed Kitchen",
    "Vegetarian Comfort",
    "Rice & Grill",
    "Premium Bowls",
    "Spicy Pork",
    "Delivery Kitchen",
    "Dine-in Plates",
    "Closed Hotpot",
    "Unknown Prices",
    "Incomplete Ingredients",
    "Mild Noodle Bar",
    "Mixed Curry",
  ];
  const baseMenus: Omit<Menu, "id">[] = [
    {
      name: "Crispy tofu rice",
      prices: { dine_in: 8000, delivery: 9000 },
      ingredients: ["tofu", "rice", "soy", "oil"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["thai"],
      flavorTags: ["savory", "mild"],
      textureTags: ["crispy"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "Mild chicken rice",
      prices: { dine_in: 8500, delivery: 9500 },
      ingredients: ["chicken", "rice", "soy"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["thai"],
      flavorTags: ["savory", "mild"],
      textureTags: ["grilled"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "Spicy tofu bowl",
      prices: { dine_in: 8500, delivery: 9500 },
      ingredients: ["tofu", "rice", "chili", "soy"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["thai"],
      flavorTags: ["spicy", "savory"],
      textureTags: ["fresh"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "Vegetable broth noodles",
      prices: { dine_in: 7500, delivery: 8500 },
      ingredients: ["wheat", "vegetable", "soy"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["chinese"],
      flavorTags: ["mild", "savory"],
      textureTags: ["brothy", "chewy"],
      available: true,
      priceIncludesFees: true,
    },
    {
      name: "Grilled chicken salad",
      prices: { dine_in: 9000, delivery: 10000 },
      ingredients: ["chicken", "lettuce", "lime"],
      ingredientsComplete: true,
      dietaryEvidence: {},
      crossContactEvidence: {},
      cuisineTags: ["western"],
      flavorTags: ["sour", "mild"],
      textureTags: ["fresh", "grilled"],
      available: true,
      priceIncludesFees: true,
    },
  ];
  return names.map((name, index) => {
    const n = index + 1,
      id = `r${String(n).padStart(2, "0")}`;
    const menus: Menu[] = baseMenus.map((base, itemIndex) => ({
      ...structuredClone(base),
      id: `${id}-m${String(itemIndex + 1).padStart(2, "0")}`,
    }));
    if (n === 2) {
      menus[1].name = "Mild mushroom rice";
      menus[1].ingredients = ["mushroom", "rice", "soy"];
      menus[4].name = "Grilled mushroom salad";
      menus[4].ingredients = ["mushroom", "lettuce", "lime"];
      menus.forEach((m) => {
        m.prices = {
          dine_in: m.prices.dine_in! - 500,
          delivery: m.prices.delivery! - 500,
        };
      });
      menus[3].textureTags = ["chewy"];
    }
    if (n === 3) {
      menus[0].name = "Crispy mushroom rice";
      menus[0].ingredients = ["mushroom", "rice", "soy", "oil"];
      menus[2].name = "Spicy grilled chicken";
      menus[2].ingredients = ["chicken", "rice", "chili", "soy"];
      menus[2].textureTags = ["grilled"];
      menus[4].name = "Grilled tofu salad";
      menus[4].ingredients = ["tofu", "lettuce", "lime"];
      menus[3].textureTags = ["brothy"];
    }
    if (n === 4) {
      menus.forEach((m) => {
        m.prices = { dine_in: 13000, delivery: 14000 };
      });
      menus[0].flavorTags = ["savory", "mild", "spicy"];
      menus[0].textureTags = ["crispy", "brothy", "chewy"];
      menus[0].name = "Crispy tofu with spicy noodle broth";
      menus[0].ingredients = ["tofu", "wheat", "vegetable", "chili", "soy"];
    }
    if (n === 5) {
      menus.forEach((m, i) => {
        m.name = [
          "Spicy pork rice",
          "Mild pork bowl",
          "Pork chili bowl",
          "Pork broth noodles",
          "Grilled pork salad",
        ][i];
        m.ingredients = [
          ...m.ingredients.filter((t) => t !== "chicken" && t !== "tofu"),
          "pork",
        ];
        m.flavorTags = ["spicy", "savory"];
      });
    }
    if (n === 6)
      menus.forEach((m) => {
        m.cuisineTags = ["indian"];
        m.flavorTags = ["savory"];
        m.textureTags = ["creamy"];
        m.name = `Creamy ${m.name.toLowerCase()}`;
      });
    if (n === 7)
      menus.forEach((m) => {
        m.cuisineTags = ["western"];
        m.flavorTags = ["savory", "mild"];
        m.textureTags = ["grilled"];
        m.name = `Grilled ${m.name.toLowerCase()}`;
      });
    if (n === 9)
      menus.forEach((m) => {
        m.prices = { dine_in: null, delivery: null };
      });
    if (n === 10)
      menus.forEach((m) => {
        m.ingredientsComplete = false;
        m.ingredients = [];
      });
    if (n === 11) {
      menus.forEach((m) => {
        m.flavorTags = ["mild"];
        m.textureTags = ["brothy", "chewy"];
        m.cuisineTags = ["japanese"];
        m.name = `Mild noodle bowl ${m.id.slice(-2)}`;
      });
      menus[2].available = false;
    }
    if (n === 12) {
      menus.forEach((m) => {
        m.name = `Curry ${m.name.toLowerCase()}`;
        m.cuisineTags = ["indian"];
        m.textureTags = ["creamy"];
        m.flavorTags = ["spicy", "savory"];
        m.prices = {
          dine_in: m.prices.dine_in! + 1500,
          delivery: m.prices.delivery! + 1500,
        };
      });
    }
    if (n === 2) menus[3].name = "Vegetable stir-fried noodles";
    for (const menu of menus) {
      if (/noodle/i.test(menu.name)) menu.noodleStyle = n === 2 ? "stir_fried" : "broth";
      const vegetarian =
        menu.ingredientsComplete &&
        !menu.ingredients.some((i) =>
          ["chicken", "pork", "beef", "fish", "shrimp"].includes(i),
        );
      if (vegetarian)
        menu.dietaryEvidence.vegetarian = {
          verified: true,
          evidenceId: `seed:${menu.id}:veg`,
        };
      // A single explicit seed evidence example; other dishes have unknown allergy evidence.
      if (n === 2 && menu.id.endsWith("m01")) {
        menu.dietaryEvidence["absence:peanut"] = {
          verified: true,
          evidenceId: `seed:${menu.id}:peanut-absence`,
        };
        menu.crossContactEvidence.peanut = {
          verified: true,
          evidenceId: `seed:${menu.id}:peanut-cross-contact`,
        };
      }
    }
    return {
      id,
      name: `Demo ${name}`,
      areaId: "bangkok_demo",
      dataOrigin: "synthetic",
      catalogVersion: "seed-v2",
      channels:
        n === 6
          ? ["delivery"]
          : n === 7
            ? ["dine_in"]
            : ["dine_in", "delivery"],
      available: n !== 8,
      distanceM: n === 9 ? null : 300 + n * 100,
      feeQuote:
        n === 10
          ? null
          : {
              currency: "THB",
              deliveryFeeSatang: n <= 4 ? 4000 : 4001,
              serviceFeeSatang: 0,
              source: "synthetic",
            },
      menus,
    };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = generateCatalog();
  writeFileSync(
    new URL("../data/catalog.seed.json", import.meta.url),
    JSON.stringify(catalog, null, 2) + "\n",
  );
  console.log(
    `Generated ${catalog.length} synthetic restaurants / ${catalog.reduce((n, r) => n + r.menus.length, 0)} menus, seed-v2`,
  );
}
