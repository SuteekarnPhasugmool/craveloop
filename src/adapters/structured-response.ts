import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  aiStatus,
  ExtractionError,
  projectApiKey,
  quotaFailure,
} from "./openai";

export async function structuredResponse<T extends z.ZodType>(
  name: string,
  schema: T,
  instructions: string,
  data: unknown,
  model = aiStatus().model,
): Promise<z.output<T>> {
  const apiKey = projectApiKey();
  if (!apiKey || !model)
    throw new ExtractionError(
      "AI_UNAVAILABLE",
      503,
      "Configure the server OpenAI API key and model.",
    );
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 25_000 });
  try {
    const result = await client.responses.parse({
      model,
      instructions,
      input: JSON.stringify(data),
      store: false,
      max_output_tokens: 3000,
      text: { format: zodTextFormat(schema, name) },
    });
    if (result.status !== "completed") throw new Error("Incomplete response");
    return schema.parse(result.output_parsed);
  } catch (error) {
    throw (
      quotaFailure(error) ??
      new ExtractionError(
        "AI_UPSTREAM_ERROR",
        502,
        `OpenAI could not complete ${name}.`,
      )
    );
  }
}
