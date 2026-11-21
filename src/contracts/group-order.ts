import { z } from "zod";
import {
  ChoiceSchema,
  ConfirmSchema,
  VersionSchema,
  type Versions,
} from "./index";

export const NoodlePreviewSchema = ConfirmSchema.pick({
  confirmedPreference: true,
  expectedPreferenceVersion: true,
  expectedRosterVersion: true,
  expectedMemberRevision: true,
}).strict();
export type NoodlePreview = {
  choices: { style: "broth" | "stir_fried"; draft: string }[];
};

export const MealActionSchema = z.discriminatedUnion("action", [
  VersionSchema.extend({ action: z.literal("join") }).strict(),
  VersionSchema.extend({
    action: z.literal("configure"),
    selectedMemberIds: z
      .array(z.string().uuid())
      .min(1)
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length),
    areaId: z.literal("bangkok_demo"),
  }).strict(),
]);
export const HandoffSchema = ChoiceSchema.strict();
export const CheckoutSchema = ChoiceSchema.extend({
  handoffId: z.string().uuid(),
}).strict();
export type CartItem = {
  memberId: string;
  displayName: string;
  menuId: string;
  menuName: string;
  quantity: 1;
  itemCostSatang: number;
  allocatedFeeSatang: number;
  totalCostSatang: number;
};
export type CartHandoff = Versions & {
  id: string;
  platform: "shopeefood_concept";
  simulated: true;
  status: "cart" | "checkout_summary" | "invalidated";
  rankingId: string;
  restaurantId: string;
  restaurantName: string;
  catalogVersion: string;
  graphVersion?: string;
  algorithmVersion: string;
  areaId: "bangkok_demo";
  items: CartItem[];
  subtotalSatang: number;
  allocatedFeesSatang: number;
  totalSatang: number;
  createdAt: string;
  checkoutAt?: string;
};
