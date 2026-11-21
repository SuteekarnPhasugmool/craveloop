import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { AppError, assert } from "./errors";

const run = promisify(execFile);
const MiB = 1024 * 1024;

// Only pass canonical, single-video platform URLs to the downloader.
export function videoSource(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.replace(/^www\./, "");
  if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
    const id = host === "youtu.be" ? url.pathname.slice(1)
      : url.pathname === "/watch" ? url.searchParams.get("v")
      : /^\/shorts\/([\w-]+)\/?$/.exec(url.pathname)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) return "https://www.youtube.com/watch?v=" + id;
  }
  if (host === "instagram.com" && /^\/(?:reel|p)\/[\w-]+\/?$/.test(url.pathname))
    return "https://www.instagram.com" + url.pathname;
  if (host === "tiktok.com" && /^\/@[\w.]+\/video\/\d+\/?$/.test(url.pathname))
    return "https://www.tiktok.com" + url.pathname;
  if (["vm.tiktok.com", "vt.tiktok.com"].includes(host) && /^\/[\w-]+\/?$/.test(url.pathname))
    return "https://" + host + url.pathname;
  if (host === "tiktok.com" && /^\/t\/[\w-]+\/?$/.test(url.pathname))
    return "https://www.tiktok.com" + url.pathname;
  return null;
}

export async function readVideo(source: FormDataEntryValue) {
  let bytes: Buffer;
  if (typeof source === "string") {
    const url = videoSource(source);
    assert(url, 422, "VIDEO_LINK_INVALID", "ใช้ลิงก์เต็มของคลิป YouTube, TikTok หรือ Instagram Reel");
    try {
      const result = await run(process.env.YT_DLP_PATH || "yt-dlp", [
        "--ignore-config", "--js-runtimes", "node", "--no-playlist", "--no-progress", "--no-cache-dir", "--no-part",
        "--no-write-info-json", "--socket-timeout", "10", "--retries", "0",
        "--match-filter", "!is_live", "--max-filesize", "25M",
        "-f", "best[ext=mp4][height<=720]/best[ext=mp4]/best[ext=webm]/bestvideo[ext=mp4][height<=720]", "-o", "-", "--", url,
      ], { encoding: "buffer", timeout: 45000, maxBuffer: 25 * MiB, windowsHide: true });
      bytes = result.stdout;
    } catch {
      throw new AppError(422, "VIDEO_DOWNLOAD_FAILED", "เปิดคลิปสาธารณะไม่ได้ กรุณาแนบไฟล์วิดีโอแทน");
    }
  } else {
    assert(source.size > 0 && source.size <= 5 * MiB, 422, "VIDEO_SIZE", "ใช้คลิปขนาดไม่เกิน 5 MB");
    bytes = Buffer.from(await source.arrayBuffer());
  }
  const mp4 = bytes.toString("ascii", 4, 8) === "ftyp";
  const webm = bytes.subarray(0, 4).toString("hex") === "1a45dfa3";
  assert(mp4 || webm, 422, "VIDEO_FORMAT", "ใช้ไฟล์ MP4 หรือ WebM");
  const dir = await mkdtemp(join(tmpdir(), "craveloop-video-"));
  try {
    const path = join(dir, "clip");
    await writeFile(path, bytes);
    // Adapted from codex-video-vision's ffmpeg frame extractor. Sample the first
    // 30 seconds into one image so the existing preference model can read it.
    const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
    const input = [
      "-nostdin", "-v", "error", "-protocol_whitelist", "file", "-f", mp4 ? "mov" : "matroska",
      "-threads", "1", "-t", "30", "-i", path,
    ];
    const { stdout } = await run(ffmpeg, [...input, "-map", "0:v:0", "-an",
      "-vf", "select=isnan(prev_selected_t)+gte(t-prev_selected_t\\,5),scale=640:640:force_original_aspect_ratio=decrease,pad=640:640:(ow-iw)/2:(oh-ih)/2,tile=3x2",
      "-frames:v", "1", "-c:v", "mjpeg", "-f", "image2pipe", "pipe:1",
    ], { encoding: "buffer", timeout: 20000, maxBuffer: 3 * MiB, windowsHide: true });
    if (!stdout.length) throw Error("No video frames");
    let audio;
    try {
      const result = await run(ffmpeg, [...input, "-vn", "-map", "0:a:0", "-ac", "1", "-ar", "16000",
        "-af", "silenceremove=start_periods=1:start_threshold=-55dB", "-f", "wav", "pipe:1"],
        { encoding: "buffer", timeout: 20000, maxBuffer: MiB, windowsHide: true });
      if (result.stdout.length > 3200) audio = { mime: "audio/wav", data: result.stdout.toString("base64") };
    } catch (err) {
      if (!String((err as { stderr?: Buffer }).stderr).includes("matches no streams")) throw err;
    }
    return { frames: "data:image/jpeg;base64," + stdout.toString("base64"), audio };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT")
      throw new AppError(503, "VIDEO_UNAVAILABLE", "เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง FFmpeg");
    throw new AppError(422, "VIDEO_DECODE_FAILED", "อ่านภาพในคลิปไม่ได้ กรุณาลองคลิปอื่น");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
