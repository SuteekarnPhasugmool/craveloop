import type {
  Menu,
  Mode,
  Preference,
  Rejection,
  Restaurant,
} from "../contracts";
import { menuCost } from "./costs";

// Canonical ingredient identifiers. An unsupported freeform restriction cannot prove absence.
const ingredientAliases: Record<string, string> = {
  หมู: "pork",
  เนื้อหมู: "pork",
  ไก่: "chicken",
  เนื้อไก่: "chicken",
  เนื้อวัว: "beef",
  ปลา: "fish",
  กุ้ง: "shrimp",
  ถั่วลิสง: "peanut",
  ไข่: "egg",
  นม: "milk",
  ถั่วเหลือง: "soy",
  ข้าวสาลี: "wheat",
  เต้าหู้: "tofu",
  เห็ด: "mushroom",
  พริก: "chili",
  อาหารทะเล: "seafood",
  "sea food": "seafood",
  nut: "nuts",
  dairy: "milk",
  นมวัว: "milk",
};
const canonicalIngredients = new Set([
  "pork",
  "chicken",
  "beef",
  "fish",
  "shrimp",
  "peanut",
  "egg",
  "milk",
  "soy",
  "wheat",
  "tofu",
  "mushroom",
  "chili",
  "rice",
  "oil",
  "vegetable",
  "lettuce",
  "lime",
  "garlic",
  "onion",
  "sesame",
  "tree_nut",
  "shellfish",
  "lamb",
  "duck",
  "crab",
  "squid",
  "butter",
  "cheese",
  "cream",
  "honey",
  "gelatin",
  "seafood",
  "nuts",
  "almond",
  "cashew",
  "walnut",
  "hazelnut",
  "pecan",
  "pistachio",
  "bacon",
  "ham",
  "gluten",
  "barley",
  "rye",
]);
export const SUPPORTED_EXCLUSIONS = [...canonicalIngredients].sort();
const ingredientFamilies: Record<string, string[]> = {
  seafood: ["seafood", "fish", "shrimp", "crab", "squid", "shellfish"],
  shellfish: ["shellfish", "shrimp", "crab"],
  nuts: [
    "nuts",
    "peanut",
    "tree_nut",
    "almond",
    "cashew",
    "walnut",
    "hazelnut",
    "pecan",
    "pistachio",
  ],
  tree_nut: [
    "tree_nut",
    "almond",
    "cashew",
    "walnut",
    "hazelnut",
    "pecan",
    "pistachio",
  ],
  pork: ["pork", "bacon", "ham"],
  milk: ["milk", "butter", "cheese", "cream"],
  soy: ["soy", "tofu"],
  gluten: ["gluten", "wheat", "barley", "rye"],
};
export function normalizeIngredientId(value: string) {
  const normalized = value.trim().toLowerCase();
  return ingredientAliases[normalized] ?? normalized;
}

/** Catalog evidence is fixture evidence, never a restaurant safety certification. */
export function checkMenu(
  preference: Preference,
  restaurant: Restaurant,
  menu: Menu,
  mode: Mode,
  fee: number | null,
  memberId: string,
) {
  const reasons: Rejection[] = [];
  const reject = (code: string) =>
    reasons.push({
      code,
      memberId,
      restaurantId: restaurant.id,
      menuId: menu.id,
    });
  const evidence: { field: string; evidenceId: string }[] = [];
  const cost = menuCost(menu, mode, fee);
  if (!menu.available) reject("NO_AVAILABLE_MENU");
  // No implicit tax/service estimate: all seed prices are inclusive.
  if (!menu.priceIncludesFees) reject("PRICE_UNKNOWN");
  if (preference.budgetMaxSatang !== null) {
    if (cost.totalCostSatang === null) reject("PRICE_UNKNOWN");
    else if (cost.totalCostSatang > preference.budgetMaxSatang)
      reject("BUDGET_EXCEEDED");
  }
  if (cost.itemCostSatang !== null)
    evidence.push({ field: "price", evidenceId: `${menu.id}:${mode}-price` });
  if (mode === "delivery" && fee !== null)
    evidence.push({
      field: "allocatedFee",
      evidenceId: `seed:${restaurant.id}:fee-quote`,
    });
  const exclusions = [
    ...new Set(
      [...preference.excludedIngredients, ...preference.allergies].map(
        normalizeIngredientId,
      ),
    ),
  ];
  const knownIngredients = new Set([
    ...canonicalIngredients,
    ...restaurant.menus.flatMap((m) =>
      m.ingredients.map(normalizeIngredientId),
    ),
  ]);
  for (const ingredient of exclusions) {
    if (!knownIngredients.has(ingredient)) reject("UNKNOWN_RESTRICTION");
    else if (
      menu.ingredients
        .map(normalizeIngredientId)
        .some((id) =>
          (ingredientFamilies[ingredient] ?? [ingredient]).includes(id),
        )
    )
      reject("EXCLUSION_PRESENT");
    else if (!menu.ingredientsComplete) reject("INGREDIENTS_UNKNOWN");
    else
      evidence.push({
        field: `excludes:${ingredient}`,
        evidenceId: `seed:${menu.id}:complete-ingredients`,
      });
  }
  for (const requirement of preference.dietaryRequirements) {
    const record = menu.dietaryEvidence[requirement];
    if (!record?.verified || !record.evidenceId) reject("DIET_UNVERIFIED");
    else
      evidence.push({
        field: `diet:${requirement}`,
        evidenceId: record.evidenceId,
      });
  }
  for (const allergen of preference.allergies.map(normalizeIngredientId)) {
    const absence = menu.dietaryEvidence[`absence:${allergen}`];
    if (!absence?.verified || !absence.evidenceId)
      reject("ALLERGEN_ABSENCE_UNVERIFIED");
    else
      evidence.push({
        field: `allergenAbsence:${allergen}`,
        evidenceId: absence.evidenceId,
      });
    const crossContact = menu.crossContactEvidence[allergen];
    if (!crossContact?.verified || !crossContact.evidenceId)
      reject("CROSS_CONTACT_UNKNOWN");
    else
      evidence.push({
        field: `crossContact:${allergen}`,
        evidenceId: crossContact.evidenceId,
      });
  }
  return { feasible: reasons.length === 0, reasons, cost, evidence };
}
