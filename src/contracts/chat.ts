import { z } from "zod";
import {
  VersionSchema,
  ModeSchema,
  type Preference,
  type SessionView,
} from "./index";
export const ChatActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite_bot") }).strict(),
  VersionSchema.extend({
    action: z.literal("start_meal"),
    selectedMemberIds: z
      .array(z.string().uuid())
      .min(1)
      .max(5)
      .refine((v) => new Set(v).size === v.length, "Select each member once"),
    areaId: z.literal("bangkok_demo"),
    mode: ModeSchema,
  }).strict(),
  VersionSchema.extend({ action: z.literal("join_meal") }).strict(),
  z
    .object({
      action: z.literal("message"),
      text: z.string().trim().min(1).max(2000),
    })
    .strict(),
]);
export type ChatMessage = {
  id: string;
  kind: "system" | "text" | "bot";
  memberId: string | null;
  text: string;
  createdAt: string;
  rankingId?: string;
};
export type MealState = {
  phase: "setup" | "collecting";
  selectedMemberIds: string[];
  joinedMemberIds: string[];
};
export type ChatState = {
  botJoined: boolean;
  messages: ChatMessage[];
  meal?: MealState;
};
export type ChatDraft = {
  preference: Preference;
  questions: string[];
  source: "rules";
  recognized: boolean;
};
export type ChatResponse = {
  session: SessionView;
  chat: ChatState;
  draft?: ChatDraft;
};
