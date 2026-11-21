"use client";
import { useEffect, useRef, useState } from "react";
import { HomeIcon } from "./HomeIcons";
import { SocialLinkSchema } from "@/contracts";

export type AttachmentChanges = Partial<Record<"image" | "voice", Blob | null>>;

function usePreview(file: Blob | null | undefined, saved?: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const preview = URL.createObjectURL(file);
    setUrl(preview);
    return () => URL.revokeObjectURL(preview);
  }, [file]);
  return file === undefined ? saved : file ? url : undefined;
}

async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("เลือกรูป JPEG, PNG หรือ WebP");
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  try {
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    if (scale === 1 && file.size <= 4 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("อ่านรูปไม่ได้");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(Error("อ่านรูปไม่ได้"))),
        "image/jpeg",
        0.84,
      ),
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function PreferenceAttachments({
  socialLink,
  onSocialLinkChange,
  changes,
  saved,
  disabled,
  onChange,
  onBusy,
}: {
  socialLink: string;
  onSocialLinkChange: (link: string) => void;
  changes: AttachmentChanges;
  saved: Partial<Record<"image" | "voice", string>>;
  disabled: boolean;
  onChange: (kind: "image" | "voice", file: Blob | null) => void;
  onBusy: (busy: boolean) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const audioPicker = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(Boolean(socialLink));
  const linkInput = useRef<HTMLInputElement>(null);
  const link = SocialLinkSchema.safeParse(socialLink);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(false);
  const [stage, setStage] = useState<"idle" | "photo" | "mic" | "recording">(
    "idle",
  );
  const [error, setError] = useState("");
  const [pickVoice, setPickVoice] = useState(false);
  const image = usePreview(changes.image, saved.image);
  const voice = usePreview(changes.voice, saved.voice);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      const active = recorder.current;
      if (active && active.state !== "inactive") active.stop();
      active?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);
  function finish() {
    if (mounted.current) {
      setStage("idle");
      onBusy(false);
    }
  }
  async function record() {
    setError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("หน้านี้เปิดไมโครโฟนไม่ได้ เลือกไฟล์เสียงที่อัดไว้ได้");
      setPickVoice(true);
      return;
    }
    setStage("mic");
    onBusy(true);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw Error("unsupported");
      const active = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });
      recorder.current = active;
      const chunks: Blob[] = [];
      let failed = false;
      active.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      active.onerror = () => {
        failed = true;
        active.stream.getTracks().forEach((track) => track.stop());
        if (mounted.current) setError("อัดเสียงไม่สำเร็จ ลองอีกครั้ง");
      };
      active.onstop = () => {
        clearTimeout(timer.current);
        active.stream.getTracks().forEach((track) => track.stop());
        recorder.current = null;
        if (!mounted.current) return;
        const audio = new Blob(chunks, { type: active.mimeType });
        if (!failed && audio.size && audio.size <= 1024 * 1024)
          onChange("voice", audio);
        else setError("ใช้เสียงนี้ไม่ได้ กรุณาอัดใหม่ให้สั้นลง");
        finish();
      };
      active.start();
      setStage("recording");
      timer.current = setTimeout(() => {
        if (active.state === "recording") active.stop();
      }, 60000);
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      if (mounted.current) {
        setPickVoice(true);
        setError(
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "กรุณาอนุญาตให้ใช้ไมโครโฟน หรือเลือกไฟล์เสียงที่อัดไว้"
            : "เปิดไมโครโฟนไม่ได้ ลองแนบไฟล์เสียงที่อัดไว้",
        );
      }
      finish();
    }
  }
  return (
    <div className="pref-attachments">
      <input
        ref={audioPicker}
        hidden
        type="file"
        accept="audio/webm,audio/ogg,audio/mp4,.m4a"
        aria-label="เลือกไฟล์ข้อความเสียง"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (!file.size || file.size > 1024 * 1024) {
            setError("ใช้ไฟล์เสียงไม่เกิน 1 MB");
            return;
          }
          setError("");
          onChange("voice", file);
        }}
      />
      <input
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        ref={picker}
        aria-label="เลือกรูปประกอบ"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setStage("photo");
          onBusy(true);
          setError("");
          try {
            const photo = await preparePhoto(file);
            if (mounted.current) onChange("image", photo);
          } catch {
            if (mounted.current)
              setError("เปิดรูปไม่ได้ กรุณาเลือกรูป JPEG, PNG หรือ WebP");
          } finally {
            finish();
          }
        }}
      />
      <div className="pref-media-buttons">
        <button
          type="button"
          disabled={disabled || stage !== "idle"}
          onClick={() => picker.current?.click()}
        >
          <HomeIcon name="photo" />
          {stage === "photo" ? "กำลังเตรียมรูป…" : image ? "เปลี่ยนรูป" : "แนบรูป"}
        </button>
        <button type="button" disabled={disabled} aria-expanded={linkOpen}
          aria-controls="pref-social-link" onClick={() => {
            setLinkOpen(true);
            requestAnimationFrame(() => linkInput.current?.focus());
          }}>
          <HomeIcon name="link" />แนบลิงก์วิดีโอ
        </button>
        {stage === "recording" ? (
          <button
            type="button"
            className="is-recording"
            onClick={() => {
              if (recorder.current?.state === "recording")
                recorder.current.stop();
            }}
          >
            หยุดอัดเสียง
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || stage !== "idle"}
            onClick={record}
          >
            <HomeIcon name="microphone" />
            {stage === "mic"
              ? "กำลังเปิดไมค์…"
              : voice
                ? "อัดเสียงใหม่"
                : "อัดข้อความเสียง"}
          </button>
        )}
      </div>
      {linkOpen && <div className="pref-social-link" id="pref-social-link">
        <label htmlFor="pref-link-url">ลิงก์วิดีโอ</label>
        <input id="pref-link-url" ref={linkInput} type="url" inputMode="url" disabled={disabled}
          autoCapitalize="none" spellCheck={false} maxLength={8192}
          placeholder="วางลิงก์วิดีโอจาก TikTok, YouTube หรือ Reels" value={socialLink}
          onChange={e => onSocialLinkChange(e.target.value)} />
        <div>
          {link.success && <a href={link.data} target="_blank" rel="noopener noreferrer">เปิดลิงก์</a>}
          <button type="button" disabled={disabled} onClick={() => { onSocialLinkChange(""); setLinkOpen(false); }}>ลบลิงก์</button>
        </div>
      </div>}
      {pickVoice && stage === "idle" && (
        <button
          className="pref-audio-file"
          type="button"
          disabled={disabled}
          onClick={() => audioPicker.current?.click()}
        >
          แนบไฟล์เสียงที่อัดไว้
        </button>
      )}
      {stage === "recording" && (
        <small role="status">กำลังอัดเสียง · ไม่เกิน 1 นาที</small>
      )}
      {image && (
        <div className="pref-media-preview">
          <img src={image} alt="รูปประกอบความต้องการ" />
          <button
            type="button"
            disabled={disabled || stage !== "idle"}
            onClick={() => onChange("image", null)}
          >
            ลบรูป
          </button>
        </div>
      )}
      {voice && (
        <div className="pref-media-preview">
          <audio src={voice} controls aria-label="ฟังข้อความเสียง" />
          <button
            type="button"
            disabled={disabled || stage !== "idle"}
            onClick={() => onChange("voice", null)}
          >
            ลบเสียง
          </button>
        </div>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
