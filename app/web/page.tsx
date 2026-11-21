"use client";
import { useState } from "react";
import { api } from "@/components/api";
import type { Mode } from "@/contracts";
export default function Home() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("dine_in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ sessionId: string }>("/api/sessions", "POST", {
        hostName: name,
        areaId: "bangkok_demo",
        mode,
        expectedSize: 4,
      });
      window.location.assign(`/s/${result.sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create room");
      setBusy(false);
    }
  }
  return (
    <div className="home-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="CraveLoop home">
          <span className="brand-icon">
            c<span>↗</span>
          </span>
          craveloop<span className="brand-dot">.</span>
        </a>
        <span className="prototype-pill">WORKING PROTOTYPE</span>
      </header>
      <main className="home-main">
        <section className="home-intro">
          <div className="eyebrow">
            <span className="live-dot" /> GOOD FOOD. SHARED DECISIONS.
          </div>
          <h1>
            Different cravings.
            <br />
            <span>One happy table.</span>
          </h1>
          <p className="hero-copy">
            มื้อนี้ กินอะไรดี?
            <br />
            Bring everyone’s cravings, budgets, and needs into one loop. Find a
            meal that works for every friend.
          </p>
          <div className="meal-illustration" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="float-note note-one">Something crispy ✦</span>
            <span className="float-note note-two">Veggie, please ♡</span>
            <div className="plate">
              <div className="food-rice" />
              <div className="food-tofu tofu-one" />
              <div className="food-tofu tofu-two" />
              <div className="food-tofu tofu-three" />
              <div className="food-leaf leaf-one" />
              <div className="food-leaf leaf-two" />
              <div className="food-leaf leaf-three" />
              <div className="food-dot dot-one" />
              <div className="food-dot dot-two" />
            </div>
            <span className="tiny-note">A little something for everyone.</span>
          </div>
          <div className="home-principles">
            <span>01 &nbsp; Share your cravings</span>
            <span>02 &nbsp; Find everyone a meal</span>
            <span>03 &nbsp; Agree together</span>
          </div>
        </section>
        <section className="create-panel">
          <div className="small-symbol">✳</div>
          <p className="eyebrow">START A NEW LOOP</p>
          <h2>Who’s hungry?</h2>
          <p className="muted">
            Create a room, share the link, and invite your table.
          </p>
          <form onSubmit={create}>
            <label htmlFor="host-name">Your name</label>
            <input
              id="host-name"
              name="hostName"
              autoComplete="given-name"
              placeholder="e.g. May"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
            />
            <label htmlFor="area">Your area</label>
            <select id="area" value="bangkok_demo" onChange={() => {}}>
              <option value="bangkok_demo">Bangkok · Demo neighborhood</option>
            </select>
            <label>How are we eating?</label>
            <div className="segmented">
              <button
                type="button"
                aria-pressed={mode === "dine_in"}
                onClick={() => setMode("dine_in")}
              >
                <span>♧</span> Dine in
              </button>
              <button
                type="button"
                aria-pressed={mode === "delivery"}
                onClick={() => setMode("delivery")}
              >
                <span>↗</span> Delivery
              </button>
            </div>
            <div className="group-hint">
              <span className="avatar-stack">
                <i>M</i>
                <i>N</i>
                <i>P</i>
                <i>+</i>
              </span>
              <span>A table for 4 · up to 5 members</span>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" type="submit" disabled={busy}>
              {busy ? "Creating your room…" : "Create a room"} <span>↗</span>
            </button>
            <p className="fine-print center">
              No account needed. Your browser remembers your seat.
            </p>
          </form>
        </section>
      </main>
      <footer className="home-footer">
        <span className="demo-badge">SYNTHETIC CATALOG</span>
        <p>
          12 fictional restaurants · 60 fictional menus. Prices and dietary
          evidence are demo fixtures. This prototype does not place orders.
        </p>
      </footer>
    </div>
  );
}
