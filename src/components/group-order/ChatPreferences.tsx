"use client";
import { useEffect, useRef, useState } from "react";
import { emptyPreference, SocialLinkSchema, type SessionView } from "@/contracts";
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
  const [socialLink, setSocialLink] = useState(session.me?.answers?.socialLink ?? "");
  const [revision] = useState(session.me!.revision);
  const [changes, setChanges] = useState<AttachmentChanges>({});
  const [mediaBusy, setMediaBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/sessions/${session.id}/preferences/me`;
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mediaBusy || saving) return;
    setError("");
    setSaving(true);
    try {
      const confirmedPreference = parseAnswers(answers, initial, base);
      const link = socialLink.trim();
      if (link && !SocialLinkSchema.safeParse(link).success)
        throw new Error("กรุณาวางลิงก์ที่ขึ้นต้นด้วย https:// หรือ http://");
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
        for (const [kind, file] of Object.entries(changes)) {
          if (file) form.set(kind, file, kind);
          else form.set(kind, "remove");
        }
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
      setSaving(false);
    }
  }
  const saved = session.me?.media;
  return (
    <dialog
      ref={dialog}
      className="chat-pref"
      aria-labelledby="chat-pref-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
    >
      <header>
        <h2 id="chat-pref-title">ความต้องการของฉัน</h2>
        <button
          type="button"
          aria-label="ปิดความต้องการของฉัน"
          disabled={saving}
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
              disabled={saving}
              value={answers.craving}
              onChange={(e) =>
                setAnswers({ ...answers, craving: e.target.value })
              }
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
              disabled={saving}
              value={answers.constraints}
              onChange={(e) =>
                setAnswers({ ...answers, constraints: e.target.value })
              }
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
            disabled={saving}
            onBusy={setMediaBusy}
            onChange={(kind, file) =>
              setChanges((old) => ({ ...old, [kind]: file }))
            }
          />
          <small className="pref-media-note">
            รูป ลิงก์ และเสียงเห็นเฉพาะคุณ โปรดพิมพ์ข้อจำกัดที่ต้องการใช้ค้นหาร้าน
          </small>
          {draft?.questions.map((q) => (
            <small key={q}>{q}</small>
          ))}
          {error && (
            <p className="go-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button className="go-primary" disabled={saving || mediaBusy}>
            {saving ? "กำลังบันทึก…" : "ยืนยันความต้องการ"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
