import { z } from "zod";
import { aiStatus, extractPreferences } from "@/adapters/openai";
import { transcribeClip } from "@/adapters/transcription";
import { assertMealParticipant } from "@/domain/meal";
import { readSession } from "./database";
import { assert } from "./errors";
import { readMediaChanges } from "./preference-media";
import { readVideo } from "./video-frames";
import {
  actor,
  editable,
  requireSession,
  type Context,
} from "./session-service";

const inputSchema = z.object({
  craving: z.string().trim().max(1000),
  constraints: z.string().trim().max(1000),
  revision: z.coerce.number().int().nonnegative(),
});

export async function draftChatPreferences(
  id: string,
  form: FormData,
  context: Context,
) {
  const input = inputSchema.parse({
    craving: form.get("craving"),
    constraints: form.get("constraints"),
    revision: form.get("revision") ?? undefined,
  });
  async function currentMember() {
    const session = await readSession(id);
    requireSession(session);
    const member = actor(session, context);
    editable(session);
    assertMealParticipant(session, member.id);
    assert(
      session.chatJourney && aiStatus().available,
      503,
      "AI_UNAVAILABLE",
      "กรุณาพิมพ์คำตอบเอง",
    );
    assert(
      member.revision === input.revision,
      409,
      "STALE_MEMBER_REVISION",
      "กรุณาเปิดแบบฟอร์มใหม่",
    );
    return member;
  }
  const saved = (await currentMember()).media;
  const changes = await readMediaChanges(form);
  function selected(kind: "image" | "voice") {
    if (changes[kind] !== undefined) return changes[kind];
    const previous = saved?.[kind];
    return previous && Date.parse(previous.expiresAt) > Date.now()
      ? previous
      : null;
  }
  const image = selected("image");
  const voice = selected("voice");
  const video = form.get("video");
  const media = video ? await readVideo(video) : undefined;
  const videoTranscript = media?.audio ? (await transcribeClip(media.audio)).text : "";
  const transcript = voice ? (await transcribeClip(voice)).text : "";
  const draft = await extractPreferences({
    ...(media && { videoFrames: media.frames, videoTranscript: videoTranscript.slice(0, 4000) }),
    text: input.craving,
    formContext: {
      constraints: input.constraints,
      transcript: transcript.slice(0, 2000),
      ...(media && { pendingQuestions: z.array(z.string().max(500)).max(10).parse(form.getAll("question")) }),
    },
    imageDataUrl: image ? `data:${image.mime};base64,${image.data}` : undefined,
  });
  await currentMember();
  return { draft, transcript };
}
