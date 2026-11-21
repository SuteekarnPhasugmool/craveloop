import { describe, expect, it } from "vitest";
import { emptyPreference } from "@/contracts";
import { describeAnswers, parseAnswers } from "@/domain/preference-answers";

const blank = { craving: "", constraints: "" };

describe("private chat answers", () => {
  it("keeps budget, allergies, exclusions and dislikes distinct", () => {
    expect(
      parseAnswers(
        { craving: "เส้นน้ำ", constraints: "200 บาท, แพ้กุ้งกับไข่ ไม่กินหมู ไม่ชอบเผ็ด" },
        blank,
        emptyPreference,
      ),
    ).toMatchObject({
      foodBase: "noodles",
      servingStyle: "soup",
      budgetMaxSatang: 20000,
      allergies: ["กุ้ง", "ไข่"],
      excludedIngredients: ["หมู"],
      dislikes: ["spicy"],
    });
  });
  it("retains previously confirmed constraints when only cravings change", () => {
    const base = {
      ...emptyPreference,
      allergies: ["shrimp"],
      budgetMaxSatang: 15000,
    };
    const previous = describeAnswers(base);
    const next = parseAnswers(
      { ...previous, craving: "ข้าวแห้ง" },
      previous,
      base,
    );
    expect(next).toMatchObject({
      ...base,
      foodBase: "rice",
      servingStyle: "dry",
    });
    expect(
      parseAnswers(
        { craving: previous.craving, constraints: "" },
        previous,
        base,
      ),
    ).toMatchObject({ allergies: [], budgetMaxSatang: null });
  });
  it("asks for clarification before dropping an unrecognized constraint", () => {
    expect(() =>
      parseAnswers(
        { ...blank, constraints: "งบประมาณเท่าเดิม" },
        blank,
        emptyPreference,
      ),
    ).toThrow();
    expect(() =>
      parseAnswers({ ...blank, craving: "ข้าว แพ้กุ้ง" }, blank, emptyPreference),
    ).toThrow();
  });
});
