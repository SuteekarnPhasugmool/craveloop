import type { ChatState } from "../contracts/chat";
import type { StoredMember } from "../server/state";
import { AppError } from "../server/errors";

/** Group membership and explicit meal participation are different rosters. */
export type MealSession = { members: StoredMember[]; chat?: ChatState };

/** Preserve the stored human-member order; bot presence never adds a member. */
export function mealMembers(session: MealSession): StoredMember[] {
  const meal = session.chat?.meal;
  if (meal?.phase === "setup") return [];
  const selected = meal ? new Set(meal.selectedMemberIds) : null;
  return session.members.filter(
    (member) => member.active && (!selected || selected.has(member.id)),
  );
}

/**
 * Include every selected active person in readiness, even before they opt in.
 * Filtering down to people who have joined would silently shrink consensus.
 */
export function mealReady(session: MealSession): boolean {
  const meal = session.chat?.meal;
  if (meal && meal.phase !== "collecting") return false;
  const participants = mealMembers(session);
  if (!participants.length) return false;
  const joined = meal ? new Set(meal.joinedMemberIds) : null;
  return participants.every(
    (member) =>
      member.confirmed &&
      member.preference !== null &&
      (!joined || joined.has(member.id)),
  );
}

/** Authorization callers still validate the actor capability separately. */
export function assertMealParticipant(
  session: MealSession,
  memberId: string,
): void {
  const meal = session.chat?.meal;
  if (meal?.phase === "setup") {
    throw new AppError(
      409,
      "MEAL_NOT_STARTED",
      "The host must configure and start this meal first.",
    );
  }
  const member = session.members.find(
    (candidate) => candidate.id === memberId && candidate.active,
  );
  if (!member || (meal && !meal.selectedMemberIds.includes(memberId))) {
    throw new AppError(
      403,
      "MEAL_NOT_SELECTED",
      "You are not an active selected participant in this meal.",
    );
  }
  if (meal && !meal.joinedMemberIds.includes(memberId)) {
    throw new AppError(
      409,
      "MEAL_NOT_JOINED",
      "Join this meal yourself before editing preferences or accepting an option.",
    );
  }
}
