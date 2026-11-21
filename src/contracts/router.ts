import { z } from "zod";
import {
  ConfirmSchema,
  cuisineTags,
  flavorTags,
  textureTags,
  type Preference,
} from "./index";

export const RouterRequest = ConfirmSchema.pick({
  expectedMemberRevision: true,
  expectedPreferenceVersion: true,
  expectedRosterVersion: true,
  confirmedPreference: true,
})
  .extend({ text: z.string().trim().min(1).max(2000) })
  .strict();

// An absent patch field means preserve the form. Each proposal carries its own
// verbatim evidence so the backend can discard unsupported changes.
const quote = z.string();
export const RouterOutput = z.object({
  intent: z.enum(["chat", "new_preference", "change_preference"]),
  patch: z.array(
    z.discriminatedUnion("field", [
      z.object({
        field: z.literal("cuisinePreferences"),
        values: z.array(z.enum(cuisineTags)),
        quote,
      }),
      z.object({
        field: z.literal("flavorTags"),
        values: z.array(z.enum(flavorTags)),
        quote,
      }),
      z.object({
        field: z.literal("textureTags"),
        values: z.array(z.enum(textureTags)),
        quote,
      }),
      z.object({ field: z.literal("desiredDish"), name: z.string(), quote }),
      z.object({ field: z.literal("noodle"), value: z.literal("any"), quote }),
    ]),
  ),
  questions: z.array(z.string()),
});
export type RoutedDraft = {
  id: string;
  intent: z.infer<typeof RouterOutput>["intent"];
  preference: Preference;
  evidence: string[];
  questions: string[];
};
