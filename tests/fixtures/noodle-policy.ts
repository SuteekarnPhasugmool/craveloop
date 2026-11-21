import { catalog, CATALOG_VERSION } from "../../src/adapters/catalog";
import {
  emptyPreference,
  type RankSnapshot,
  type Restaurant,
} from "../../src/contracts";

// Keep the seed SKUs and prices for the two-restaurant example. The second
// scenario has a separately identified synthetic SKU at one fixture restaurant.
const broth = catalog[0].menus[3],
  stir = catalog[1].menus[3];
const snapshot: RankSnapshot = {
  catalogVersion: CATALOG_VERSION,
  preferenceVersion: 1,
  rosterVersion: 1,
  areaId: "bangkok_demo",
  mode: "delivery",
  members: ["May", "Nat", "Ploy"].map((id) => ({
    id,
    preference: {
      ...emptyPreference,
      budgetMaxSatang: 12000,
      excludedIngredients: ["shrimp"],
      ...(id === "May" ? { noodle: "any" as const } : {}),
    },
  })),
};
const switching: Restaurant[] = [
  { ...catalog[0], menus: [broth] },
  { ...catalog[1], menus: [stir] },
  { ...catalog[2], menus: [catalog[2].menus[2]] }, // hidden shrimp
];
const stable: Restaurant[] = [
  {
    ...catalog[0],
    menus: [
      broth,
      {
        ...stir,
        id: "r01-fixture-stir",
        cuisineTags: ["thai"],
        flavorTags: ["spicy"],
      },
    ],
  },
];
export const noodleScenarios = [
  { name: "restaurant switches", catalog: switching, snapshot, changes: true },
  {
    name: "same restaurant and dish",
    catalog: stable,
    changes: false,
    snapshot: {
      ...snapshot,
      members: snapshot.members.map((m) =>
        m.id !== "May"
          ? m
          : {
              ...m,
              preference: {
                ...m.preference,
                cuisinePreferences: ["chinese" as const],
                flavorTags: ["mild" as const],
              },
            },
      ),
    },
  },
];
