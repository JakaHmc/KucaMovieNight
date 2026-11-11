"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX = 420;
const MIN = 20;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");

async function api(path, body) {
  const res = await fetch(path, body ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } : { cache: "no-store" });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) { const err = new Error(data.error || "Something went wrong."); err.status = res.status; throw err; }
  return data;
}

async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That file could not be read as an image."));
      i.src = url;
    });
    for (const [size, q] of [[800, 0.8], [640, 0.7], [520, 0.6], [420, 0.6]]) {
      const s = Math.min(1, size / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL("image/jpeg", q);
      if (out.length < 190000) return out;
    }
    throw new Error("That image is too detailed to store. Try a smaller one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Page() {
  const [active, setActive] = useState([]);
  const [screened, setScreened] = useState([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");

  const [desc, setDesc] = useState("");
  const [image, setImage] = useState(null);
  const [formErr, setFormErr] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const [password, setPassword] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [gatePw, setGatePw] = useState("");
  const [gateErr, setGateErr] = useState("");
  const [gateBusy, setGateBusy] = useState(false);

  const [rolling, setRolling] = useState(false);
  const [litId, setLitId] = useState(null);
  const [winner, setWinner] = useState(null);
  const [armed, setArmed] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/pitches");
      setActive(d.active);
      setScreened(d.screened);
      setReady(true);
    } catch (e) {
      setStatus("The board could not be loaded. Reload to try again.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setFormErr("");
    if (!/^image\//.test(f.type)) { setFormErr("Pick an image file."); return; }
    try { setImage(await compress(f)); } catch (err) { setImage(null); setFormErr(err.message); }
  }

  async function submit(e) {
    e.preventDefault();
    const text = desc.trim();
    if (!image) { setFormErr("Add an image first."); return; }
    if (text.length < MIN) { setFormErr(`Write at least ${MIN} characters.`); return; }
    setFormErr(""); setSaving(true);
    try {
      await api("/api/pitches", { description: text, image });
      setDesc(""); setImage(null);
      setStatus("Your pitch is on the board.");
      await load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function doRoll(pw) {
    const data = await api("/api/roll", { password: pw });
    setRolling(true);
    const ids = data.ids;
    const n = ids.length;
    const winnerIdx = ids.indexOf(data.winner.id);
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce && n > 1) {
      const start = Math.floor(Math.random() * n);
      const total = n * 2 + ((winnerIdx - start + n) % n);
      for (let k = 0; k <= total; k++) {
        setLitId(ids[(start + k) % n]);
        await sleep(60 + Math.pow(k / total, 2) * 320);
      }
      await sleep(650);
    }
    setLitId(null);
    setRolling(false);
    setWinner(data.winner);
  }

  async function onRollClick() {
    setStatus("");
    if (!password) { setGatePw(""); setGateErr(""); setGateOpen(true); return; }
    try { await doRoll(password); } catch (err) { setRolling(false); setLitId(null); setStatus(err.message); }
  }

  async function submitGate(e) {
    e.preventDefault();
    setGateBusy(true); setGateErr("");
    try {
      await doRoll(gatePw);
      setPassword(gatePw);
      setGateOpen(false);
    } catch (err) {
      setRolling(false); setLitId(null);
      setGateErr(err.status === 401 ? "Wrong password. The projectionist is unimpressed." : err.message);
    } finally {
      setGateBusy(false);
    }
  }

  async function act(id, action) {
    try {
      await api(`/api/pitches/${id}`, { password, action });
      setStatus(action === "watch" ? "Moved to Already screened." : action === "unwatch" ? "Back in the running." : "Removed.");
      await load();
      return true;
    } catch (err) {
      setStatus(err.message);
      return false;
    }
  }

  async function markWatched() {
    if (!winner) return;
    if (await act(winner.id, "watch")) setWinner(null);
  }

  async function rollAgain() {
    setWinner(null);
    await onRollClick();
  }

  function removeClick(id) {
    if (armed === id) { setArmed(null); act(id, "remove"); return; }
    setArmed(id);
    setTimeout(() => setArmed((a) => (a === id ? null : a)), 3500);
  }

  const count = !ready ? "Opening the box office"
    : active.length === 1 ? "1 pitch in the running" : `${active.length} pitches in the running`;

  return (
    <div className="page">
      <header className="marquee">
        <div className="bulbs" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.25}s` }} />)}</div>
        <p className="kicker">The house presents</p>
        <h1>Movie Night</h1>
        <p className="tag">Pitch a film with no title. The projector picks.</p>
        <div className="bulbs" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.25 + 0.12}s` }} />)}</div>
      </header>

      <main className="layout">
        <section className="panel" aria-labelledby="pitchH">
          <h2 id="pitchH">Submit a pitch</h2>
          <form onSubmit={submit}>
            <fieldset disabled={saving}>
              <label className="lab">The poster</label>
              <button type="button" className="drop" onClick={() => fileRef.current && fileRef.current.click()}>
                {image
                  ? <img src={image} alt="Chosen poster preview" />
                  : <span>Tap to choose an image<small>It is shrunk for you automatically</small></span>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />

              <label className="lab" htmlFor="desc">The pitch <span className="sub">(leave the title out)</span></label>
              <textarea
                id="desc" value={desc} maxLength={MAX}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Two or three sentences. What happens, who it follows, how it feels to watch."
              />
              <div className="chars">{desc.length} / {MAX}</div>
              <p className="err" role="alert">{formErr}</p>
              <button type="submit" className="btn">{saving ? "Saving..." : "Add to the board"}</button>
              <p className="note">Pitches are anonymous. They stay sealed until the projector rolls.</p>
            </fieldset>
          </form>
        </section>

        <section className="board" aria-labelledby="boardH">
          <div className="board-head">
            <div>
              <h2 id="boardH">On the board</h2>
              <p className="count">{count}</p>
            </div>
            <button type="button" className="btn big" onClick={onRollClick}
              disabled={!ready || active.length === 0 || rolling}
              title={active.length === 0 ? "Add at least one pitch first" : ""}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z" fill="currentColor" /></svg>
              Roll the projector
            </button>
          </div>
          <p className="status" role="status" aria-live="polite">{status}</p>

          <div className={"grid" + (rolling ? " rolling" : "")}>
            {active.map((p) => (
              <div key={p.id} className={"slot" + (litId === p.id ? " lit" : "")}>
                <article className="ticket">
                  <div className="frame sealed" role="img" aria-label="Sealed pitch" />
                  <div className="body">
                    <p className="sealed-line">Sealed until the projector rolls</p>
                    <span className="redact" /><span className="redact" /><span className="redact" />
                  </div>
                  <footer className="stub">
                    <span>Nº {pad(p.n)}</span>
                    {password
                      ? <button type="button" className="link" onClick={() => removeClick(p.id)}>{armed === p.id ? "Sure? Remove" : "Remove"}</button>
                      : <span>Admit one</span>}
                  </footer>
                </article>
              </div>
            ))}
          </div>

          {ready && active.length === 0 && screened.length === 0 && (
            <p className="alldone">Nothing on the board yet. Add the first pitch with the form.</p>
          )}
          {ready && active.length === 0 && screened.length > 0 && (
            <p className="alldone">Every pitch has been screened. Add a new one, or put an old one back from the shelf below.</p>
          )}

          {screened.length > 0 && (
            <details className="shelf">
              <summary>Already screened ({screened.length})</summary>
              <div className="grid small">
                {screened.map((p) => (
                  <div key={p.id} className="slot">
                    <article className="ticket done">
                      <div className="frame"><img src={p.image} alt={`Image for pitch number ${p.n}`} /></div>
                      <div className="body"><p className="desc">{p.description}</p></div>
                      <footer className="stub">
                        <span>Nº {pad(p.n)}</span>
                        {password
                          ? <button type="button" className="link" onClick={() => act(p.id, "unwatch")}>Put back</button>
                          : <span>Screened</span>}
                      </footer>
                    </article>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      </main>

      {gateOpen && (
        <div className="stage" role="dialog" aria-modal="true" aria-labelledby="gateH">
          <form className="stage-panel narrow" onSubmit={submitGate}>
            <p className="kicker">Projectionist only</p>
            <h2 id="gateH">Secret password</h2>
            <input className="gate-input" value={gatePw} onChange={(e) => setGatePw(e.target.value)}
              autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder="Say the magic word" aria-label="Password" />
            <p className="err" role="alert">{gateErr}</p>
            <div className="actions">
              <button type="submit" className="btn" disabled={gateBusy}>{gateBusy ? "Checking..." : "Start the reel"}</button>
              <button type="button" className="btn ghost" onClick={() => setGateOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {winner && (
        <div className="stage" role="dialog" aria-modal="true" aria-labelledby="stageH">
          <div className="stage-panel">
            <div className="stage-img"><img src={winner.image} alt={`Image for pitch number ${winner.n}`} /></div>
            <div className="stage-text">
              <p className="kicker">Tonight's feature</p>
              <h2 id="stageH">Pitch Nº {pad(winner.n)}</h2>
              <p className="stage-desc">{winner.description}</p>
              <div className="actions">
                <button type="button" className="btn" onClick={markWatched}>We watched it</button>
                <button type="button" className="btn ghost" onClick={rollAgain}>Roll again</button>
                <button type="button" className="btn ghost" onClick={() => setWinner(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
