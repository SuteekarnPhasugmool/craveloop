import type { MealState } from "./chat";
import type { CartHandoff } from "./group-order";
import { z } from "zod";
export const cuisineTags = [
  "thai",
  "japanese",
  "korean",
  "chinese",
  "western",
  "indian",
  "other",
] as const;
export const flavorTags = ["spicy", "savory", "sweet", "sour", "mild"] as const;
export const textureTags = [
  "crispy",
  "brothy",
  "grilled",
  "creamy",
  "fresh",
  "chewy",
] as const;
export const ModeSchema = z.enum(["dine_in", "delivery"]);
export type Mode = z.infer<typeof ModeSchema>;
const strings = z
  .array(z.string().trim().min(1).max(80))
  .max(30)
  .transform((v) => [...new Set(v.map((s) => s.toLowerCase()))]);
export const PreferenceSchema = z
  .object({
    noodle: z.enum(["any", "broth", "stir_fried"]).optional(),
    desiredDish: z.string().trim().min(1).max(120).optional(),
    cuisinePreferences: z.array(z.enum(cuisineTags)).max(7),
    flavorTags: z.array(z.enum(flavorTags)).max(5),
    textureTags: z.array(z.enum(textureTags)).max(6),
    dislikes: strings,
    budgetMaxSatang: z.number().int().min(0).max(10000000).nullable(),
    excludedIngredients: strings,
    dietaryRequirements: strings,
    allergies: strings.default([]),
  })
  .strict();
export type Preference = z.infer<typeof PreferenceSchema>;
export const EvidenceSchema = z.object({
  field: z.string(),
  source: z.enum(["text", "image", "explicit_form"]),
  quote: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
// No defaults/transforms in the model-facing strict structured output schema.
export const PreferenceDraftSchema = z
  .object({
    cuisinePreferences: z.array(z.enum(cuisineTags)),
    flavorTags: z.array(z.enum(flavorTags)),
    textureTags: z.array(z.enum(textureTags)),
    dislikes: z.array(z.string()),
    budgetMaxBaht: z.number().min(0).nullable(),
    excludedIngredients: z.array(z.string()),
    dietaryRequirements: z.array(z.string()),
    evidence: z.array(EvidenceSchema),
    needsConfirmation: z.boolean(),
    questions: z.array(z.string()),
  })
  .strict();
export type PreferenceDraft = z.infer<typeof PreferenceDraftSchema>;
export const VersionSchema = z.object({
  expectedPreferenceVersion: z.number().int().min(0),
  expectedRosterVersion: z.number().int().min(0),
});
export type Versions = { preferenceVersion: number; rosterVersion: number };
export const CreateSchema = z
  .object({
    hostName: z.string().trim().min(1).max(40),
    areaId: z.literal("bangkok_demo"),
    mode: ModeSchema,
    expectedSize: z.literal(4),
    experience: z.enum(["chat", "group_order"]).optional(),
  })
  .strict();
export const JoinSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    clientJoinId: z.string().uuid(),
  })
  .strict();
export const ConfirmSchema = VersionSchema.extend({
  confirmedPreference: PreferenceSchema,
  expectedMemberRevision: z.number().int().min(0),
  noodleDraft: z.string().length(64).optional(),
  routerDraftId: z.string().uuid().optional(),
  reviewedQuestions: z.literal(true).optional(),
  draftId: z.string().uuid().optional(),
}).strict();
export const PatchSchema = VersionSchema.extend({
  mode: ModeSchema.optional(),
  areaId: z.literal("bangkok_demo").optional(),
  action: z.literal("reopen").optional(),
  removeMemberId: z.string().uuid().optional(),
}).strict();
export const RankSchema = VersionSchema.strict();
export const ChoiceSchema = VersionSchema.extend({
  rankingId: z.string().uuid(),
  restaurantId: z.string().min(1).max(80),
}).strict();
export const ExtractSchema = z
  .object({
    inputId: z.string().uuid(),
    inputRevision: z.number().int().min(1),
  })
  .strict();
