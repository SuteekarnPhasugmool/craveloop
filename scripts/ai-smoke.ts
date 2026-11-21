import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { aiStatus, extractPreferences } from "../src/adapters/openai";
config({ path: [".env.local", ".env"], quiet: true });
async function main() {
  const status = aiStatus();
  if (!status.available) {
    console.error(
      "AI smoke test NOT RUN: configure OPENAI_API_KEY and OPENAI_MODEL on the server. Manual entry remains available.",
    );
    process.exitCode = 1;
    return;
  }
  const image = readFileSync("tests/fixtures/crispy.png");
  const start = performance.now();
  const draft = await extractPreferences({
    text: "อยากกินอะไรกรอบ ๆ ไม่กินหมู งบไม่เกิน 150 บาท",
    imageDataUrl: `data:image/png;base64,${image.toString("base64")}`,
  });
  console.log(
    JSON.stringify(
      {
        check: "LIVE text+illustration extraction, reviewed schema only",
        model: status.model,
        durationMs: Math.round(performance.now() - start),
        needsConfirmation: draft.needsConfirmation,
        budgetMaxBaht: draft.budgetMaxBaht,
        excludedIngredients: draft.excludedIngredients,
        textureTags: draft.textureTags,
        questions: draft.questions,
        limitations:
          "One self-authored illustration sample; not a photo-accuracy or safety benchmark. Application/provider retention differ; response store:false.",
      },
      null,
      2,
    ),
  );
  if (
    draft.budgetMaxBaht !== 150 ||
    !draft.excludedIngredients.includes("pork") ||
    !draft.needsConfirmation
  )
    throw new Error(
      "Smoke draft missed explicit sample fields; inspect adapter/model before demo.",
    );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AI smoke failed");
  process.exitCode = 1;
});
