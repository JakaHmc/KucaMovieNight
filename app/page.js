"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX = 420;
const MIN = 20;
const pad = (n) => String(n).padStart(2, "0");

// Slovenski sklanjatvi: 1 predlog, 2 predloga, 3-4 predlogi, 5+ predlogov
function plural(n, one, two, few, many) {
  const m = n % 100;
  if (m === 1) return one;
  if (m === 2) return two;
  if (m === 3 || m === 4) return few;
  return many;
}
const predlog = (n) => plural(n, "predlog", "predloga", "predlogi", "predlogov");
const tocka = (n) => plural(n, "točka", "točki", "točke", "točk");

async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body ? {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    } : { cache: "no-store" });
  } catch {
    throw new Error("Ni povezave s strežnikom.");
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) { const err = new Error(data.error || "Nekaj je šlo narobe."); err.status = res.status; throw err; }
  return data;
}

async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Te datoteke ni bilo mogoče prebrati kot sliko."));
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
    throw new Error("Slika je preveč podrobna za shranjevanje. Poskusi z manjšo.");
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
  const [gateOpen, setGateOpen] = useState(null); // null | "present" | "vote"
  const [gatePw, setGatePw] = useState("");
  const [gateErr, setGateErr] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [armed, setArmed] = useState(null);

  // predstavitev in glasovanje
  const [stage, setStage] = useState(null); // null | "present" | "vote"
  const [revealed, setRevealed] = useState([]);
  const [idx, setIdx] = useState(0);
  const [votes, setVotes] = useState([]);
  const [pending, setPending] = useState([]); // imena, dodana, a še brez glasov
  const [selected, setSelected] = useState(null); // ključ (male črke)
  const [picks, setPicks] = useState({ 1: null, 2: null, 3: null });
  const [newVoter, setNewVoter] = useState("");
  const [voteMsg, setVoteMsg] = useState("");
  const [armedReset, setArmedReset] = useState(null);
  const [voteBusy, setVoteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/pitches");
      setActive(d.active);
      setScreened(d.screened);
      setReady(true);
    } catch (e) {
      setStatus("Table ni bilo mogoče naložiti. Osveži stran.");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden && !stage) load(); }, 15000);
    return () => clearInterval(t);
  }, [load, stage]);

  useEffect(() => {
    if (stage !== "present") return;
    const h = (e) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, revealed.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [stage, revealed.length]);

  async function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setFormErr("");
    if (!/^image\//.test(f.type)) { setFormErr("Izberi slikovno datoteko."); return; }
    try { setImage(await compress(f)); } catch (err) { setImage(null); setFormErr(err.message); }
  }

  async function submit(e) {
    e.preventDefault();
    const text = desc.trim();
    if (!image) { setFormErr("Najprej dodaj sliko."); return; }
    if (text.length < MIN) { setFormErr(`Napiši vsaj ${MIN} znakov.`); return; }
    setFormErr(""); setSaving(true);
    try {
      await api("/api/pitches", { description: text, image });
      setDesc(""); setImage(null);
      setStatus("Tvoj predlog je na tabli.");
      await load();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  /* ---------- predstavitev ---------- */
  async function loadVotes(pw) {
    const d = await api("/api/votes", { password: pw, action: "list" });
    setVotes(d.votes);
    return d.votes;
  }

  async function startFlow(purpose, pw) {
    const d = await api("/api/present", { password: pw });
    setRevealed(d.pitches);
    if (purpose === "present") {
      setIdx(0); setStage("present");
    } else {
      await loadVotes(pw);
      setSelected(null); setPicks({ 1: null, 2: null, 3: null }); setVoteMsg("");
      setStage("vote");
    }
  }

  async function onStart(purpose) {
    setStatus("");
    if (!password) { setGatePw(""); setGateErr(""); setGateOpen(purpose); return; }
    try { await startFlow(purpose, password); } catch (err) { setStatus(err.message); }
  }

  async function submitGate(e) {
    e.preventDefault();
    setGateBusy(true); setGateErr("");
    try {
      await startFlow(gateOpen, gatePw);
      setPassword(gatePw);
      setGateOpen(null);
    } catch (err) {
      setGateErr(err.status === 401 ? "Napačno geslo. Projekcionist ni navdušen." : err.message);
    } finally {
      setGateBusy(false);
    }
  }

  async function toVoting() {
    try {
      await loadVotes(password);
      setSelected(null); setPicks({ 1: null, 2: null, 3: null }); setVoteMsg("");
      setStage("vote");
    } catch (err) { setStatus(err.message); }
  }

  function closeStage() { setStage(null); load(); }

  /* ---------- glasovanje ---------- */
  const voterMap = new Map();
  for (const v of votes) {
    const k = v.voter_name.toLowerCase();
    if (!voterMap.has(k)) voterMap.set(k, { key: k, name: v.voter_name, voted: true });
  }
  for (const name of pending) {
    const k = name.toLowerCase();
    if (!voterMap.has(k)) voterMap.set(k, { key: k, name, voted: false });
  }
  const voters = Array.from(voterMap.values());
  const required = Math.min(3, revealed.length);
  const pickedCount = [1, 2, 3].filter((p) => picks[p]).length;

  function selectVoter(key) {
    setSelected(key); setVoteMsg(""); setArmedReset(null);
    const mine = votes.filter((v) => v.voter_name.toLowerCase() === key);
    const next = { 1: null, 2: null, 3: null };
    for (const v of mine) next[v.points] = v.pitch_id;
    setPicks(next);
  }

  function addVoter(e) {
    e.preventDefault();
    const name = newVoter.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (name.length > 30) { setVoteMsg("Ime je predolgo."); return; }
    const key = name.toLowerCase();
    if (!voterMap.has(key)) setPending((p) => [...p, name]);
    setNewVoter("");
    selectVoter(key);
  }

  function removePending(name) {
    setPending((p) => p.filter((n) => n !== name));
    if (selected === name.toLowerCase()) setSelected(null);
  }

  function assign(pitchId, pts) {
    setPicks((p) => {
      const n = { ...p };
      if (n[pts] === pitchId) { n[pts] = null; return n; }
      for (const k of [1, 2, 3]) if (n[k] === pitchId) n[k] = null;
      n[pts] = pitchId;
      return n;
    });
  }

  async function savePicks() {
    const v = voterMap.get(selected);
    if (!v) return;
    const list = [1, 2, 3].filter((p) => picks[p]).map((p) => ({ pitchId: picks[p], points: p }));
    if (list.length !== required) { setVoteMsg(`Izberi ${required} ${required === 1 ? "film" : "filme"}.`); return; }
    setVoteBusy(true); setVoteMsg("");
    try {
      await api("/api/votes", { password, action: "submit", voter: v.name, picks: list });
      await loadVotes(password);
      setPending((p) => p.filter((n) => n.toLowerCase() !== selected));
      setVoteMsg(`Glasovi osebe ${v.name} so shranjeni.`);
      setSelected(null);
      setPicks({ 1: null, 2: null, 3: null });
    } catch (err) {
      setVoteMsg(err.message);
    } finally {
      setVoteBusy(false);
    }
  }

  async function resetVoter(v) {
    const id = "voter:" + v.key;
    if (armedReset !== id) { setArmedReset(id); setTimeout(() => setArmedReset((a) => (a === id ? null : a)), 3500); return; }
    setArmedReset(null); setVoteBusy(true);
    try {
      await api("/api/votes", { password, action: "resetVoter", voter: v.name });
      await loadVotes(password);
      if (selected === v.key) setPicks({ 1: null, 2: null, 3: null });
      setVoteMsg(`Glasovi osebe ${v.name} so ponastavljeni.`);
    } catch (err) { setVoteMsg(err.message); }
    finally { setVoteBusy(false); }
  }

  async function resetAll() {
    if (armedReset !== "all") { setArmedReset("all"); setTimeout(() => setArmedReset((a) => (a === "all" ? null : a)), 3500); return; }
    setArmedReset(null); setVoteBusy(true);
    try {
      await api("/api/votes", { password, action: "resetAll" });
      await loadVotes(password);
      setPending([]); setSelected(null); setPicks({ 1: null, 2: null, 3: null });
      setVoteMsg("Vsi glasovi so ponastavljeni.");
    } catch (err) { setVoteMsg(err.message); }
    finally { setVoteBusy(false); }
  }

  const tally = revealed.map((p) => {
    const mine = votes.filter((v) => v.pitch_id === p.id);
    return { p, total: mine.reduce((s, v) => s + v.points, 0), mine };
  }).sort((a, b) => b.total - a.total || a.p.n - b.p.n);
  const top = tally.length ? tally[0].total : 0;
  const leaders = top > 0 ? tally.filter((t) => t.total === top) : [];

  async function markWatched(id) {
    try {
      await api(`/api/pitches/${id}`, { password, action: "watch" });
      setStatus("Premaknjeno med že predvajane. Glasovi so počiščeni za nov krog.");
      setVotes([]); setPending([]); setSelected(null);
      setStage(null);
      await load();
    } catch (err) { setVoteMsg(err.message); }
  }

  /* ---------- tabla ---------- */
  async function act(id, action) {
    try {
      await api(`/api/pitches/${id}`, { password, action });
      setStatus(action === "unwatch" ? "Spet v igri." : "Odstranjeno.");
      await load();
    } catch (err) { setStatus(err.message); }
  }

  function removeClick(id) {
    if (armed === id) { setArmed(null); act(id, "remove"); return; }
    setArmed(id);
    setTimeout(() => setArmed((a) => (a === id ? null : a)), 3500);
  }

  const count = !ready ? "Odpiram blagajno"
    : `V igri: ${active.length} ${predlog(active.length)}`;
  const cur = revealed[idx];

  return (
    <div className="page">
      <header className="marquee">
        <div className="bulbs" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.25}s` }} />)}</div>
        <p className="kicker">Hiša predstavlja</p>
        <h1>Filmski večer</h1>
        <p className="tag">Predlagaj film brez naslova. Potem skupaj izberemo.</p>
        <div className="bulbs" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 6) * 0.25 + 0.12}s` }} />)}</div>
      </header>

      <main className="layout">
        <section className="panel" aria-labelledby="pitchH">
          <h2 id="pitchH">Oddaj predlog</h2>
          <form onSubmit={submit}>
            <fieldset disabled={saving}>
              <label className="lab">Plakat</label>
              <button type="button" className="drop" onClick={() => fileRef.current && fileRef.current.click()}>
                {image
                  ? <img src={image} alt="Predogled izbrane slike" />
                  : <span>Tapni za izbiro slike<small>Samodejno se pomanjša</small></span>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />

              <label className="lab" htmlFor="desc">Opis <span className="sub">(izpusti naslov filma)</span></label>
              <textarea
                id="desc" value={desc} maxLength={MAX}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Dva ali trije stavki. Kaj se zgodi, o kom govori, kakšen občutek da."
              />
              <div className="chars">{desc.length} / {MAX}</div>
              <p className="err" role="alert">{formErr}</p>
              <button type="submit" className="btn">{saving ? "Shranjujem..." : "Dodaj na tablo"}</button>
              <p className="note">Predlogi so anonimni. Ostanejo zapečateni, dokler ne začnemo predstavitve.</p>
            </fieldset>
          </form>
        </section>

        <section className="board" aria-labelledby="boardH">
          <div className="board-head">
            <div>
              <h2 id="boardH">Na tabli</h2>
              <p className="count">{count}</p>
            </div>
            <div className="actions">
              <button type="button" className="btn big" onClick={() => onStart("present")}
                disabled={!ready || active.length === 0}
                title={active.length === 0 ? "Najprej dodaj vsaj en predlog" : ""}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1.5v13l11-6.5z" fill="currentColor" /></svg>
                Začni predstavitev
              </button>
              <button type="button" className="btn ghost big" onClick={() => onStart("vote")}
                disabled={!ready || active.length === 0}>
                Glasovanje
              </button>
            </div>
          </div>
          <p className="status" role="status" aria-live="polite">{status}</p>

          <div className="grid">
            {active.map((p) => (
              <div key={p.id} className="slot">
                <article className="ticket">
                  <div className="frame sealed" role="img" aria-label="Zapečaten predlog" />
                  <div className="body">
                    <p className="sealed-line">Zapečateno do predstavitve</p>
                    <span className="redact" /><span className="redact" /><span className="redact" />
                  </div>
                  <footer className="stub">
                    <span>Nº {pad(p.n)}</span>
                    {password
                      ? <button type="button" className="link" onClick={() => removeClick(p.id)}>{armed === p.id ? "Prepričan? Odstrani" : "Odstrani"}</button>
                      : <span>Ena vstopnica</span>}
                  </footer>
                </article>
              </div>
            ))}
          </div>

          {ready && active.length === 0 && screened.length === 0 && (
            <p className="alldone">Na tabli še ni ničesar. Dodaj prvi predlog z obrazcem.</p>
          )}
          {ready && active.length === 0 && screened.length > 0 && (
            <p className="alldone">Vsi predlogi so že predvajani. Dodaj novega ali vrni starega s police spodaj.</p>
          )}

          {screened.length > 0 && (
            <details className="shelf">
              <summary>Že predvajano ({screened.length})</summary>
              <div className="grid small">
                {screened.map((p) => (
                  <div key={p.id} className="slot">
                    <article className="ticket done">
                      <div className="frame"><img src={p.image} alt={`Slika predloga številka ${p.n}`} /></div>
                      <div className="body"><p className="desc">{p.description}</p></div>
                      <footer className="stub">
                        <span>Nº {pad(p.n)}</span>
                        {password
                          ? <button type="button" className="link" onClick={() => act(p.id, "unwatch")}>Vrni nazaj</button>
                          : <span>Predvajano</span>}
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
            <p className="kicker">Samo za projekcionista</p>
            <h2 id="gateH">Skrivno geslo</h2>
            <input className="gate-input" value={gatePw} onChange={(e) => setGatePw(e.target.value)}
              autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder="Povej čarobno besedo" aria-label="Geslo" />
            <p className="err" role="alert">{gateErr}</p>
            <div className="actions">
              <button type="submit" className="btn" disabled={gateBusy}>{gateBusy ? "Preverjam..." : "Naprej"}</button>
              <button type="button" className="btn ghost" onClick={() => setGateOpen(null)}>Prekliči</button>
            </div>
          </form>
        </div>
      )}

      {stage === "present" && cur && (
        <div className="stage" role="dialog" aria-modal="true" aria-labelledby="stageH">
          <div className="stage-panel">
            <div className="stage-img"><img src={cur.image} alt={`Slika predloga številka ${cur.n}`} /></div>
            <div className="stage-text">
              <p className="kicker">Predlog {idx + 1} od {revealed.length}</p>
              <h2 id="stageH">Predlog Nº {pad(cur.n)}</h2>
              <p className="stage-desc">{cur.description}</p>
              <div className="progress" aria-hidden="true">
                {revealed.map((r, i) => <i key={r.id} className={i === idx ? "on" : i < idx ? "seen" : ""} />)}
              </div>
              <div className="actions">
                <button type="button" className="btn ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Nazaj</button>
                {idx < revealed.length - 1
                  ? <button type="button" className="btn" onClick={() => setIdx(idx + 1)}>Naprej</button>
                  : <button type="button" className="btn" onClick={toVoting}>Na glasovanje</button>}
                <button type="button" className="btn ghost" onClick={closeStage}>Zapri</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {stage === "vote" && (
        <div className="stage tall" role="dialog" aria-modal="true" aria-labelledby="voteH">
          <div className="vote-wrap">
            <div className="vote-head">
              <div>
                <p className="kicker">Zadnji prizor</p>
                <h2 id="voteH">Glasovanje</h2>
              </div>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => { setIdx(0); setStage("present"); }}>Nazaj na predstavitev</button>
                <button type="button" className="btn ghost" onClick={closeStage}>Zapri</button>
              </div>
            </div>
            <p className="status" role="status" aria-live="polite">{voteMsg}</p>

            <section className="vpanel">
              <h3>Glasovalci</h3>
              <form className="add-voter" onSubmit={addVoter}>
                <input className="gate-input" value={newVoter} onChange={(e) => setNewVoter(e.target.value)}
                  maxLength={30} placeholder="Ime glasovalca" aria-label="Ime glasovalca" autoComplete="off" />
                <button type="submit" className="btn">Dodaj glasovalca</button>
              </form>
              <div className="chips">
                {voters.length === 0 && <p className="note">Dodaj prvega glasovalca z imenom.</p>}
                {voters.map((v) => (
                  <div key={v.key} className={"chip" + (selected === v.key ? " on" : "")}>
                    <button type="button" className="chip-main" onClick={() => selectVoter(v.key)}>
                      {v.voted ? "✓ " : ""}{v.name}
                    </button>
                    {v.voted
                      ? <button type="button" className="link" disabled={voteBusy} onClick={() => resetVoter(v)}>
                          {armedReset === "voter:" + v.key ? "Prepričan? Ponastavi" : "Ponastavi"}
                        </button>
                      : <button type="button" className="link" aria-label={`Odstrani ${v.name}`} onClick={() => removePending(v.name)}>×</button>}
                  </div>
                ))}
              </div>
            </section>

            {selected && voterMap.get(selected) && (
              <section className="vpanel">
                <h3>{voterMap.get(selected).name} glasuje</h3>
                <p className="note">
                  Izberi {required} {required === 1 ? "film" : "različne filme"} in jim daj točke: 3, 2 in 1.
                  Vsake točke lahko uporabiš samo enkrat. Ponovni klik na isto točko jo odstrani.
                </p>
                <div className="vgrid">
                  {revealed.map((p) => (
                    <article key={p.id} className="vcard">
                      <img src={p.image} alt={`Slika predloga številka ${p.n}`} />
                      <div className="vbody">
                        <strong>Nº {pad(p.n)}</strong>
                        <p>{p.description}</p>
                      </div>
                      <div className="pts" role="group" aria-label={`Točke za predlog ${p.n}`}>
                        {[3, 2, 1].map((pt) => (
                          <button key={pt} type="button" aria-pressed={picks[pt] === p.id}
                            className={"pt" + (picks[pt] === p.id ? " on" : "")}
                            onClick={() => assign(p.id, pt)}>{pt}</button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="actions" style={{ marginTop: 16 }}>
                  <button type="button" className="btn" disabled={voteBusy || pickedCount !== required} onClick={savePicks}>
                    {voteBusy ? "Shranjujem..." : "Shrani glasove"}
                  </button>
                  <span className="note">Izbrano: {pickedCount} od {required}</span>
                </div>
              </section>
            )}

            <section className="vpanel">
              <div className="vrow">
                <h3>Rezultati</h3>
                <button type="button" className="btn ghost" disabled={voteBusy || votes.length === 0} onClick={resetAll}>
                  {armedReset === "all" ? "Prepričan? Ponastavi vse" : "Ponastavi vse glasove"}
                </button>
              </div>
              {votes.length === 0
                ? <p className="note">Še ni glasov.</p>
                : (
                  <ol className="results">
                    {tally.map((t) => (
                      <li key={t.p.id} className={leaders.includes(t) ? "lead" : ""}>
                        <img src={t.p.image} alt="" />
                        <div className="rbody">
                          <div className="rtop">
                            <strong>Nº {pad(t.p.n)}</strong>
                            <span>{t.total} {tocka(t.total)}</span>
                          </div>
                          <div className="bar"><i style={{ width: `${top ? (t.total / top) * 100 : 0}%` }} /></div>
                          <p className="note">{t.mine.length
                            ? t.mine.map((v) => `${v.voter_name} (${v.points})`).join(", ")
                            : "Brez glasov"}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              {leaders.length === 1 && (
                <div className="winner">
                  <p className="kicker">Zmagovalec</p>
                  <p>Predlog Nº {pad(leaders[0].p.n)} z {leaders[0].total} {tocka(leaders[0].total)}.</p>
                  <button type="button" className="btn" onClick={() => markWatched(leaders[0].p.id)}>Ogledali smo si ga</button>
                </div>
              )}
              {leaders.length > 1 && (
                <div className="winner">
                  <p className="kicker">Neodločeno</p>
                  <p>Enako točk imajo predlogi {leaders.map((l) => "Nº " + pad(l.p.n)).join(", ")}. Glasujte znova ali izberite enega.</p>
                  <div className="actions">
                    {leaders.map((l) => (
                      <button key={l.p.id} type="button" className="btn ghost" onClick={() => markWatched(l.p.id)}>
                        Ogledali smo si Nº {pad(l.p.n)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
