import OpenAI, { toFile } from "openai";
import { ExtractionError, projectApiKey, quotaFailure } from "./openai";

const extensions: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
};

export async function transcribeClip(
  clip: { mime: string; data: string },
  range?: { startMs: number; endMs: number },
) {
  const apiKey = projectApiKey();
  if (!apiKey)
    throw new ExtractionError("AI_UNAVAILABLE", 503, "กรุณาพิมพ์คำตอบเอง");
  const extension = extensions[clip.mime];
  if (!Object.hasOwn(extensions, clip.mime))
    throw new ExtractionError("INVALID_AUDIO", 422, "รูปแบบไฟล์เสียงไม่รองรับ");
  if (
    range &&
    (!Number.isSafeInteger(range.startMs) ||
      !Number.isSafeInteger(range.endMs) ||
      range.startMs < 0 ||
      range.endMs <= range.startMs)
  )
    throw new ExtractionError("INVALID_CLIP_RANGE", 422, "ช่วงคลิปไม่ถูกต้อง");

  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 20_000 });
  try {
    const result = await client.audio.transcriptions.create({
      model: process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-transcribe",
      file: await toFile(
        Buffer.from(clip.data, "base64"),
        `clip.${extension}`,
        {
          type: clip.mime,
        },
      ),
      response_format: "json",
    });
    return { text: result.text.trim(), range };
  } catch (error) {
    throw (
      quotaFailure(error) ??
      new ExtractionError(
        "AI_TRANSCRIPTION_FAILED",
        502,
        "ถอดเสียงไม่สำเร็จ กรุณาพิมพ์คำตอบเองหรือลองอีกครั้ง",
      )
    );
  }
}
