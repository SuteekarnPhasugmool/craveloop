import { getChat, postChat } from "./chat-service";
import { routePrivateTurn } from "./preference-router";
import {
  selectDish,
  postMeal,
  postHandoff,
  postCheckout,
} from "./group-order-service";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { cookieName, hash } from "./auth";
import { AppError, assert } from "./errors";
import { env } from "./env";
import {
  createRoom,
  joinRoom,
  getRoom,
  previewNoodles,
  mutateRoom,
  saveInput,
  extraction,
  trace,
  type Context,
} from "./session-service";
const buckets = new Map<string, { count: number; until: number }>();
function limit(key: string, max: number) {
  const time = Date.now();
  const old = buckets.get(key);
  if (!old || old.until < time) {
    buckets.set(key, { count: 1, until: time + 60000 });
  } else {
    old.count++;
    assert(
      old.count <= max,
      429,
      "RATE_LIMITED",
      "Too many requests. Wait a minute and try again.",
    );
  }
  if (buckets.size > 10000)
    for (const [k, v] of buckets) if (v.until < time) buckets.delete(k);
}
async function boundedRequest(req: NextRequest) {
  if (!req.body) return req;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.length;
    if (total > 6 * 1024 * 1024) {
      await reader.cancel();
      throw new AppError(
        413,
        "INPUT_TOO_LARGE",
        "Request exceeds the 6 MB envelope limit.",
      );
    }
    chunks.push(part.value);
  }
  return new NextRequest(req.url, {
    method: req.method,
    headers: req.headers,
    body: Buffer.concat(chunks),
  });
}
async function json(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    throw new AppError(
      400,
      "MALFORMED_JSON",
      "Request body must be valid JSON.",
    );
  }
}
function capability(req: NextRequest, id: string, key: string): Context {
  return { key, token: req.cookies.get(cookieName(id))?.value };
}
function setToken(res: NextResponse, id: string, token: string) {
  res.cookies.set(cookieName(id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(env().NEXT_PUBLIC_APP_URL).protocol === "https:",
    path: `/api/sessions/${id}`,
    maxAge: env().SESSION_TTL_HOURS * 3600,
  });
}
export async function handle(req: NextRequest, path: string[] = []) {
  const requestId = randomUUID();
  try {
    env();
    const mutation = req.method !== "GET";
    const id = path[0];
    if (id)
      assert(/^[a-f0-9-]{36}$/.test(id), 404, "NOT_FOUND", "Unknown room.");
    const key = req.headers.get("Idempotency-Key") ?? "";
    if (mutation) {
      assert(
        /^[\w-]{8,128}$/.test(key),
        400,
        "IDEMPOTENCY_REQUIRED",
        "Idempotency-Key is required.",
      );
      const origin = req.headers.get("origin");
      assert(
        !origin ||
          origin === req.nextUrl.origin ||
          (process.env.NODE_ENV === "development" &&
            origin === `http://${req.headers.get("host")}` &&
            process.env.DEV_LAN_HOSTS?.split(",").includes(
              new URL(origin).hostname,
            )) ||
          origin === new URL(env().NEXT_PUBLIC_APP_URL).origin,
        403,
        "ORIGIN_DENIED",
        "Request origin not allowed.",
      );
      assert(
        Number(req.headers.get("content-length") ?? 0) <= 6 * 1024 * 1024,
        413,
        "INPUT_TOO_LARGE",
        "Maximum upload is 5 MB.",
      );
      limit(
        `${id ?? "create"}:${req.cookies.get(cookieName(id ?? ""))?.value ?? req.headers.get("x-forwarded-for") ?? "local"}`,
        path[1] === "extractions" || path[3] === "router" ? 8 : 80,
      );
    }
    if (mutation) req = await boundedRequest(req);
    const ctx = capability(req, id ?? "", key);
    let data: unknown;
    let code = 200;
    let token: string | undefined;
    if (!id && req.method === "POST") {
      const r = await createRoom(await json(req), ctx);
      data = r.result;
      token = r.token;
      code = 201;
      const res = NextResponse.json({ data, requestId }, { status: code });
      setToken(res, r.result.sessionId, token);
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
    assert(id, 404, "NOT_FOUND", "Route not found.");
    const route = path.slice(1).join("/");
    if (!route && req.method === "GET") {
      data = await getRoom(id, ctx.token);
    } else if (route === "preferences/me/noodles" && req.method === "POST") {
      data = await previewNoodles(id, await json(req), ctx);
    } else if (route === "preferences/me/router" && req.method === "POST") {
      data = await routePrivateTurn(id, await json(req), ctx);
    } else if (route === "meal" && req.method === "POST") {
      data = await postMeal(id, await json(req), ctx);
    } else if (route === "dish" && req.method === "PUT") {
      data = await selectDish(id, await json(req), ctx);
    } else if (route === "handoff" && req.method === "POST") {
      data = await postHandoff(id, await json(req), ctx);
    } else if (route === "checkout" && req.method === "POST") {
      data = await postCheckout(id, await json(req), ctx);
    } else if (route === "chat" && req.method === "GET") {
      data = await getChat(id, ctx.token);
    } else if (route === "chat" && req.method === "POST") {
      data = await postChat(id, await json(req), ctx);
    } else if (route === "join" && req.method === "POST") {
      const r = await joinRoom(id, await json(req), ctx);
      data = r.result;
      token = r.token;
      code = 201;
    } else if (route === "inputs" && req.method === "POST") {
      let form: FormData;
      try {
        form = await req.formData();
      } catch {
        throw new AppError(
          400,
          "MALFORMED_MULTIPART",
          "Use multipart form data.",
        );
      }
      const memberId = String(form.get("memberId") ?? "");
      const kind = String(form.get("kind") ?? "text");
      const text = String(form.get("text") ?? "");
      const inputRevision = Number(form.get("inputRevision"));
      assert(
        /^[a-f0-9-]{36}$/.test(memberId) &&
          ["text", "image", "screenshot"].includes(kind) &&
          Number.isSafeInteger(inputRevision) &&
          inputRevision > 0 &&
          text.length <= 2000,
        422,
        "INVALID_INPUT",
        "Check member, input revision and text (maximum 2000 characters).",
      );
      let imageDataUrl: string | undefined;
      const file = form.get("image");
      if (file instanceof File) {
        assert(
          ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
            file.size > 0 &&
            file.size <= 5 * 1024 * 1024,
          422,
          "INVALID_IMAGE",
          "Upload a JPEG, PNG or WebP up to 5 MB.",
        );
        try {
          const bytes = Buffer.from(await file.arrayBuffer());
          const image = sharp(bytes, {
            limitInputPixels: 1600 * 1600,
            animated: false,
          });
          const meta = await image.metadata();
          assert(
            meta.width &&
              meta.height &&
              Math.max(meta.width, meta.height) <= 1600 &&
              ["jpeg", "png", "webp"].includes(meta.format ?? "") &&
              (!meta.pages || meta.pages === 1),
            422,
            "INVALID_IMAGE",
            "Image must be a single frame up to 1600 pixels.",
          );
          const decoded = await image.rotate().webp().toBuffer();
          imageDataUrl = `data:image/webp;base64,${decoded.toString("base64")}`;
        } catch (e) {
          if (e instanceof AppError) throw e;
          throw new AppError(
            422,
            "INVALID_IMAGE",
            "Image could not be decoded. Use a smaller JPEG, PNG or WebP.",
          );
        }
      }
      assert(
        kind === "text" || imageDataUrl,
        422,
        "IMAGE_REQUIRED",
        "Choose an image for this input.",
      );
      assert(
        text.trim() || imageDataUrl,
        422,
        "EMPTY_INPUT",
        "Enter text or an image.",
      );
      const expiry = new Date(
        Math.min(
          Date.now() + env().UPLOAD_TTL_MINUTES * 60000,
          Date.now() + env().SESSION_TTL_HOURS * 3600000,
        ),
      ).toISOString();
      data = await saveInput(
        id,
        {
          memberId,
          kind: kind as "text" | "image" | "screenshot",
          text,
          inputRevision,
          ...(imageDataUrl ? { imageDataUrl, imageExpiresAt: expiry } : {}),
        },
        ctx,
      );
      code = 201;
    } else if (route === "extractions" && req.method === "POST") {
      data = await extraction(id, await json(req), ctx);
    } else if (route === "trace" && req.method === "GET") {
      data = await trace(id, ctx);
    } else {
      const actions: Record<string, Parameters<typeof mutateRoom>[1]> = {
        "PUT preferences/me": "confirm",
        "PATCH ": "patch",
        "POST rank": "rank",
        "PUT acceptance/me": "accept",
        "DELETE acceptance/me": "withdraw",
        "POST finalize": "finalize",
      };
      const action = actions[`${req.method} ${route}`];
      assert(action, 404, "NOT_FOUND", "Route not found.");
      data = await mutateRoom(id, action, await json(req), ctx);
    }
    const res = NextResponse.json({ data, requestId }, { status: code });
    if (token) setToken(res, id, token);
    res.headers.set("Cache-Control", "no-store");
    if (req.method === "GET" && route === "")
      res.headers.set("ETag", `"${hash(JSON.stringify(data))}"`);
    return res;
  } catch (e) {
    if (e instanceof ZodError)
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Some fields are invalid.",
            details: e.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          },
          requestId,
        },
        { status: 422 },
      );
    const known = e as { status?: number; code?: string; message?: string };
    const safe =
      e instanceof AppError ||
      (typeof known.status === "number" &&
        typeof known.code === "string" &&
        /^(AI_|EXTRACTION_|UPSTREAM_)/.test(known.code));
    if (!safe)
      console.error(
        JSON.stringify({
          requestId,
          code: "INTERNAL_ERROR",
          type: e instanceof Error ? e.name : "unknown",
        }),
      );
    return NextResponse.json(
      {
        error: {
          code: safe ? known.code : "INTERNAL_ERROR",
          message: safe
            ? known.message
            : "Something went wrong. Please retry or refresh.",
        },
        requestId,
      },
      { status: safe ? known.status : 500 },
    );
  }
}
