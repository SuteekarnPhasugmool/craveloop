"use client";
import { useEffect, useRef, useState } from "react";
import {
  cuisineTags,
  flavorTags,
  textureTags,
  emptyPreference,
  type Preference,
  type PreferenceDraft,
  type SessionView,
} from "@/contracts";
import { api } from "./api";
const split = (value: string) => [
  ...new Set(
    value
      .split(/[,，\n]/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean),
  ),
];
const tagNames: Record<string, string> = {
  thai: "Thai · ไทย",
  japanese: "Japanese",
  korean: "Korean",
  chinese: "Chinese",
  western: "Western",
  indian: "Indian",
  other: "Other",
  spicy: "Spicy · เผ็ด",
  savory: "Savory · เค็มกลมกล่อม",
  sweet: "Sweet",
  sour: "Sour",
  mild: "Mild · รสอ่อน",
  crispy: "Crispy · กรอบ",
  brothy: "Brothy · น้ำซุป",
  grilled: "Grilled",
  creamy: "Creamy",
  fresh: "Fresh",
  chewy: "Chewy · เส้นหนึบ",
};
async function resize(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Source image is too large. Choose an image under 25 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Unable to resize image."))),
      "image/jpeg",
      0.85,
    ),
  );
  if (blob.size > 5 * 1024 * 1024)
    throw new Error("Resized image must be under 5 MB.");
  return new File([blob], "craving.jpg", { type: "image/jpeg" });
}
export default function PreferenceForm({
  session,
  onSaved,
  onError,
}: {
  session: SessionView;
  onSaved: (s: SessionView) => void;
  onError: (e: unknown) => void;
}) {
  const me = session.me!;
  const [editing, setEditing] = useState(!me.confirmed);
  const [pref, setPref] = useState<Preference>(
    me.preference ?? emptyPreference,
  );
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState<PreferenceDraft | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [notice, setNotice] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [budget, setBudget] = useState(
    me.preference?.budgetMaxSatang == null
      ? ""
      : String(me.preference.budgetMaxSatang / 100),
  );
  const [excluded, setExcluded] = useState(
    me.preference?.excludedIngredients.join(", ") ?? "",
  );
  const [diet, setDiet] = useState(
    me.preference?.dietaryRequirements.join(", ") ?? "",
  );
  const [allergies, setAllergies] = useState(
    me.preference?.allergies.join(", ") ?? "",
  );
  const [dislikes, setDislikes] = useState(
    me.preference?.dislikes.join(", ") ?? "",
  );
  // A response may only propose a draft for the form revision it actually read.
  const editGeneration = useRef(0);
  // Explicit form fields always take precedence over model suggestions.
  const explicit = useRef(new Set<string>());
  const baseRevision = useRef(me.revision);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function touched(field?: string) {
    editGeneration.current++;
    setReviewed(false);
    if (field) explicit.current.add(field);
  }
  function tags(
    key: "cuisinePreferences" | "flavorTags" | "textureTags",
    tag: string,
  ) {
    touched();
    setPref(
      (p) =>
        ({
          ...p,
          [key]: p[key].includes(tag as never)
            ? p[key].filter((t) => t !== tag)
            : [...p[key], tag],
        }) as Preference,
    );
  }
  async function chooseImage(file?: File) {
    if (!file) return;
    touched();
    setBusy("image");
    try {
      const next = await resize(file);
      setImage(next);
      setPreview(URL.createObjectURL(next));
    } catch (e) {
      onError(e);
    } finally {
      setBusy("");
    }
  }
  async function extract() {
    setBusy("extract");
    setNotice("");
    const generation = editGeneration.current;
    try {
      const form = new FormData();
      form.set("memberId", me.id);
      form.set("kind", image ? "image" : "text");
      form.set("text", text);
      form.set("inputRevision", String(Date.now()));
      if (image) form.set("image", image);
      const input = await api<{ inputId: string; inputRevision: number }>(
        `/api/sessions/${session.id}/inputs`,
        "POST",
        form,
      );
      const result = await api<{
        draftId: string;
        draft: PreferenceDraft;
        sourceRevision: number;
      }>(`/api/sessions/${session.id}/extractions`, "POST", input);
      if (generation !== editGeneration.current) {
        setNotice(
          "Your form changed while AI was working. The old draft was discarded; your edits are preserved.",
        );
        return;
      }
      const d = result.draft;
      setDraft(d);
      setDraftId(result.draftId);
      setPref((p) => ({
        ...p,
        cuisinePreferences: d.cuisinePreferences,
        flavorTags: d.flavorTags,
        textureTags: d.textureTags,
      }));
      if (!explicit.current.has("budget"))
        setBudget(d.budgetMaxBaht === null ? "" : String(d.budgetMaxBaht));
      if (!explicit.current.has("excluded"))
        setExcluded(d.excludedIngredients.join(", "));
      if (!explicit.current.has("diet"))
        setDiet(d.dietaryRequirements.join(", "));
      if (!explicit.current.has("dislikes")) setDislikes(d.dislikes.join(", "));
      setReviewed(false);
      setNotice("AI draft ready. Check every field below before confirming.");
    } catch (e) {
      onError(e);
    } finally {
      setBusy("");
    }
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewed) return;
    setBusy("confirm");
    try {
      if ((text.trim() || image) && !draftId) {
        const form = new FormData();
        form.set("memberId", me.id);
        form.set("kind", image ? "image" : "text");
        form.set("text", text);
        form.set("inputRevision", String(Date.now()));
        if (image) form.set("image", image);
        await api(`/api/sessions/${session.id}/inputs`, "POST", form);
      }
      const confirmedPreference: Preference = {
        ...pref,
        budgetMaxSatang:
          budget === "" ? null : Math.round(Number(budget) * 100),
        excludedIngredients: split(excluded),
        dietaryRequirements: split(diet),
        allergies: split(allergies),
        dislikes: split(dislikes),
      };
      const updated = await api<SessionView>(
        `/api/sessions/${session.id}/preferences/me`,
        "PUT",
        {
          confirmedPreference,
          expectedMemberRevision: baseRevision.current,
          expectedPreferenceVersion: session.preferenceVersion,
          expectedRosterVersion: session.rosterVersion,
          ...(draftId ? { draftId } : {}),
        },
      );
      baseRevision.current = updated.me!.revision;
      onSaved(updated);
      setEditing(false);
      explicit.current.clear();
      setDraft(null);
      setDraftId(undefined);
    } catch (e) {
      onError(e);
    } finally {
      setBusy("");
    }
  }
  function openEdit() {
    baseRevision.current = me.revision;
    const p = me.preference ?? emptyPreference;
    setPref(p);
    setBudget(
      p.budgetMaxSatang === null ? "" : String(p.budgetMaxSatang / 100),
    );
    setExcluded(p.excludedIngredients.join(", "));
    setDiet(p.dietaryRequirements.join(", "));
    setAllergies(p.allergies.join(", "));
    setDislikes(p.dislikes.join(", "));
    explicit.current = new Set(["budget", "excluded", "diet", "dislikes"]);
    setReviewed(false);
    setEditing(true);
  }
  if (!editing)
    return (
      <section className="card confirmed-card">
        <span className="confirmation-check">✓</span>
        <div>
          <p className="eyebrow">YOUR SEAT IS READY</p>
          <h2>{me.displayName}’s preferences</h2>
          <p className="muted">
            Budget{" "}
            {me.preference?.budgetMaxSatang == null
              ? "not set"
              : `฿${me.preference.budgetMaxSatang / 100}`}{" "}
            ·{" "}
            {[
              ...(me.preference?.textureTags ?? []),
              ...(me.preference?.flavorTags ?? []),
            ].join(", ") || "Open to any craving"}
          </p>
        </div>
        <button
          className="secondary"
          onClick={openEdit}
          disabled={session.status === "finalized"}
        >
          Change preferences
        </button>
      </section>
    );
  return (
    <section className="card preference-card">
      <div className="section-top">
        <div>
          <p className="eyebrow">YOUR CRAVINGS</p>
          <h2>A meal that feels like you.</h2>
        </div>
        <span className="section-number">02</span>
      </div>
      <p className="muted">บอกสิ่งที่อยากกิน แล้วตรวจและยืนยันเงื่อนไขด้วยตัวเอง</p>
      <label htmlFor="craving-text">What are you craving?</label>
      <textarea
        id="craving-text"
        maxLength={2000}
        value={text}
        onChange={(e) => {
          touched();
          setText(e.target.value);
        }}
        placeholder="อยากกินอะไรกรอบ ๆ งบ 180 / Something crispy, please"
        rows={3}
      />
      <div className="image-row">
        <label className="image-upload" htmlFor="craving-image">
          <span>＋</span> Add food photo / screenshot
          <input
            id="craving-image"
            type="file"
            disabled={!!busy}
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void chooseImage(e.target.files?.[0])}
          />
        </label>
        {preview && (
          <div className="image-preview">
            <img src={preview} alt="Your uploaded craving" />
            <button
              aria-label="Remove image"
              disabled={!!busy}
              onClick={() => {
                touched();
                setImage(null);
                setPreview(null);
              }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      <div className={`ai-state ${session.ai.available ? "available" : ""}`}>
        <span>
          {session.ai.available
            ? "✧ AI extraction available"
            : "○ Manual mode · AI unavailable"}
        </span>
        <p>
          {session.ai.available
            ? "AI suggests an editable draft. Photos cannot establish ingredients or dietary safety."
            : "You can complete the whole room using the fields below. No AI inference is being performed."}
        </p>
      </div>
      <button
        className="secondary full"
        type="button"
        disabled={!session.ai.available || !!busy || (!text.trim() && !image)}
        onClick={() => void extract()}
      >
        {busy === "extract" ? "Reading your input…" : "Create AI draft"}{" "}
        <span>✧</span>
      </button>
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {draft && (
        <div className="draft-evidence">
          <strong>Draft review · confirmation required</strong>
          {draft.questions.map((q, i) => (
            <p key={i}>{q}</p>
          ))}
          <details>
            <summary>AI evidence & uncertainty</summary>
            {draft.evidence.map((ev, i) => (
              <p key={i}>
                <b>{ev.field}</b> · {ev.source} · confidence heuristic{" "}
                {Math.round(ev.confidence * 100)}%
                {ev.quote ? ` · ${ev.quote}` : ""}
              </p>
            ))}
          </details>
        </div>
      )}
      <form onSubmit={confirm}>
        <div className="form-divider">
          <span>REVIEW & CONFIRM YOUR FIELDS</span>
        </div>
        <fieldset>
          <legend>Cuisine preferences</legend>
          <div className="tag-grid">
            {cuisineTags.map((t) => (
              <button
                key={t}
                type="button"
                className="tag"
                aria-pressed={pref.cuisinePreferences.includes(t)}
                onClick={() => tags("cuisinePreferences", t)}
              >
                {tagNames[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Flavors</legend>
          <div className="tag-grid">
            {flavorTags.map((t) => (
              <button
                key={t}
                type="button"
                className="tag"
                aria-pressed={pref.flavorTags.includes(t)}
                onClick={() => tags("flavorTags", t)}
              >
                {tagNames[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Textures</legend>
          <div className="tag-grid">
            {textureTags.map((t) => (
              <button
                key={t}
                type="button"
                className="tag"
                aria-pressed={pref.textureTags.includes(t)}
                onClick={() => tags("textureTags", t)}
              >
                {tagNames[t]}
              </button>
            ))}
          </div>
        </fieldset>
        <label htmlFor="budget">Budget (THB)</label>
        <div className="money-input">
          <span>฿</span>
          <input
            id="budget"
            inputMode="decimal"
            type="number"
            min="0"
            max="100000"
            step="0.01"
            value={budget}
            onChange={(e) => {
              touched("budget");
              setBudget(e.target.value);
            }}
            placeholder="No maximum"
          />
        </div>
        <p className="field-hint">
          Maximum total per person, including your allocated delivery fees.
          Blank = no maximum.
        </p>
        <label htmlFor="exclusions">Exclude ingredients</label>
        <input
          id="exclusions"
          value={excluded}
          onChange={(e) => {
            touched("excluded");
            setExcluded(e.target.value);
          }}
          placeholder="pork, shrimp"
        />
        <p className="field-hint">
          Hard exclusions. Use English catalog names, separated by commas: pork
          = หมู, shrimp = กุ้ง, peanut = ถั่วลิสง.
        </p>
        <label htmlFor="diet">Dietary requirements</label>
        <input
          id="diet"
          value={diet}
          onChange={(e) => {
            touched("diet");
            setDiet(e.target.value);
          }}
          placeholder="vegetarian"
        />
        <div className="quick-options">
          <button
            type="button"
            className="text-button"
            onClick={() => {
              touched("diet");
              setDiet(
                diet
                  .split(",")
                  .map((x) => x.trim())
                  .includes("vegetarian")
                  ? diet
                      .split(",")
                      .map((x) => x.trim())
                      .filter((x) => x !== "vegetarian")
                      .join(", ")
                  : [diet, "vegetarian"].filter(Boolean).join(", "),
              );
            }}
          >
            + Vegetarian / มังสวิรัติ
          </button>
        </div>
        <p className="field-hint">
          Only menus with explicit catalog evidence qualify. Unknown
          requirements have no assumed evidence.
        </p>
        <label htmlFor="allergies">
          Allergies requiring cross-contact evidence
        </label>
        <input
          id="allergies"
          value={allergies}
          onChange={(e) => {
            touched("allergies");
            setAllergies(e.target.value);
          }}
          placeholder="peanut"
        />
        <p className="field-hint">
          Strict verified absence and cross-contact evidence are required. Demo
          evidence is fictional, not a medical safety guarantee.
        </p>
        <label htmlFor="dislikes">Soft dislikes</label>
        <input
          id="dislikes"
          value={dislikes}
          onChange={(e) => {
            touched("dislikes");
            setDislikes(e.target.value);
          }}
          placeholder="sweet, creamy"
        />
        <p className="field-hint">
          Lowers preference fit; use hard exclusions above for ingredients you
          cannot eat.
        </p>
        <label className="check-label">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
            required
          />
          <span>
            I reviewed these preferences and confirm them. My menu, cost, and
            fit will be visible to this room; raw restrictions stay on my form.
          </span>
        </label>
        <button
          className="primary full"
          type="submit"
          disabled={!!busy || !reviewed || session.status === "finalized"}
        >
          {busy === "confirm"
            ? "Saving your preferences…"
            : me.confirmed
              ? "Confirm changes & replan"
              : "Confirm my preferences"}{" "}
          <span>✓</span>
        </button>
        {me.confirmed && (
          <button
            className="text-button full"
            type="button"
            disabled={!!busy}
            onClick={() => setEditing(false)}
          >
            Cancel editing
          </button>
        )}
      </form>
    </section>
  );
}
