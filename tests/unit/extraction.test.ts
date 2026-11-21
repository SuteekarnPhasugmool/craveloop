import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { parse, options } = vi.hoisted(() => ({
  parse: vi.fn(),
  options: vi.fn(),
}));
vi.mock("openai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("openai")>();
  class MockOpenAI {
    constructor(configuration: unknown) {
      options(configuration);
    }
    responses = { parse };
    static APIError = actual.default.APIError;
    static APIUserAbortError = actual.default.APIUserAbortError;
    static APIConnectionError = actual.default.APIConnectionError;
    static APIConnectionTimeoutError = actual.default.APIConnectionTimeoutError;
  }
  return { ...actual, default: MockOpenAI };
});
import OpenAI from "openai";
import { aiStatus, extractPreferences } from "../../src/adapters/openai";
import { routePreference } from "../../src/adapters/preference-router";
import { emptyPreference } from "../../src/contracts";
import { menuFit } from "../../src/domain/ranking";
import { catalog } from "../../src/adapters/catalog";
const draft = {
  cuisinePreferences: ["thai"],
  flavorTags: ["mild"],
  textureTags: [],
  dislikes: [],
  budgetMaxBaht: 150,
  excludedIngredients: ["pork"],
  dietaryRequirements: [],
  evidence: [
    {
      field: "excludedIngredients",
      source: "text",
      quote: "ไม่กินหมู",
      confidence: 0.9,
    },
  ],
  needsConfirmation: true,
  questions: [],
};
const complete = (value: unknown = draft) => ({
  status: "completed",
  output: [],
  output_parsed: value,
});
beforeEach(() => {
  vi.stubEnv("CRAVELOOP_OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-real-key");
  vi.stubEnv("OPENAI_MODEL", "test-configured-model");
  parse.mockReset();
  options.mockClear();
});
afterEach(() => vi.unstubAllEnvs());
it("routes feedback in one call, grounds a named dish and preserves unmentioned fields", async () => {
  const base = {
    ...emptyPreference,
    allergies: ["peanut"],
    budgetMaxSatang: 14000,
  };
  parse.mockResolvedValue(
    complete({
      intent: "change_preference",
      questions: [],
      patch: [
        {
          field: "desiredDish",
          name: "Crispy tofu rice",
          quote: "Crispy tofu rice",
        },
        { field: "flavorTags", values: ["mild"], quote: "missing evidence" },
      ],
    }),
  );
  const routed = await routePreference("อยากกิน Crispy tofu rice", base, true);
  expect(parse).toHaveBeenCalledTimes(1);
  expect(routed.preference).toEqual({
    ...base,
    desiredDish: "Crispy tofu rice",
  });
  expect(menuFit(routed.preference, catalog[0].menus[0]).score).toBeGreaterThan(
    menuFit(routed.preference, catalog[0].menus[1]).score,
  );
});
it("keeps ambiguous budgets and allergy removal separate from soft choices", async () => {
  const base = {
    ...emptyPreference,
    allergies: ["shrimp"],
    budgetMaxSatang: 12000,
  };
  parse.mockResolvedValue(
    complete({ intent: "change_preference", patch: [], questions: [] }),
  );
  const result = await routePreference(
    "งบ 100 หรือ 150 บาท ลบข้อแพ้กุ้ง",
    base,
    true,
  );
  expect(result.preference).toEqual(base);
  expect(result.questions.length).toBeGreaterThan(0);
});
describe("multimodal draft adapter (mocked provider; no live inference claim)", () => {
  it("uses the CraveLoop key for both adapters when a shell key is also present", async () => {
    vi.stubEnv("CRAVELOOP_OPENAI_API_KEY", "local-test-key");
    parse.mockResolvedValueOnce(complete());
    await extractPreferences({ text: "no pork" });
    parse.mockResolvedValueOnce(
      complete({ intent: "chat", patch: [], questions: [] }),
    );
    await routePreference("hello", emptyPreference, false);
    expect(options.mock.calls.map(([config]) => config.apiKey)).toEqual([
      "local-test-key",
      "local-test-key",
    ]);
  });
  it("reports exhausted credits without retrying or returning provider details", async () => {
    parse.mockRejectedValue(
      new OpenAI.APIError(
        429,
        {
          code: "credit_balance_exhausted",
          type: "insufficient_quota",
          message: "private upstream details",
        },
        undefined,
        new Headers(),
      ),
    );
    for (const run of [
      () => extractPreferences({ text: "no pork" }),
      () => routePreference("no pork", emptyPreference, false),
    ]) {
      await expect(run()).rejects.toMatchObject({
        code: "AI_QUOTA_EXHAUSTED",
        status: 503,
        message: expect.not.stringContaining("private upstream details"),
      });
    }
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("still retries temporary rate limiting", async () => {
    parse
      .mockRejectedValueOnce(
        new OpenAI.APIError(
          429,
          { code: "rate_limit_exceeded" },
          undefined,
          new Headers(),
        ),
      )
      .mockResolvedValueOnce(complete());
    await expect(extractPreferences({ text: "no pork" })).resolves.toEqual(
      draft,
    );
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("missing credentials reports unavailable and makes zero provider calls", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(aiStatus().available).toBe(false);
    await expect(extractPreferences({ text: "หิว" })).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      status: 503,
    });
    expect(parse).not.toHaveBeenCalled();
  });
  it("missing configured model cannot silently select a model", async () => {
    vi.stubEnv("OPENAI_MODEL", "");
    await expect(extractPreferences({ text: "หิว" })).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
    });
  });
  it("uses strict schema, configured model, no stored response and disabled SDK retries", async () => {
    parse.mockResolvedValue(complete());
    expect(await extractPreferences({ text: "ไม่กินหมู งบ 150 บาท" })).toEqual(
      draft,
    );
    expect(options).toHaveBeenCalledWith(
      expect.objectContaining({ maxRetries: 0 }),
    );
    expect(parse.mock.calls[0][0]).toMatchObject({
      model: "test-configured-model",
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
  });
  it("images are data only and never remote fetch URLs", async () => {
    await expect(
      extractPreferences({
        text: "",
        imageDataUrl: "https://example.com/image.jpg",
      }),
    ).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    expect(parse).not.toHaveBeenCalled();
  });
  it("rejects SVG and oversize data before upstream", async () => {
    await expect(
      extractPreferences({
        text: "",
        imageDataUrl: "data:image/svg+xml;base64,AAAA",
      }),
    ).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    await expect(
      extractPreferences({
        text: "",
        imageDataUrl: `data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64")}`,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_INVALID" });
    expect(parse).not.toHaveBeenCalled();
  });
  it("passes supported image content and keeps confirmation mandatory", async () => {
    parse.mockResolvedValue(complete({ ...draft, needsConfirmation: false }));
    const value = await extractPreferences({
      text: "อยากกินกรอบ",
      imageDataUrl: "data:image/png;base64,AAAA",
    });
    expect(value.needsConfirmation).toBe(true);
    expect(parse.mock.calls[0][0].input[1].content[1]).toMatchObject({
      type: "input_image",
      image_url: "data:image/png;base64,AAAA",
    });
  });
  it("rejects empty inputs and text over 2000 characters", async () => {
    await expect(extractPreferences({ text: "" })).rejects.toMatchObject({
      code: "INPUT_INVALID",
    });
    await expect(
      extractPreferences({ text: "ก".repeat(2001) }),
    ).rejects.toMatchObject({ code: "INPUT_INVALID" });
    expect(parse).not.toHaveBeenCalled();
  });
  it("rejects refusal without retrying", async () => {
    parse.mockResolvedValue({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "refusal", refusal: "private raw refusal" }],
        },
      ],
      output_parsed: null,
    });
    await expect(extractPreferences({ text: "input" })).rejects.toMatchObject({
      code: "AI_REFUSED",
      status: 502,
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("rejects incomplete response without retrying", async () => {
    parse.mockResolvedValue({ ...complete(), status: "incomplete" });
    await expect(extractPreferences({ text: "input" })).rejects.toMatchObject({
      code: "AI_INCOMPLETE",
    });
    expect(parse).toHaveBeenCalledTimes(1);
  });
  it("rejects invented controlled tags and unexpected fields", async () => {
    parse.mockResolvedValue(
      complete({ ...draft, textureTags: ["magical"], restaurant: "imagined" }),
    );
    await expect(extractPreferences({ text: "input" })).rejects.toMatchObject({
      code: "AI_INVALID_DRAFT",
    });
  });
  it("bounds oversized ingredient output", async () => {
    parse.mockResolvedValue(
      complete({ ...draft, excludedIngredients: ["x".repeat(81)] }),
    );
    await expect(extractPreferences({ text: "input" })).rejects.toMatchObject({
      code: "AI_INVALID_DRAFT",
    });
  });
  it("retries a transient timeout at most once and returns safe typed failure", async () => {
    parse.mockRejectedValue(
      new OpenAI.APIConnectionTimeoutError({
        message: "secret upstream details",
      }),
    );
    await expect(extractPreferences({ text: "input" })).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      status: 504,
    });
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("maps SDK abort from its internal deadline to timeout", async () => {
    parse.mockRejectedValue(
      new OpenAI.APIUserAbortError({ message: "deadline" }),
    );
    await expect(extractPreferences({ text: "input" })).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      status: 504,
    });
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("can recover on its one transient retry", async () => {
    parse
      .mockRejectedValueOnce(
        new OpenAI.APIConnectionError({ message: "network" }),
      )
      .mockResolvedValueOnce(complete());
    expect(await extractPreferences({ text: "input" })).toEqual(draft);
    expect(parse).toHaveBeenCalledTimes(2);
  });
  it("does not retry non-transient provider error or expose its message", async () => {
    parse.mockRejectedValue(new Error("sensitive-key and raw prompt"));
    await expect(extractPreferences({ text: "input" })).rejects.toMatchObject({
      code: "AI_UPSTREAM_ERROR",
      status: 502,
    });
    try {
      await extractPreferences({ text: "input" });
    } catch (error) {
      expect(String(error)).not.toContain("sensitive-key");
    }
    expect(parse).toHaveBeenCalledTimes(2);
  });
});
