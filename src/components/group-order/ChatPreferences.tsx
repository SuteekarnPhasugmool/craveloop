"use client";
import { useEffect, useRef, useState } from "react";
import {
  emptyPreference,
  SocialLinkSchema,
  type PreferenceDraft,
  type SessionView,
} from "@/contracts";
import type { ChatDraft } from "@/contracts/chat";
import { describeAnswers, parseAnswers } from "@/domain/preference-answers";
import { api, RequestError } from "../api";
import PreferenceAttachments, {
  type AttachmentChanges,
} from "./PreferenceAttachments";

export default function ChatPreferences({
  session,
  draft,
  onSaved,
  onConflict,
  onClose,
}: {
  session: SessionView;
  draft?: ChatDraft;
  onSaved: (session: SessionView) => void;
  onConflict: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [base] = useState(
    draft?.preference ?? session.me?.preference ?? emptyPreference,
  );
  const [initial] = useState(() => {
    const saved = session.me?.answers;
    const formatted = describeAnswers(base);
    if (!saved) return formatted;
    if (!draft) return saved;
    const previous = describeAnswers(session.me?.preference ?? emptyPreference);
    return {
      craving:
        formatted.craving === previous.craving
          ? saved.craving
          : formatted.craving,
      constraints:
        formatted.constraints === previous.constraints
          ? saved.constraints
          : formatted.constraints,
    };
  });
  const [answers, setAnswers] = useState(initial);
  const [socialLink, setSocialLink] = useState(
    session.me?.answers?.socialLink ?? "",
  );
  const [revision] = useState(session.me!.revision);
  const [video, setVideo] = useState<File | null>(null);
  const [readLink, setReadLink] = useState(true);
  const [changes, setChanges] = useState<AttachmentChanges>({});
  const [mediaBusy, setMediaBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/sessions/${session.id}/preferences/me`;
  const usingVideo = session.ai.available && Boolean(video || (readLink && socialLink.trim()));
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  function addAttachments(form: FormData) {
    for (const [kind, file] of Object.entries(changes)) {
      if (file) form.set(kind, file, kind);
      else form.set(kind, "remove");
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mediaBusy || saving || drafting) return;
    setError("");
    setSaving(true);
    try {
      const confirmedPreference = parseAnswers(answers, initial, base);
      const link = socialLink.trim();
      if (link !== (session.me?.answers?.socialLink ?? "") || (link && !readLink)) delete confirmedPreference.videoMenuIds;
      if (link && !SocialLinkSchema.safeParse(link).success)
        throw new Error("กรุณาวางลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://");

      const hasMedia = (["image", "voice"] as const).some((kind) =>
        changes[kind] === undefined
          ? Boolean(saved?.[kind])
          : Boolean(changes[kind]),
      );
      if (
        session.ai.available &&
        (answers.craving.trim() || answers.constraints.trim() || hasMedia || video || (readLink && link))
      ) {
        setDrafting(true);
        const form = new FormData();
        form.set("craving", answers.craving);
        form.set("constraints", answers.constraints);
        form.set("revision", String(revision));
        if (video) form.set("video", video);
        else if (readLink && link) form.set("video", link);
        if (usingVideo) for (const question of draft?.questions ?? []) form.append("question", question);
        addAttachments(form);
        const { draft: extracted } = await api<{ draft: PreferenceDraft & {
          videoMenuIds?: string[];
          foodBaseAnswer?: { base: "rice" | "noodles" | "general" };
        } }>(
          `${url}/draft`,
          "POST",
          form,
        );
        for (const field of [
          "cuisinePreferences",
          "flavorTags",
          "textureTags",
        ] as const) {
          Object.assign(confirmedPreference, {
            [field]: [
              ...new Set([...confirmedPreference[field], ...extracted[field]]),
            ],
          });
        }
        if (extracted.videoMenuIds !== undefined) confirmedPreference.videoMenuIds = extracted.videoMenuIds;
        if (extracted.foodBaseAnswer) {
          const { base } = extracted.foodBaseAnswer;
          confirmedPreference.foodBase = base === "general" ? undefined : base;
          if (base !== "noodles") delete confirmedPreference.noodle;
        }
        setDrafting(false);
      }
      const save = (s: SessionView) => {
        const confirmation = {
          answers: { ...answers, socialLink: link || undefined },
          confirmedPreference,
          expectedMemberRevision: revision,
          expectedPreferenceVersion: s.preferenceVersion,
          expectedRosterVersion: s.rosterVersion,
        };
        if (!Object.keys(changes).length)
          return api<SessionView>(url, "PUT", confirmation);
        const form = new FormData();
        form.set("confirmation", JSON.stringify(confirmation));
        addAttachments(form);
        return api<SessionView>(url, "PUT", form);
      };
      const next = await save(session).catch(async (err) => {
        if (!(err instanceof RequestError) || err.code !== "STALE_VERSION")
          throw err;
        const latest = await api<SessionView>(`/api/sessions/${session.id}`);
        if (
          !latest.me ||
          latest.me.id !== session.me?.id ||
          latest.me.revision !== revision
        )
          throw err;
        return save(latest);
      });
      onSaved(next);
    } catch (err) {
      if (err instanceof RequestError && err.status === 409) {
        setError(
          "ข้อมูลกลุ่มเปลี่ยนแล้ว กรุณาตรวจคำตอบก่อนยืนยันอีกครั้ง หากแก้จากอีกหน้าต่างให้เปิดฟอร์มใหม่",
        );
        onConflict();
      } else
        setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      setDrafting(false);
      setSaving(false);
    }
  }
  const saved = session.me?.media;
  const busy = saving || drafting;
  return (
    <dialog
      ref={dialog}
      className="chat-pref"
      aria-labelledby="chat-pref-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id="chat-pref-title">ความต้องการของฉัน</h2>
        <button
          type="button"
          aria-label="ปิดความต้องการของฉัน"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <form onSubmit={submit}>
        <div className="chat-pref-body">
          <section aria-labelledby="pref-craving">
            <label id="pref-craving" htmlFor="craving-answer">
              อยากกินอะไร
            </label>
            <textarea
              id="craving-answer"
              rows={2}
              maxLength={1000}
              placeholder="เช่น ข้าว เส้นน้ำ หรือเส้นแห้ง"
              disabled={busy}
              value={answers.craving}
              onChange={(e) => {
                setAnswers({ ...answers, craving: e.target.value });
              }}
            />
          </section>
          <section aria-labelledby="pref-constraints">
            <label id="pref-constraints" htmlFor="constraint-answer">
              ข้อจำกัด
            </label>
            <textarea
              id="constraint-answer"
              rows={2}
              maxLength={1000}
              placeholder="เช่น 200 บาท, แพ้กุ้ง, ไม่กินหมู, ไม่ชอบเผ็ด"
              disabled={busy}
              value={answers.constraints}
              onChange={(e) => {
                setAnswers({ ...answers, constraints: e.target.value });
              }}
            />
          </section>
          <PreferenceAttachments
            socialLink={socialLink}
            onSocialLinkChange={setSocialLink}
            changes={changes}
            saved={{
              image: saved?.image && `${url}/media/image?v=${saved.image}`,
              voice: saved?.voice && `${url}/media/voice?v=${saved.voice}`,
            }}
            disabled={busy}
            onBusy={setMediaBusy}
            onChange={(kind, file) => {
              setChanges((old) => ({ ...old, [kind]: file }));
            }}
          />
          <small className="pref-media-note">
            {session.ai.available && <>
              <label>อ่านภาพจากคลิป MP4 หรือ WebM (ไม่เกิน 5 MB)
                <input type="file" accept="video/mp4,video/webm" disabled={busy}
                  onChange={e => {
                    const file = e.currentTarget.files?.[0];
                    if (file && file.size > 5 * 1024 * 1024) {
                      e.currentTarget.value = "";
                      setVideo(null);
                      setError("ใช้คลิปขนาดไม่เกิน 5 MB");
                    } else { setVideo(file ?? null); setError(""); }
                  }} />
              </label>
              {socialLink.trim() && !video && <label>
                <input type="checkbox" checked={readLink} disabled={busy}
                  onChange={e => setReadLink(e.target.checked)} /> อ่านภาพจากลิงก์คลิปสาธารณะ
              </label>}
              {(video || (readLink && socialLink.trim())) && <span>เมื่อยืนยัน ระบบจะส่งภาพตัวอย่างและเสียงจาก 30 วินาทีแรกของคลิปให้ OpenAI อ่านข้อความ ถอดเสียง และช่วยจับคู่เมนู</span>}
            </>}
            รูป ลิงก์ และเสียงเห็นเฉพาะคุณในกลุ่ม
            {session.ai.available &&
              " เมื่อยืนยัน ระบบจะส่งข้อความ รูป และเสียงที่เลือกไปยัง OpenAI เพื่อช่วยจับคู่เมนู กรุณาพิมพ์งบและข้อจำกัดในช่องข้อจำกัด"}
          </small>
          {!usingVideo && draft?.questions.map((q) => (
            <small key={q}>{q}</small>
          ))}
          {error && (
            <p className="go-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button className="go-primary" disabled={busy || mediaBusy}>
            {drafting
              ? "กำลังวิเคราะห์ความต้องการ…"
              : saving
                ? "กำลังบันทึก…"
                : "ยืนยันความต้องการ"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
