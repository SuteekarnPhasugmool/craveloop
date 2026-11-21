"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Option, SessionView } from "@/contracts";
import { api, money, RequestError } from "./api";
import PreferenceForm from "./PreferenceForm";
const statusNames = {
  collecting: "Gathering cravings",
  ranking: "Finding your meals",
  voting: "Time to agree",
  finalized: "Your table is decided",
};
const rejectionNames: Record<string, string> = {
  UNKNOWN_RESTRICTION:
    "Restriction is not recognized by the catalog; please clarify it",
  BUDGET_EXCEEDED: "Total exceeds a member’s budget",
  PRICE_UNKNOWN: "Price not known",
  INGREDIENTS_UNKNOWN: "Ingredient list is incomplete",
  EXCLUSION_PRESENT: "Excluded ingredient is present",
  DIET_UNVERIFIED: "Required dietary evidence missing",
  CROSS_CONTACT_UNKNOWN: "Cross-contact evidence missing",
  CHANNEL_UNAVAILABLE: "Unavailable in this mode",
  NO_AVAILABLE_MENU: "No available menu",
  RESTAURANT_UNAVAILABLE: "Restaurant unavailable",
  FEE_UNKNOWN: "Delivery quote missing",
};
export default function Room({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [joinName, setJoinName] = useState("");
  const [connected, setConnected] = useState(true);
  const [refreshCount, setRefreshCount] = useState(0);
  // Discard polling reads begun before a successful mutation updates this view.
  const mutation = useRef(0);
  const failures = useRef(0);
  const joiningId = useRef<string | null>(null);
  const base = `/api/sessions/${sessionId}`;
  const refresh = useCallback(async () => {
    const generation = mutation.current;
    try {
      const s = await api<SessionView>(base);
      if (generation === mutation.current) setSession(s);
      setConnected(true);
      failures.current = 0;
      return s;
    } catch (e) {
      setConnected(false);
      failures.current++;
      if (!session)
        setError(e instanceof Error ? e.message : "Unable to load room");
      return null;
    }
  }, [base, session === null]);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (document.visibilityState === "visible") {
        await refresh();
      }
      if (!stopped)
        timer = setTimeout(
          poll,
          Math.min(15000, 2000 * 2 ** Math.min(failures.current, 3)),
        );
    }
    void poll();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh, refreshCount]);
  async function handleError(e: unknown) {
    setError(
      e instanceof RequestError
        ? `${e.message}${e.status === 409 ? " The room changed. Latest state has been refreshed; review and try again." : ""}`
        : e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
    );
    await refresh();
  }
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    label: string,
  ) {
    setBusy(label);
    setError("");
    mutation.current++;
    try {
      const next = await api<SessionView>(base + path, method, body);
      setSession(next);
      return next;
    } catch (e) {
      await handleError(e);
      return null;
    } finally {
      mutation.current++;
      setBusy("");
    }
  }
  function versions() {
    return {
      expectedPreferenceVersion: session!.preferenceVersion,
      expectedRosterVersion: session!.rosterVersion,
    };
  }
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy("join");
    setError("");
    try {
      joiningId.current ??= crypto.randomUUID();
      await api(base + "/join", "POST", {
        displayName: joinName,
        clientJoinId: joiningId.current,
      });
      await refresh();
    } catch (e) {
      await handleError(e);
    } finally {
      setBusy("");
    }
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice(label);
      setTimeout(() => setCopyNotice(""), 3500);
    } catch {
      setCopyNotice(
        "Copy is unavailable in this browser. Select and copy the visible text or address bar.",
      );
    }
  }
  function choiceBody(option: Option) {
    return {
      ...versions(),
      rankingId: session!.ranking!.id,
      restaurantId: option.restaurantId,
    };
  }
  function summary(option: Option) {
    return [
      `CraveLoop · Synthetic demo catalog`,
      option.restaurantName,
      session!.mode === "delivery" ? "Delivery · synthetic quote" : "Dine in",
      ...option.assignments.map(
        (a) =>
          `${session!.members.find((m) => m.id === a.memberId)?.displayName ?? "Member"}: ${a.menuName} (${a.menuId}) · ${money(a.totalCostSatang)}`,
      ),
      `Group total: ${money(option.totalGroupCostSatang)}`,
      `Preference fit: ${option.groupScore.toFixed(1)} = 60% mean + 40% minimum`,
      window.location.href,
      "Fictional venues, prices and dietary evidence. No order placed.",
    ].join("\n");
  }
  if (!session)
    return (
      <div className="room-shell">
        <Header />
        <main className="loading-screen">
          <div className="spinner" />
          <h1>Opening your loop…</h1>
          {error && (
            <>
              <p role="alert" className="error">
                {error}
              </p>
              <button
                className="secondary"
                onClick={() => setRefreshCount((n) => n + 1)}
              >
                Try again
              </button>
              <a href="/">Create a new room</a>
            </>
          )}
        </main>
      </div>
    );
  const active = session.members.filter((m) => m.active);
  const ready = active.filter((m) => m.confirmed).length;
  const finalOption = session.ranking?.options.find(
    (o) => o.restaurantId === session.finalizedOptionId,
  );
  const allConfirmed = active.length > 0 && ready === active.length;
  const mine = session.acceptances.find((a) => a.memberId === session.me?.id);
  const rejections = Object.entries(
    (session.ranking?.rejections ?? []).reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r.code]: (acc[r.code] ?? 0) + 1 }),
      {},
    ),
  );
  return (
    <div className="room-shell">
      <Header />
      <main className="room-main">
        <a className="secondary" href={`/line/${sessionId}`}>เปิดแชท LINE จำลอง ↗</a>
        <div className="room-heading">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> YOUR SHARED TABLE{" "}
              <span className="room-code">{sessionId.slice(0, 8)}</span>
            </div>
            <h1>
              {statusNames[session.status]}
              <span className="brand-dot">.</span>
            </h1>
            <p className="muted">
              Bangkok demo neighborhood ·{" "}
              {session.mode === "delivery" ? "Delivery" : "Dine in"} · Version{" "}
              {session.preferenceVersion}/{session.rosterVersion}
            </p>
          </div>
          <button
            className="secondary"
            onClick={() =>
              void copy(window.location.href, "Invite link copied")
            }
          >
            Copy invite link <span>↗</span>
          </button>
        </div>
        <div className="demo-notice">
          <span className="demo-badge">SYNTHETIC CATALOG</span>
          <p>
            Fictional restaurants, menus, prices, and evidence. No real booking,
            navigation, or ordering.
          </p>
        </div>
        {!connected && (
          <p className="notice" role="status">
            Connection interrupted. Showing the last saved room; reconnecting…
          </p>
        )}
        {copyNotice && (
          <p role="status" className="toast">
            {copyNotice}
          </p>
        )}
        {error && (
          <div className="error error-banner" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              ×
            </button>
          </div>
        )}
        {session.lastChange && (
          <p className="change-notice" role="status">
            <span>↻</span> {session.lastChange}{" "}
            <span>Current votes: {session.acceptances.length}</span>
          </p>
        )}
        <div className="room-grid">
          <aside className="room-sidebar">
            <section className="card roster-card">
              <div className="section-top">
                <div>
                  <p className="eyebrow">THE PEOPLE</p>
                  <h2>
                    Your table{" "}
                    <span className="count-pill">
                      {active.length}/{session.expectedSize}
                    </span>
                  </h2>
                </div>
                <span className="section-number">01</span>
              </div>
              <div className="readiness-bar">
                <span
                  style={{
                    width: `${active.length ? (ready / active.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="field-hint">
                {ready} of {active.length} members confirmed
              </p>
              <ul className="member-list">
                {session.members.map((member, i) => (
                  <li
                    key={member.id}
                    className={!member.active ? "inactive" : ""}
                  >
                    <span className={`avatar avatar-${i % 4}`}>
                      {member.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>
                        {member.displayName}
                        {member.id === session.me?.id ? " (you)" : ""}
                      </strong>
                      <small>
                        {!member.active
                          ? "Removed from room"
                          : member.confirmed
                            ? "Confirmed ✓"
                            : "Choosing cravings…"}
                      </small>
                    </div>
                    {session.isHost &&
                      member.active &&
                      member.id !== session.me?.id &&
                      session.membershipOpen && (
                        <button
                          className="text-button remove-member"
                          aria-label={`Remove ${member.displayName}`}
                          disabled={!!busy}
                          onClick={() =>
                            void mutate(
                              "",
                              "PATCH",
                              { ...versions(), removeMemberId: member.id },
                              "remove",
                            )
                          }
                        >
                          Remove
                        </button>
                      )}
                  </li>
                ))}
              </ul>
              <p className="field-hint">
                {session.membershipOpen
                  ? "Invite your friends before ranking."
                  : "Membership is closed. Host can reopen to change the table."}{" "}
                Disconnected members remain part of the decision.
              </p>
            </section>
            {session.isHost && (
              <section className="card host-card">
                <p className="eyebrow">HOST CONTROLS</p>
                <label htmlFor="room-mode">Meal mode</label>
                <select
                  id="room-mode"
                  value={session.mode}
                  disabled={!!busy || session.status === "finalized"}
                  onChange={(e) =>
                    void mutate(
                      "",
                      "PATCH",
                      { ...versions(), mode: e.target.value },
                      "mode",
                    )
                  }
                >
                  <option value="dine_in">Dine in</option>
                  <option value="delivery">Delivery</option>
                </select>
                <p className="field-hint">
                  Changing mode clears prior choices and recalculates costs.
                </p>
                <button
                  className="primary full"
                  disabled={
                    !!busy ||
                    !allConfirmed ||
                    !session.me ||
                    session.status === "finalized"
                  }
                  onClick={() =>
                    void mutate("/rank", "POST", versions(), "rank")
                  }
                >
                  {busy === "rank"
                    ? "Ranking meals…"
                    : session.ranking
                      ? "Recalculate options"
                      : "Find meals for everyone"}{" "}
                  <span>↗</span>
                </button>
                {!allConfirmed && (
                  <p className="field-hint">
                    Everyone must confirm before ranking.
                  </p>
                )}
                {active.length < session.expectedSize && (
                  <p className="field-hint">
                    Your expected table is {session.expectedSize}. Ranking now
                    closes membership for {active.length} members.
                  </p>
                )}
                {(!session.membershipOpen ||
                  session.status === "finalized") && (
                  <button
                    className="secondary full reopen-button"
                    disabled={!!busy}
                    onClick={() =>
                      void mutate(
                        "",
                        "PATCH",
                        { ...versions(), action: "reopen" },
                        "reopen",
                      )
                    }
                  >
                    Reopen room
                  </button>
                )}
              </section>
            )}
            <div className="fairness-note">
              <span>✳</span>
              <h3>Everyone gets a seat.</h3>
              <p>
                Only restaurants with a workable catalog meal for every member
                can appear. Fit = 60% group average + 40% lowest member score.
              </p>
              <p>
                Preference fit is a prototype heuristic, not measured happiness
                or a safety certification.
              </p>
            </div>
          </aside>
          <div className="room-content">
            {!session.me ? (
              <section className="card join-card">
                <p className="eyebrow">YOU’RE INVITED</p>
                <h2>Pull up a chair.</h2>
                <p className="muted">
                  Choose a name to join this room. Your browser keeps your seat
                  private.
                </p>
                {session.membershipOpen && active.length < 5 ? (
                  <form onSubmit={join}>
                    <label htmlFor="join-name">Your name</label>
                    <input
                      id="join-name"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      placeholder="e.g. Nat"
                      required
                      maxLength={40}
                    />
                    <button
                      className="primary full"
                      type="submit"
                      disabled={!!busy}
                    >
                      {busy === "join" ? "Joining…" : "Join room"}{" "}
                      <span>↗</span>
                    </button>
                  </form>
                ) : (
                  <p className="notice">
                    This table is{" "}
                    {active.length >= 5 ? "full" : "closed to new members"}. Ask
                    the host to reopen or create a new room.
                  </p>
                )}
              </section>
            ) : session.me.active ? (
              <PreferenceForm
                key={session.me.id}
                session={session}
                onSaved={(s) => {
                  mutation.current++;
                  setSession(s);
                  setError("");
                }}
                onError={(e) => void handleError(e)}
              />
            ) : (
              <section className="card">
                <h2>Your seat was removed.</h2>
                <p>
                  Please ask the host to reopen the table if you need to join
                  again.
                </p>
              </section>
            )}
            {session.status === "finalized" && finalOption && (
              <section className="final-banner">
                <span className="eyebrow">UNANIMOUSLY AGREED</span>
                <h2>
                  It’s a date.
                  <br />
                  {finalOption.restaurantName}
                </h2>
                <p>
                  Everyone accepted the same current option. Here’s your shared
                  meal plan.
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    void copy(summary(finalOption), "Meal summary copied")
                  }
                >
                  Copy meal summary <span>↗</span>
                </button>
                <details>
                  <summary>View copyable summary</summary>
                  <pre className="summary-text">{summary(finalOption)}</pre>
                </details>
              </section>
            )}
            {session.ranking ? (
              <section
                className="results-section"
                aria-label="Restaurant options"
              >
                <div className="results-heading">
                  <div>
                    <p className="eyebrow">
                      {session.status === "finalized"
                        ? "YOUR CHOSEN TABLE"
                        : "A MEAL FOR EVERYONE"}
                    </p>
                    <h2>
                      {session.ranking.status === "no_match"
                        ? "Let’s adjust the plan."
                        : "Good options. Shared choice."}
                    </h2>
                  </div>
                  <span className="version-pill">
                    v{session.ranking.preferenceVersion} ·{" "}
                    {session.ranking.catalogVersion}
                  </span>
                </div>
                {session.ranking.status === "no_match" ? (
                  <section className="card no-match">
                    <span className="empty-symbol">↻</span>
                    <h3>No feasible restaurant for everyone</h3>
                    <p className="muted">
                      We checked the catalog without relaxing anyone’s limits.
                      Review your own fields or let the host change meal mode.
                    </p>
                    <ul className="rejection-list">
                      {rejections.map(([code, count]) => (
                        <li key={code}>
                          <span>{rejectionNames[code] ?? code}</span>
                          <b>{count} checks</b>
                        </li>
                      ))}
                    </ul>
                    <details>
                      <summary>Detailed catalog rejection evidence</summary>
                      <ul className="rejection-detail">
                        {session.ranking.rejections.map((r, i) => (
                          <li key={i}>
                            {r.restaurantId}
                            {r.menuId ? ` / ${r.menuId}` : ""}
                            {r.memberId
                              ? ` · ${session.members.find((m) => m.id === r.memberId)?.displayName ?? r.memberId}`
                              : ""}
                            : {r.code}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </section>
                ) : (
                  session.ranking.options
                    .filter(
                      (o) =>
                        session.status !== "finalized" ||
                        o.restaurantId === session.finalizedOptionId,
                    )
                    .map((option, index) => {
                      const count = session.acceptances.filter(
                        (a) =>
                          a.restaurantId === option.restaurantId &&
                          a.rankingId === session.ranking!.id,
                      ).length;
                      const accepted =
                        mine?.restaurantId === option.restaurantId &&
                        mine.rankingId === session.ranking!.id;
                      return (
                        <article
                          className={`card option-card ${index === 0 ? "top-option" : ""}`}
                          key={option.restaurantId}
                          data-testid={`option-${option.restaurantId}`}
                        >
                          <div className="option-topline">
                            <span className="option-position">
                              {index === 0
                                ? "✦ TOP GROUP FIT"
                                : `OPTION ${index + 1}`}
                            </span>
                            <span className="demo-small">FICTIONAL VENUE</span>
                          </div>
                          <div className="option-title">
                            <div>
                              <h3>{option.restaurantName}</h3>
                              <p className="field-hint">
                                {option.restaurantId} ·{" "}
                                {option.distanceM === null
                                  ? "Distance unknown"
                                  : `${option.distanceM}m fixture distance`}
                              </p>
                            </div>
                            <div className="fit-score">
                              <strong>{option.groupScore.toFixed(1)}</strong>
                              <span>GROUP FIT / 100</span>
                            </div>
                          </div>
                          <div className="score-components">
                            <span>
                              Average <b>{option.meanScore.toFixed(1)}</b>
                            </span>
                            <span>
                              Lowest <b>{option.minimumScore.toFixed(1)}</b>
                            </span>
                            <span>
                              Table total{" "}
                              <b>{money(option.totalGroupCostSatang)}</b>
                            </span>
                          </div>
                          <p className="option-explanation">
                            {option.explanation}
                          </p>
                          <div className="assignments">
                            {option.assignments.map((assignment) => {
                              const member = session.members.find(
                                (m) => m.id === assignment.memberId,
                              );
                              return (
                                <div
                                  className="assignment"
                                  key={assignment.memberId}
                                >
                                  <div className="assignment-header">
                                    <strong>
                                      {member?.displayName ?? "Member"}
                                      {member?.id === session.me?.id
                                        ? " · you"
                                        : ""}
                                    </strong>
                                    <span className="personal-fit">
                                      Fit {assignment.fitScore.toFixed(1)}
                                    </span>
                                  </div>
                                  <div className="menu-line">
                                    <span>{assignment.menuName}</span>
                                    <strong>
                                      {money(assignment.totalCostSatang)}
                                    </strong>
                                  </div>
                                  <div className="cost-evidence">
                                    Item {money(assignment.itemCostSatang)} +
                                    fee share{" "}
                                    {money(assignment.allocatedFeeSatang)}
                                    <span className="catalog-menu-id">
                                      {assignment.menuId}
                                    </span>
                                  </div>
                                  {assignment.matchedTags.length > 0 && (
                                    <div className="matched-tags">
                                      {assignment.matchedTags.map((tag) => (
                                        <span key={tag}>{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                  <details className="evidence-details">
                                    <summary>Catalog evidence</summary>
                                    {assignment.constraintEvidence.map(
                                      (e, i) => (
                                        <p key={i}>
                                          {e.field}: <code>{e.evidenceId}</code>
                                        </p>
                                      ),
                                    )}
                                  </details>
                                </div>
                              );
                            })}
                          </div>
                          {option.warnings.map((warning, i) => (
                            <p key={i} className="notice">
                              {warning}
                            </p>
                          ))}
                          <div className="acceptance-status">
                            <span className="acceptance-dots">
                              {active.map((m) => (
                                <i
                                  key={m.id}
                                  className={
                                    session.acceptances.some(
                                      (a) =>
                                        a.memberId === m.id &&
                                        a.restaurantId ===
                                          option.restaurantId &&
                                        a.rankingId === session.ranking!.id,
                                    )
                                      ? "accepted"
                                      : ""
                                  }
                                />
                              ))}
                            </span>
                            <strong>
                              {count} / {active.length} accepted
                            </strong>
                          </div>
                          {session.me?.active &&
                            session.status !== "finalized" && (
                              <div className="option-actions">
                                <button
                                  className={
                                    accepted
                                      ? "accepted-button full"
                                      : "primary full"
                                  }
                                  disabled={!!busy}
                                  onClick={() =>
                                    void mutate(
                                      "/acceptance/me",
                                      accepted ? "DELETE" : "PUT",
                                      choiceBody(option),
                                      "accept",
                                    )
                                  }
                                >
                                  {accepted
                                    ? "✓ Accepted · tap to withdraw"
                                    : "Accept this option"}
                                </button>
                                {session.isHost && (
                                  <button
                                    className="secondary full"
                                    disabled={
                                      !!busy ||
                                      count !== active.length ||
                                      active.length === 0
                                    }
                                    onClick={() =>
                                      void mutate(
                                        "/finalize",
                                        "POST",
                                        choiceBody(option),
                                        "finalize",
                                      )
                                    }
                                  >
                                    {busy === "finalize"
                                      ? "Finalizing…"
                                      : "Finalize group choice"}
                                  </button>
                                )}
                              </div>
                            )}
                        </article>
                      );
                    })
                )}
              </section>
            ) : (
              <section className="waiting-card">
                <div className="waiting-orbit">✳</div>
                <h2>Good things come together.</h2>
                <p>
                  Once everyone confirms, the host can find up to three
                  restaurants with a catalog meal for every person.
                </p>
                <span className="field-hint">
                  {ready}/{active.length} ready · Updates every 2 seconds
                </span>
              </section>
            )}
          </div>
        </div>
        <footer className="room-footer">
          {session.ai.available
            ? "AI drafts require your confirmation."
            : "Manual mode: no AI calls are being performed."}{" "}
          · Room expires{" "}
          {new Intl.DateTimeFormat("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Bangkok",
          }).format(new Date(session.expiresAt))}{" "}
          Bangkok time.
        </footer>
      </main>
    </div>
  );
}
function Header() {
  return (
    <header className="site-header">
      <a className="wordmark" href="/" aria-label="CraveLoop home">
        <span className="brand-icon">
          c<span>↗</span>
        </span>
        craveloop<span className="brand-dot">.</span>
      </a>
      <span className="header-caption">A GOOD MEAL FOR EVERYONE</span>
    </header>
  );
}
