import sharp from "sharp";
import { createHash } from "node:crypto";
import { AppError, assert } from "./errors";
import type { StoredMedia } from "./state";

export type MediaChanges = Partial<
  Record<"image" | "voice", Omit<StoredMedia, "expiresAt"> | null>
>;

export async function decodeImage(file: File) {
  assert(
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      file.size > 0 &&
      file.size <= 5 * 1024 * 1024,
    422,
    "INVALID_IMAGE",
    "ใช้ภาพ JPEG, PNG หรือ WebP ไม่เกิน 5 MB",
  );
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
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
      "ใช้ภาพนิ่งขนาดไม่เกิน 1600 พิกเซล",
    );
    return await image.rotate().webp().toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(422, "INVALID_IMAGE", "อ่านรูปไม่สำเร็จ กรุณาเลือกรูปใหม่");
  }
}

export async function readMediaChanges(form: FormData) {
  const changes: MediaChanges = {};
  for (const kind of ["image", "voice"] as const) {
    const file = form.get(kind);
    if (file === null) continue;
    if (file === "remove") {
      changes[kind] = null;
      continue;
    }
    assert(file instanceof File, 422, "INVALID_FILE", "กรุณาเลือกไฟล์อีกครั้ง");
    let bytes: Buffer;
    let mime: string;
    if (kind === "image") {
      bytes = await decodeImage(file);
      mime = "image/webp";
    } else {
      assert(
        file.size > 0 && file.size <= 1024 * 1024,
        422,
        "INVALID_AUDIO",
        "ข้อความเสียงต้องมีขนาดไม่เกิน 1 MB",
      );
      bytes = Buffer.from(await file.arrayBuffer());
      mime = file.type.split(";")[0];
      if (mime === "audio/x-m4a" || mime === "audio/m4a") mime = "audio/mp4";
      const valid =
        (mime === "audio/webm" &&
          bytes.subarray(0, 4).toString("hex") === "1a45dfa3") ||
        (mime === "audio/ogg" && bytes.toString("ascii", 0, 4) === "OggS") ||
        (mime === "audio/mp4" && bytes.toString("ascii", 4, 8) === "ftyp");
      assert(valid, 422, "INVALID_AUDIO", "อ่านข้อความเสียงไม่สำเร็จ กรุณาอัดใหม่");
    }
    changes[kind] = {
      id: createHash("sha256").update(bytes).digest("hex"),
      mime,
      data: bytes.toString("base64"),
    };
  }
  return changes;
}