export type CatalogEvidence = { verified: boolean; evidenceId: string };
export type Menu = {
  id: string;
  name: string;
  prices: Partial<Record<Mode, number | null>>;
  ingredients: string[];
  ingredientsComplete: boolean;
  dietaryEvidence: Record<string, CatalogEvidence>;
  crossContactEvidence: Record<string, CatalogEvidence>;
  cuisineTags: string[];
  flavorTags: string[];
  noodleStyle?: "broth" | "stir_fried";
  textureTags: string[];
  available: boolean;
  priceIncludesFees: boolean;
};
export type Restaurant = {
  id: string;
  name: string;
  areaId: string;
  dataOrigin: "synthetic";
  catalogVersion: string;
  channels: Mode[];
  available: boolean;
  distanceM: number | null;
  feeQuote: {
    currency: "THB";
    deliveryFeeSatang: number;
    serviceFeeSatang: number;
    source: "synthetic";
  } | null;
  menus: Menu[];
};
export type RankMember = { id: string; preference: Preference };
export type RankSnapshot = Versions & {
  areaId: string;
  mode: Mode;
  members: RankMember[];
  catalogVersion: string;
};
export type Assignment = {
  memberId: string;
  menuId: string;
  menuName: string;
  fitScore: number;
  itemCostSatang: number | null;
  allocatedFeeSatang: number | null;
  totalCostSatang: number | null;
  matchedTags: string[];
  constraintEvidence: { field: string; evidenceId: string }[];
};
export type Option = {
  restaurantId: string;
  restaurantName: string;
  dataOrigin: "synthetic";
  catalogVersion: string;
  meanScore: number;
  minimumScore: number;
  groupScore: number;
  totalGroupCostSatang: number | null;
  distanceM: number | null;
  assignments: Assignment[];
  warnings: string[];
  explanation: string;
};
export type Rejection = {
  code: string;
  memberId?: string;
  restaurantId: string;
  menuId?: string;
  graphFacts?: string[];
};
export type RankResult = {
  status: "ok" | "no_match";
  options: Option[];
  rejections: Rejection[];
};
export type RankingUpdate = {
  outcome: "initial" | "changed" | "unchanged";
  previousRankingId: string | null;
};
export type Ranking = RankResult &
  Versions & {
    id: string;
    catalogVersion: string;
    update?: RankingUpdate;
    graphVersion?: string;
    algorithmVersion: string;
    createdAt: string;
  };
export type Acceptance = {
  memberId: string;
  rankingId: string;
  restaurantId: string;
};
export type MemberView = {
  id: string;
  displayName: string;
  confirmed: boolean;
  active: boolean;
  revision: number;
};
export type SessionView = Versions & {
  ingredientProofs?: string[];
  experience?: "group_order";
  handoff?: CartHandoff;
  meal?: MealState;
  id: string;
  areaId: string;
  mode: Mode;
  status: "collecting" | "ranking" | "voting" | "finalized";
  expectedSize: number;
  membershipOpen: boolean;
  members: MemberView[];
  me: (MemberView & { preference: Preference | null }) | null;
  isHost: boolean;
  ranking: Ranking | null;
  acceptances: Acceptance[];
  finalizedOptionId: string | null;
  lastChange: string | null;
  ai: { available: boolean; model: string | null };
  expiresAt: string;
  dataOrigin: "synthetic";
  catalogVersion: string;
};
export type ApiEnvelope<T> = { data: T; requestId: string };
export type ApiError = {
  error: { code: string; message: string; details?: unknown };
  requestId: string;
};
export const emptyPreference: Preference = {
  cuisinePreferences: [],
  flavorTags: [],
  textureTags: [],
  dislikes: [],
  budgetMaxSatang: null,
  excludedIngredients: [],
  dietaryRequirements: [],
  allergies: [],
};
