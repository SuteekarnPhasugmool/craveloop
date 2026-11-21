import type { ChatState } from "@/contracts/chat";
import type { RoutedDraft } from "@/contracts/router";
import type { CartHandoff } from "@/contracts/group-order";
import type {
  Preference,
  PrivateAnswers,
  PreferenceDraft,
  Ranking,
  Acceptance,
  Mode,
} from "@/contracts";
export type StoredMember = {
  answers?: PrivateAnswers;
  media?: Partial<Record<"image" | "voice", StoredMedia>>;
  router?: {
    id: string;
    revision: number;
    preferenceVersion: number;
    rosterVersion: number;
    failed?: boolean;
    result?: RoutedDraft;
  };
  id: string;
  displayName: string;
  tokenHash: string;
  clientJoinId: string;
  active: boolean;
  confirmed: boolean;
  revision: number;
  preference: Preference | null;
  createdAt: string;
};
export type StoredMedia = { data: string; mime: string; id: string; expiresAt: string };
export type StoredInput = {
  id: string;
  memberId: string;
  kind: "text" | "image" | "screenshot";
  text: string;
  imageDataUrl?: string;
  imageExpiresAt?: string;
  inputRevision: number;
  state: "draft" | "extracted" | "failed";
  createdAt: string;
  draftId?: string;
  draft?: PreferenceDraft;
};
export type StoredSession = {
  preliminaryRestaurants?: string[];
  chatJourney?: boolean;
  menuChoices?: Record<string, string>;
  experience?: "group_order";
  handoff?: CartHandoff;
  chat?: ChatState;
  id: string;
  areaId: string;
  mode: Mode;
  status: "collecting" | "ranking" | "voting" | "finalized";
  hostTokenHash: string;
  preferenceVersion: number;
  rosterVersion: number;
  expectedSize: number;
  membershipOpen: boolean;
  members: StoredMember[];
  inputs: StoredInput[];
  rankings: Ranking[];
  currentRankingId: string | null;
  acceptances: Acceptance[];
  finalizedOptionId: string | null;
  lastChange: string | null;
  expiresAt: string;
  createdAt: string;
  requests: Record<string, { hash: string; response: unknown }>;
  events: {
    id: string;
    type: string;
    version: number;
    createdAt: string;
    payload: Record<string, unknown>;
  }[];
  runs: {
    id: string;
    name: string;
    snapshotVersion: number;
    status: string;
    durationMs: number;
    evidenceIds: string[];
    createdAt: string;
    errorCode?: string;
  }[];
};
