import { LEKAR, QUIZ, MUSIC, ALL_GRENAR, WIN_POINTS, PART_POINTS } from './grenar.js';

// --- tillstånd -------------------------------------------------------------

let S = null;
const ui = {
  game: null,
  quizTeam: null,
  musicTeam: null,
  // Valt antal extrapoäng per lag innan domaren trycker på Ge.
  extraAmt: {},
  showFacit: false,
  editTeam: null,
  addOpen: false,
  confirm: null,
  // Vald men ännu inte sparad bild per formulär ('new' eller lagets id): { blob, url } eller { remove: true }.
  photo: {},
};
let rankDelta = new Map();
let prevRanks = null;
let pin = store('okt-pin') ?? '';
let admin = false;
let pinRequired = true;
let facit = null;

const $view = document.getElementById('view');
const $toast = document.getElementById('toast');

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* privat läge */ }
  return null;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
const signed = (n) => (n > 0 ? `+${fmt(n)}` : fmt(n));
// Avstängda grenar döljs för gästerna och deras poäng räknas inte.
const isOn = (id) => !S?.disabled?.includes(id);
const grenar = () => ALL_GRENAR.filter((g) => isOn(g.id));
const grenIndex = (id) => grenar().findIndex((g) => g.id === id);
const maxLekar = () => LEKAR.filter((l) => isOn(l.id)).length * WIN_POINTS;
const maxTotal = () => maxLekar() + (isOn(QUIZ.id) ? QUIZ.max : 0) + (isOn(MUSIC.id) ? MUSIC.max : 0);
const isLek = (id) => LEKAR.some((l) => l.id === id);

// --- poängberäkning --------------------------------------------------------

function lekPoints(entry, lek) {
  if (!entry) return 0;
  let p = entry.r === 'win' ? WIN_POINTS : entry.r === 'part' ? PART_POINTS : 0;
  if (lek.penalty) p += entry.pen * lek.penalty.value;
  return p;
}

function quizPoints(entry) {
  if (!entry) return 0;
  return entry.q.reduce((a, b) => a + b, 0) + entry.bonus;
}

// Servern räknar ut ok och dist, så svaret på utslagsfrågan aldrig skickas till gästerna.
function tiebreakOk(entry) {
  return entry?.ok === true;
}

function musicPoints(entry) {
  if (!entry) return 0;
  const hits = entry.a.filter(Boolean).length + entry.t.filter(Boolean).length;
  return hits + (tiebreakOk(entry) ? 1 : 0);
}

function extraPoints(teamId) {
  return (S.extra?.[teamId] ?? []).reduce((sum, e) => sum + e.pts, 0);
}

// Utslagsfrågan: närmast utan att gå över vinner vid lika poäng.
function tieDistance(entry) {
  return entry?.dist ?? Infinity;
}

function scoreboard() {
  if (!S) return [];
  const rows = S.teams.map((team) => {
    const perGame = {};
    let lekar = 0;
    for (const lek of LEKAR) {
      const p = lekPoints(S.games[lek.id]?.[team.id], lek);
      perGame[lek.id] = p;
      if (isOn(lek.id)) lekar += p;
    }
    const quiz = isOn(QUIZ.id) ? quizPoints(S.quiz[team.id]) : 0;
    const music = isOn(MUSIC.id) ? musicPoints(S.music[team.id]) : 0;
    perGame[QUIZ.id] = quiz;
    perGame[MUSIC.id] = music;
    const extra = extraPoints(team.id);
    return { team, perGame, lekar, quiz, music, extra, total: lekar + quiz + music + extra, tie: isOn(MUSIC.id) ? tieDistance(S.music[team.id]) : Infinity };
  });
  rows.sort((a, b) => b.total - a.total || a.tie - b.tie || a.team.name.localeCompare(b.team.name, 'sv'));
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.rank = prev && prev.total === row.total && prev.tie === row.tie ? prev.rank : i + 1;
  });
  return rows;
}

function trackRanks(rows) {
  const now = new Map(rows.map((r) => [r.team.id, r.rank]));
  if (prevRanks) {
    const changed = rows.some((r) => prevRanks.get(r.team.id) !== r.rank);
    if (changed) {
      rankDelta = new Map(rows.map((r) => {
        const before = prevRanks.get(r.team.id);
        return [r.team.id, before ? before - r.rank : 0];
      }));
    }
  }
  prevRanks = now;
}

function grenDone(id) {
  if (!S) return false;
  if (isLek(id)) return Object.values(S.games[id] ?? {}).some((e) => e.r !== '' || e.pen > 0);
  if (id === QUIZ.id) return Object.values(S.quiz).some((e) => quizPoints(e) > 0);
  return Object.values(S.music).some((e) => musicPoints(e) > 0 || e.guess != null);
}

// --- server ----------------------------------------------------------------

async function op(type, payload = {}) {
  const res = await fetch('api/op', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Pin': pin },
    body: JSON.stringify({ type, ...payload }),
  });
  if (res.status === 401) {
    logout();
    toast('Logga in som domare för att ändra poäng', true);
    return false;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    toast(body.error ?? 'Något gick fel', true);
    return false;
  }
  return res.json().catch(() => ({ ok: true }));
}

// --- lagbilder -------------------------------------------------------------

const photoUrl = (team) => `photos/${team.id}.jpg?v=${team.photo}`;

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function avatar(team, size = '') {
  const img = team.photo ? `<img src="${photoUrl(team)}" alt="" loading="lazy">` : esc(initials(team.name));
  return `<span class="avatar ${size}">${img}</span>`;
}

// Skalar ner bilden i webbläsaren så att uppladdningen blir liten och snabb.
// En <img> följer bildens EXIF-rotation, så mobilfoton hamnar rätt.
async function shrinkPhoto(file, max = 640) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((done, fail) => {
      img.onload = done;
      img.onerror = fail;
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((done, fail) => canvas.toBlob((b) => (b ? done(b) : fail(new Error('toBlob'))), 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function clearPhotoDraft(key) {
  const draft = ui.photo[key];
  if (draft?.url) URL.revokeObjectURL(draft.url);
  delete ui.photo[key];
}

async function savePhoto(teamId, key) {
  const draft = ui.photo[key];
  if (!draft) return true;
  const res = await fetch(`api/teams/${teamId}/photo`, {
    method: draft.remove ? 'DELETE' : 'POST',
    headers: { 'X-Admin-Pin': pin, 'Content-Type': 'image/jpeg' },
    body: draft.remove ? undefined : draft.blob,
  }).catch(() => null);
  clearPhotoDraft(key);
  if (!res?.ok) {
    const body = await res?.json().catch(() => ({}));
    toast(body?.error ?? 'Kunde inte spara bilden', true);
    return false;
  }
  return true;
}

// Returnerar null vid lyckad inloggning, annars ett felmeddelande.
async function login(value) {
  const headers = { 'X-Admin-Pin': value };
  const res = await fetch('api/login', { method: 'POST', headers }).catch(() => null);
  if (!res?.ok) {
    const body = await res?.json().catch(() => ({}));
    return body?.error ?? 'Kunde inte nå servern';
  }
  const f = await fetch('api/facit', { headers });
  facit = f.ok ? await f.json() : null;
  pin = value;
  store('okt-pin', pin);
  admin = true;
  render();
  return null;
}

function logout() {
  admin = false;
  facit = null;
  pin = '';
  store('okt-pin', null);
  ui.showFacit = false;
  if (location.hash === '#poang') location.hash = 'topplista';
  render();
}

const $pinDialog = document.getElementById('pinDialog');
const $pinInput = document.getElementById('pinInput');
const $pinError = document.getElementById('pinError');

function askPin() {
  $pinInput.value = '';
  $pinError.textContent = '';
  $pinDialog.showModal();
}

// Dialogen står kvar vid fel PIN så att man kan försöka igen direkt.
document.getElementById('pinForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (!$pinInput.value) return;
  const error = await login($pinInput.value);
  $pinError.textContent = error ?? '';
  if (error) {
    $pinInput.select();
    return;
  }
  $pinDialog.close();
  toast('Inloggad som domare');
});

function connect() {
  const pill = document.getElementById('livePill');
  const es = new EventSource('api/events');
  es.onopen = () => pill.classList.remove('off');
  es.onmessage = (ev) => {
    S = JSON.parse(ev.data);
    trackRanks(scoreboard());
    render();
  };
  es.onerror = () => pill.classList.add('off');
}

let toastTimer;
function toast(text, bad = false) {
  $toast.textContent = text;
  $toast.classList.toggle('bad', bad);
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

// --- rendering -------------------------------------------------------------

function route() {
  const r = location.hash.slice(1);
  if (r === 'poang' && !admin) return 'topplista';
  return ['topplista', 'poang', 'lag', 'grenar'].includes(r) ? r : 'topplista';
}

function render() {
  const r = route();
  document.body.classList.toggle('admin', admin);
  const btn = document.getElementById('adminBtn');
  btn.innerHTML = admin ? '🔓 <span>Logga ut</span>' : '🔒 <span>Domare</span>';
  btn.title = admin ? 'Logga ut från domarläget' : 'Logga in som domare';
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  if (!S) {
    $view.innerHTML = '<p class="muted center pad">Laddar poängställningen…</p>';
    return;
  }
  // Behåll ifyllda formulärfält, fokus och markering när live-uppdateringar ritar om sidan.
  const drafts = [...$view.querySelectorAll('form[data-form] input[id]')].map((el) => [el.id, el.value]);
  const active = document.activeElement;
  const keep = active && active.id && $view.contains(active) && 'value' in active
    ? { id: active.id, value: active.value, start: active.selectionStart, end: active.selectionEnd }
    : null;

  const views = { topplista: viewTopplista, poang: viewPoang, lag: viewLag, grenar: viewGrenar };
  $view.innerHTML = views[r]();

  for (const [id, value] of drafts) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) {
      el.value = keep.value;
      el.focus();
      try { el.setSelectionRange(keep.start, keep.end); } catch { /* number-fält */ }
    }
  }
}

const rankClass = (rank) => (rank <= 3 ? `r${rank}` : 'rn');

function deltaBadge(teamId) {
  const d = rankDelta.get(teamId) ?? 0;
  if (d > 0) return `<span class="delta up">▲ ${d} ${d === 1 ? 'plats' : 'platser'}</span>`;
  if (d < 0) return `<span class="delta down">▼ ${-d} ${d === -1 ? 'plats' : 'platser'}</span>`;
  return '';
}

function splitLine(row) {
  return [
    `<span>Lekar <b>${fmt(row.lekar)}</b></span>`,
    isOn(QUIZ.id) ? `<span>Meningar <b>${fmt(row.quiz)}</b></span>` : '',
    isOn(MUSIC.id) ? `<span>Musik <b>${fmt(row.music)}</b></span>` : '',
    row.extra ? `<span>Extra <b>${signed(row.extra)}</b></span>` : '',
  ].join('');
}

function emptyTeams() {
  return `<div class="empty card">
    <div class="empty-icon">🍺</div>
    <h2>Inga lag ännu</h2>
    ${admin
      ? '<p class="muted">Lägg till lagen innan första grenen börjar, så fylls tavlan på allt eftersom.</p><a class="btn gold" href="#lag">＋ Lägg till lag</a>'
      : '<p class="muted">Domarna lägger till lagen innan första grenen börjar.</p>'}
  </div>`;
}

function announceBar() {
  if (!S.announce) return '';
  return `<div class="announce"><span class="announce-icon">📣</span><div><label>Utrop från Festleiter</label><p>${esc(S.announce)}</p></div></div>`;
}

// Topplista / storskärm ------------------------------------------------------

function viewTopplista() {
  const rows = scoreboard();
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const order = [podium[1], podium[0], podium[2]].filter(Boolean);
  const leader = rows[0];

  const podiumHtml = order.map((row) => {
    const second = rows[1];
    const lead = row === leader && second ? row.total - second.total : null;
    const behind = row !== leader && leader ? leader.total - row.total : null;
    return `<article class="podium ${rankClass(row.rank)}">
      <div class="podium-head">
        <span class="rank-chip ${rankClass(row.rank)} lg">#${row.rank}</span>
        ${deltaBadge(row.team.id)}
      </div>
      ${row.rank === 1 ? '<div class="crown">Tältledare</div>' : ''}
      ${row.team.photo ? avatar(row.team, 'xl') : ''}
      <h3 class="team-name">${esc(row.team.name)}</h3>
      ${row.team.members ? `<div class="members">${esc(row.team.members)}</div>` : ''}
      ${row.team.motto ? `<div class="motto">“${esc(row.team.motto)}”</div>` : ''}
      <div class="podium-foot">
        <div>
          <label>${row.rank === 1 ? 'Guldpoäng' : 'Totalpoäng'}</label>
          <div class="big-num">${fmt(row.total)}<small>p</small></div>
        </div>
        <div class="podium-note">
          ${lead != null ? `<b>${lead > 0 ? `+${fmt(lead)}p marginal` : 'Delad ledning'}</b>` : ''}
          ${behind != null ? `<b class="warn">${fmt(behind)}p bakom #1</b>` : ''}
        </div>
      </div>
      <div class="split">${splitLine(row)}</div>
    </article>`;
  }).join('');

  const restHtml = rest.map((row) => `<div class="board-row">
      <span class="rank-chip rn">#${row.rank}</span>
      <div class="board-name">
        ${avatar(row.team)}
        <div><b>${esc(row.team.name)}</b><span>${esc(row.team.members)}</span></div>
      </div>
      <div class="board-split">${splitLine(row)}</div>
      <div class="board-delta">${deltaBadge(row.team.id)}</div>
      <div class="board-total">${fmt(row.total)}<small>p</small></div>
    </div>`).join('');

  return `
    ${announceBar()}
    <div class="layout">
      <section>
        <div class="kicker">🏆 Topp-trio · Ärans bord</div>
        <div class="title-row">
          <h1 class="display">Mästerskapspallen</h1>
          <span class="muted small">Uppdateras live från domarbordet</span>
        </div>
        ${rows.length ? `<div class="podium-grid">${podiumHtml}</div>` : emptyTeams()}
        ${rest.length ? `
          <div class="title-row mt">
            <h2 class="headline">Övriga utmanare <span class="tag">${rest.length} lag</span></h2>
            <span class="muted small">Sorterat efter festpoäng · lika poäng avgörs av utslagsfrågan</span>
          </div>
          <div class="board">${restHtml}</div>` : ''}
      </section>
      <aside class="side">
        ${currentGrenCard()}
        ${progressCard()}
        ${logCard(5)}
      </aside>
    </div>`;
}

function currentGrenCard() {
  const list = grenar();
  if (!list.length) return '';
  const g = list.find((x) => x.id === S.current) ?? list[0];
  const idx = grenIndex(g.id);
  const next = list[idx + 1];
  return `<div class="card glow">
      <div class="card-head"><span class="kicker dot">Aktuell gren</span><span class="tag">Gren ${idx + 1} av ${list.length}</span></div>
      <div class="gren-title"><span class="gren-icon">${g.icon}</span><div><h2 class="headline">${esc(g.sv)}</h2><div class="de">${esc(g.de)}</div></div></div>
      <p class="muted">${esc(g.desc)}</p>
      ${scoringChips(g)}
    </div>
    ${next ? `<div class="card">
      <div class="card-head"><span class="kicker blue">Nästa gren</span></div>
      <div class="gren-title small"><span class="gren-icon">${next.icon}</span><div><h3>${esc(next.sv)}</h3><div class="de">${esc(next.de)}</div></div></div>
    </div>` : '<div class="card"><div class="kicker">🎉 Sista grenen – prisutdelning efter musikquizet!</div></div>'}`;
}

function progressCard() {
  const list = grenar();
  const done = list.filter((g) => grenDone(g.id)).length;
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  return `<div class="card">
    <div class="card-head"><span class="kicker">🍺 Stämningsmätare</span><b class="gold">${done} / ${list.length} grenar</b></div>
    <div class="meter"><span style="width:${pct}%"></span></div>
    <div class="row between small muted"><span>Max möjligt: ${maxTotal()} p per lag</span><span>${pct}% avklarat</span></div>
  </div>`;
}

function logCard(limit) {
  const items = S.log.slice(0, limit);
  return `<div class="card">
    <div class="card-head"><span class="kicker">Senaste händelser</span><span class="tag">Logg</span></div>
    ${items.length ? `<ul class="log">${items.map((l) => `<li>
      <div><b>${esc(l.text)}</b><span>${timeAgo(l.ts)}</span></div>
      ${l.pts != null ? `<span class="pts ${l.pts < 0 ? 'neg' : ''}">${signed(l.pts)}p</span>` : ''}
    </li>`).join('')}</ul>` : '<p class="muted small">Inget har hänt ännu.</p>'}
  </div>`;
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'nyss';
  if (s < 3600) return `${Math.round(s / 60)} min sedan`;
  return new Date(ts).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function scoringChips(g) {
  if (isLek(g.id)) {
    return `<div class="chips">
      <span class="chip gold">Vinst +${WIN_POINTS}p</span>
      <span class="chip blue">Deltog +${PART_POINTS}p</span>
      ${g.penalty ? `<span class="chip red">${esc(g.penalty.label)} ${g.penalty.value}p</span>` : ''}
    </div>`;
  }
  if (g.id === QUIZ.id) {
    return `<div class="chips">
      <span class="chip gold">18 meningar × 1p</span>
      <span class="chip blue">Halv poäng för nästan rätt</span>
      <span class="chip amber">Bonus +${QUIZ.bonusPoints}p</span>
      <span class="chip">Max ${QUIZ.max}p</span>
    </div>`;
  }
  return `<div class="chips">
    <span class="chip gold">Artist 1p</span>
    <span class="chip gold">Låt 1p</span>
    <span class="chip amber">Utslagsfråga 1p</span>
    <span class="chip">Max ${MUSIC.max}p</span>
  </div>`;
}

// Poängutdelning -----------------------------------------------------------

function viewPoang() {
  const list = grenar();
  if (!list.length) return '<div class="empty card"><h2>Alla grenar är avstängda</h2><p class="muted">Sätt på grenar under Grenar &amp; Regler.</p><a class="btn gold" href="#grenar">Till Grenar &amp; Regler</a></div>';
  const onExtra = ui.game === 'extra';
  const g = list.find((x) => x.id === (ui.game ?? S.current)) ?? list.find((x) => x.id === S.current) ?? list[0];
  const idx = grenIndex(g.id);
  const rows = scoreboard();

  const tabs = `<button class="tab ${onExtra ? 'on' : ''}" data-act="pickGame" data-id="extra" type="button"><span>⭐</span>Extrapoäng</button>` + list.map((x, i) => `<button class="tab ${x.id === g.id && !onExtra ? 'on' : ''}" data-act="pickGame" data-id="${x.id}" type="button">
      <span>${x.icon}</span>${esc(x.sv)}${x.id === S.current ? '<i class="live-dot" title="Visas på storskärmen"></i>' : ''}${grenDone(x.id) && (x.id !== g.id || onExtra) ? '<i class="done">✓</i>' : ''}
      <small>${i + 1}</small>
    </button>`).join('');

  // Fast ordning (anmälningsordning) så att korten inte hoppar runt medan domaren klickar.
  const stable = S.teams.map((t) => rows.find((r) => r.team.id === t.id));
  const side = `<aside class="side">
        ${announceForm()}
        ${miniStandings(rows)}
        ${logCard(10)}
      </aside>`;

  if (onExtra) {
    return `
    <div class="tabs">${tabs}</div>
    <div class="layout">
      <section>
        <div class="card gren-header">
          <span class="gren-icon lg">⭐</span>
          <div class="grow">
            <h1 class="headline-xl">Extrapoäng <span class="de">Sonderpunkte</span></h1>
            <p class="muted">Pluspoäng, eller minuspoäng, utanför grenarna. T.ex. för snyggaste dräkten eller bästa hejarklacken. Välj antal, skriv en anledning och tryck Ge. Anledningen syns i Senaste händelser.</p>
          </div>
        </div>
        ${S.teams.length ? extraScoring(stable) : emptyTeams()}
      </section>
      ${side}
    </div>`;
  }
  let body;
  if (!S.teams.length) body = emptyTeams();
  else if (isLek(g.id)) body = lekScoring(g, stable);
  else if (g.id === QUIZ.id) body = quizScoring(stable);
  else body = musicScoring(stable);

  return `
    <div class="tabs">${tabs}</div>
    <div class="layout">
      <section>
        <div class="card gren-header">
          <span class="gren-icon lg">${g.icon}</span>
          <div class="grow">
            <div class="kicker"><span class="tag gold">Gren ${idx + 1} av ${list.length}</span> ${S.current === g.id ? '<span class="tag live">● På storskärmen</span>' : ''}</div>
            <h1 class="headline-xl">${esc(g.sv)} <span class="de">${esc(g.de)}</span></h1>
            <p class="muted">${esc(g.desc)}</p>
            ${scoringChips(g)}
          </div>
          <div class="gren-actions">
            ${S.current !== g.id ? `<button class="btn blue" data-act="setCurrent" data-id="${g.id}" type="button">📺 Visa på storskärm</button>` : ''}
            ${isLek(g.id) && S.teams.length ? `<button class="btn ghost" data-act="allPart" data-id="${g.id}" type="button">Alla deltog +1</button>` : ''}
            ${!isLek(g.id) ? `<button class="btn ghost" data-act="toggleFacit" type="button">${ui.showFacit ? '🙈 Dölj facit' : '👁 Visa facit'}</button>` : ''}
          </div>
        </div>
        ${body}
      </section>
      ${side}
    </div>`;
}

function extraScoring(rows) {
  const cards = rows.map((row) => {
    const team = row.team;
    const amt = ui.extraAmt[team.id] ?? 1;
    const given = (S.extra?.[team.id] ?? []).slice().reverse().map((e) => `<li>
        <b class="${e.pts < 0 ? 'neg' : 'gold'}">${signed(e.pts)}</b>
        <span>${esc(e.reason) || '<i class="muted">Ingen anledning</i>'}</span>
        <button class="x" data-act="removeExtra" data-team="${team.id}" data-id="${e.id}" type="button" aria-label="Ta bort extrapoängen" title="Ta bort">✕</button>
      </li>`).join('');
    // Hoppar över noll så att stegningen går direkt från +1 till −1.
    const down = amt - 1 === 0 ? -1 : amt - 1;
    const up = amt + 1 === 0 ? 1 : amt + 1;
    return `<form class="score-card" data-form="extra" data-team="${team.id}">
      <header>
        <div>
          <h3>${esc(team.name)}</h3>
          <span class="members">${esc(team.members) || '&nbsp;'}</span>
        </div>
        ${team.photo ? avatar(team, 'sm') : ''}
        <span class="rank-chip ${rankClass(row.rank)}">#${row.rank}</span>
      </header>
      <div class="now">
        <div><label>Extra</label><b class="${row.extra < 0 ? 'neg' : ''}">${signed(row.extra)}</b></div>
        <div><label>Totalt</label><b class="gold">${fmt(row.total)}</b></div>
      </div>
      <div class="stepper plus">
        <span>Antal poäng</span>
        <button data-act="extraAmt" data-team="${team.id}" data-v="${down}" type="button" ${amt <= -50 ? 'disabled' : ''} aria-label="Färre poäng">−</button>
        <b class="${amt < 0 ? 'neg' : ''}">${signed(amt)}</b>
        <button data-act="extraAmt" data-team="${team.id}" data-v="${up}" type="button" ${amt >= 50 ? 'disabled' : ''} aria-label="Fler poäng">+</button>
      </div>
      <input id="ex-reason-${team.id}" name="reason" maxlength="80" placeholder="Anledning, t.ex. snyggaste dräkten" autocomplete="off">
      <button class="btn ${amt < 0 ? 'danger' : 'gold'}" type="submit">Ge ${signed(amt)}p</button>
      ${given ? `<ul class="extra-list">${given}</ul>` : ''}
    </form>`;
  }).join('');
  return `<div class="score-grid">${cards}</div>`;
}

function lekScoring(g, rows) {
  const cards = rows.map((row) => {
    const team = row.team;
    const e = S.games[g.id]?.[team.id] ?? { r: '', pen: 0 };
    const pts = row.perGame[g.id];
    return `<article class="score-card ${e.r === 'win' ? 'win' : ''} ${team.status === 'paused' ? 'paused' : ''}">
      <header>
        <div>
          <h3>${esc(team.name)}</h3>
          <span class="members">${esc(team.members) || '&nbsp;'}</span>
        </div>
        ${team.photo ? avatar(team, 'sm') : ''}
        <span class="rank-chip ${rankClass(row.rank)}">#${row.rank}</span>
      </header>
      <div class="now">
        <div><label>I grenen</label><b class="${pts < 0 ? 'neg' : ''}">${signed(pts)}</b></div>
        <div><label>Totalt</label><b class="gold">${fmt(row.total)}</b></div>
      </div>
      <div class="seg">
        <button class="${e.r === 'win' ? 'on gold' : ''}" data-act="setGame" data-game="${g.id}" data-team="${team.id}" data-r="win" type="button">🏆 Vinst +${WIN_POINTS}</button>
        <button class="${e.r === 'part' ? 'on blue' : ''}" data-act="setGame" data-game="${g.id}" data-team="${team.id}" data-r="part" type="button">Deltog +${PART_POINTS}</button>
        <button class="${e.r === '' ? 'on' : ''}" data-act="setGame" data-game="${g.id}" data-team="${team.id}" data-r="" type="button">–</button>
      </div>
      ${g.penalty ? `<div class="stepper">
        <span>${esc(g.penalty.label)} <small>${g.penalty.value}p st</small></span>
        <button data-act="pen" data-game="${g.id}" data-team="${team.id}" data-v="${Math.max(0, e.pen - 1)}" type="button" ${e.pen === 0 ? 'disabled' : ''} aria-label="Ta bort minuspoäng">−</button>
        <b>${e.pen}</b>
        <button data-act="pen" data-game="${g.id}" data-team="${team.id}" data-v="${e.pen + 1}" type="button" aria-label="Lägg till minuspoäng">+</button>
      </div>` : ''}
    </article>`;
  }).join('');
  const hint = g.id === 'verboten'
    ? '<p class="note">Säger någon ”öl” och blir påkommen trycker du + vid ”Sagt öl” på lagets kort. Varje gång ger −1p.</p>'
    : g.id === 'kellner'
      ? '<p class="note">Tiden avgör: lägg på fem sekunder för varje spillt glas innan vinnaren utses.</p>'
      : '';
  return `${hint}<div class="score-grid">${cards}</div>`;
}

function teamPicker(key, rows, pointsOf) {
  const selected = rows.find((r) => r.team.id === ui[key])?.team.id ?? rows[0]?.team.id;
  ui[key] = selected;
  return {
    selected,
    html: `<div class="picker">${rows.map((r) => `<button class="pick ${r.team.id === selected ? 'on' : ''}" data-act="pickTeam" data-key="${key}" data-id="${r.team.id}" type="button">
        ${esc(r.team.name)} <b>${fmt(pointsOf(r))}</b>
      </button>`).join('')}</div>`,
  };
}

function quizScoring(rows) {
  const { selected, html } = teamPicker('quizTeam', rows, (r) => r.quiz);
  const team = S.teams.find((t) => t.id === selected);
  const e = S.quiz[selected] ?? { q: Array(QUIZ.sentences.length).fill(0), bonus: 0 };
  const total = quizPoints(e);
  const show = ui.showFacit && facit;

  const lines = QUIZ.sentences.map((s, i) => `<div class="q-row">
      <span class="q-nr">${i + 1}</span>
      <div class="q-text">
        <b>${esc(s.de)}${s.idiom ? ' <span class="star" title="Talesätt">★</span>' : ''}</b>
        ${show ? `<span class="facit">${esc(facit.quiz[i].sv)}${facit.quiz[i].note ? ` <em>${esc(facit.quiz[i].note)}</em>` : ''}</span>` : ''}
      </div>
      <div class="seg sm">
        ${[0, 0.5, 1].map((v) => `<button class="${e.q[i] === v ? (v === 0 ? 'on' : 'on gold') : ''}" data-act="quiz" data-team="${selected}" data-idx="${i}" data-v="${v}" type="button">${v === 0.5 ? '½' : v}</button>`).join('')}
      </div>
    </div>`).join('');

  const bonus = `<div class="q-row bonus">
      <span class="q-nr">★</span>
      <div class="q-text">
        <span class="tag amber">Bonus · ${QUIZ.bonusPoints} poäng</span>
        <b>${esc(QUIZ.bonus.de)}</b>
        ${show ? `<span class="facit">${esc(facit.bonus.sv)} <em>${esc(facit.bonus.note)}</em></span>` : ''}
      </div>
      <div class="seg sm">
        ${[0, 1, 2].map((v) => `<button class="${e.bonus === v ? (v === 0 ? 'on' : 'on gold') : ''}" data-act="quiz" data-team="${selected}" data-idx="${QUIZ.sentences.length}" data-v="${v}" type="button">${v}</button>`).join('')}
      </div>
    </div>`;

  return `${html}
    <div class="card">
      <div class="card-head">
        <span class="kicker">Rättar: ${esc(team?.name)}</span>
        <span class="muted small">Talesätten är 6, 7, 11 och 16</span>
      </div>
      <div class="q-list">${lines}${bonus}</div>
      <div class="sum-bar">
        <div><label>Summa</label><span class="big-num">${fmt(total)}<small>/ ${QUIZ.max}p</small></span></div>
        <div class="row">
          <button class="btn ghost" data-act="quizAll" data-team="${selected}" data-v="1" type="button">Alla rätt</button>
          <button class="btn ghost" data-act="quizAll" data-team="${selected}" data-v="0" type="button">Nollställ</button>
          <button class="btn gold" data-act="logResult" data-game="${QUIZ.id}" data-team="${selected}" data-pts="${total}" type="button">✓ Klar – logga</button>
        </div>
      </div>
    </div>`;
}

function musicScoring(rows) {
  const { selected, html } = teamPicker('musicTeam', rows, (r) => r.music);
  const team = S.teams.find((t) => t.id === selected);
  const n = MUSIC.songCount;
  const e = S.music[selected] ?? { a: Array(n).fill(false), t: Array(n).fill(false), guess: null };
  const total = musicPoints(e);
  const show = ui.showFacit && facit;

  const lines = Array.from({ length: n }, (_, i) => facit?.songs[i]).map((s, i) => `<div class="q-row">
      <span class="q-nr">${i + 1}</span>
      <div class="q-text">
        ${show ? `<b>${esc(s.artist)} – <i>${esc(s.title)}</i> <span class="muted">${s.year}</span></b><span class="facit">${esc(s.fact)}</span>` : `<b>Låt ${i + 1}</b><span class="muted small">Facit dolt</span>`}
      </div>
      <div class="seg sm">
        <button class="${e.a[i] ? 'on gold' : ''}" data-act="music" data-team="${selected}" data-song="${i}" data-field="a" data-v="${!e.a[i]}" type="button">Artist ${e.a[i] ? '✓' : ''}</button>
        <button class="${e.t[i] ? 'on gold' : ''}" data-act="music" data-team="${selected}" data-song="${i}" data-field="t" data-v="${!e.t[i]}" type="button">Låt ${e.t[i] ? '✓' : ''}</button>
      </div>
    </div>`).join('');

  const ok = tiebreakOk(e);
  const tb = MUSIC.tiebreak;
  const tie = `<div class="q-row bonus">
      <span class="q-nr">?</span>
      <div class="q-text">
        <span class="tag amber">Utslagsfråga · 1 poäng</span>
        <b>${esc(tb.q)}</b>
        ${show ? `<span class="facit">${esc(facit.tiebreak.note)}</span>` : '<span class="muted small">Närmast utan att gå över vinner vid lika poäng.</span>'}
      </div>
      <div class="guess">
        <input id="guess-${selected}" type="number" min="0" max="${n}" inputmode="numeric" placeholder="Svar" value="${e.guess ?? ''}" data-act="guess" data-team="${selected}" aria-label="Lagets svar på utslagsfrågan">
        ${e.guess != null ? `<span class="chip ${ok ? 'gold' : 'red'}">${ok ? '+1p' : '0p'}</span>` : ''}
      </div>
    </div>`;

  return `${html}
    <div class="card">
      <div class="card-head">
        <span class="kicker">Rättar: ${esc(team?.name)}</span>
        <span class="muted small">Stavfel ger poäng ändå</span>
      </div>
      <div class="q-list">${lines}${tie}</div>
      <div class="sum-bar">
        <div><label>Summa</label><span class="big-num">${fmt(total)}<small>/ ${MUSIC.max}p</small></span></div>
        <div class="row">
          <button class="btn ghost" data-act="musicAll" data-team="${selected}" data-v="true" type="button">Alla rätt</button>
          <button class="btn ghost" data-act="musicAll" data-team="${selected}" data-v="false" type="button">Nollställ</button>
          <button class="btn gold" data-act="logResult" data-game="${MUSIC.id}" data-team="${selected}" data-pts="${total}" type="button">✓ Klar – logga</button>
        </div>
      </div>
    </div>`;
}

function announceForm() {
  return `<form class="card" data-form="announce">
    <div class="card-head"><span class="kicker">📣 Utrop till salen</span></div>
    <div class="row">
      <input id="announceInput" name="text" maxlength="200" placeholder="t.ex. SKÅL ALLIHOPA!" value="">
      <button class="btn gold" type="submit">Skicka</button>
    </div>
    ${S.announce ? `<div class="row between small mt-s"><span class="muted">Visas nu: ”${esc(S.announce)}”</span><button class="link" data-act="clearAnnounce" type="button">Ta bort</button></div>` : ''}
  </form>`;
}

function miniStandings(rows) {
  if (!rows.length) return '';
  const anyExtra = rows.some((r) => r.extra);
  return `<div class="card">
    <div class="card-head"><span class="kicker">Ställning</span><a class="link" href="#topplista">Storskärm →</a></div>
    <table class="mini">
      <thead><tr><th>#</th><th>Lag</th><th title="Lekar">L</th><th title="Meningar">M</th><th title="Musik">Q</th>${anyExtra ? '<th title="Extrapoäng">E</th>' : ''}<th>Tot</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td><span class="rank-chip sm ${rankClass(r.rank)}">${r.rank}</span></td>
        <td class="name">${esc(r.team.name)}</td>
        <td>${fmt(r.lekar)}</td><td>${fmt(r.quiz)}</td><td>${fmt(r.music)}</td>${anyExtra ? `<td>${signed(r.extra)}</td>` : ''}
        <td class="gold"><b>${fmt(r.total)}</b></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

// Deltagare & lag ----------------------------------------------------------

function countMembers() {
  return S.teams.reduce((n, t) => n + t.members.split(/,|&|\boch\b|\+/i).map((s) => s.trim()).filter(Boolean).length, 0);
}

function photoField(team, key) {
  const draft = ui.photo[key];
  const src = draft?.remove ? null : draft?.url ?? (team?.photo ? photoUrl(team) : null);
  return `<div class="photo-field">
    <span class="avatar lg">${src ? `<img src="${src}" alt="">` : '📷'}</span>
    <div class="row wrap">
      <label class="btn ghost sm">📷 Ta foto<input type="file" accept="image/*" capture="environment" data-photo="${key}" hidden></label>
      <label class="btn ghost sm">🖼 Välj bild<input type="file" accept="image/*" data-photo="${key}" hidden></label>
      ${src ? `<button class="btn ghost sm" data-act="removePhoto" data-key="${key}" type="button">Ta bort bild</button>` : ''}
    </div>
  </div>`;
}

function teamForm(team) {
  const id = team ? team.id : 'new';
  return `<form class="card team-form" data-form="${team ? 'editTeam' : 'addTeam'}" data-id="${team?.id ?? ''}">
    <div class="card-head"><span class="kicker">${team ? 'Redigera lag' : 'Nytt lag'}</span></div>
    <label>Lagnamn<input id="tf-name-${id}" name="name" maxlength="60" required value="${esc(team?.name)}" placeholder="t.ex. Lederhosen Legends"></label>
    <label>Kämpar<input id="tf-members-${id}" name="members" maxlength="200" value="${esc(team?.members)}" placeholder="Erik, Sara & Johan"></label>
    <label>Motto<input id="tf-motto-${id}" name="motto" maxlength="200" value="${esc(team?.motto)}" placeholder="Vi dricker inte för att vinna…"></label>
    ${photoField(team, id)}
    <div class="row end">
      <button class="btn ghost" data-act="${team ? 'cancelEdit' : 'toggleAdd'}" type="button">Avbryt</button>
      <button class="btn gold" type="submit">${team ? 'Spara' : '＋ Lägg till'}</button>
    </div>
  </form>`;
}

function confirmBtn(key, label, act, data = '') {
  const armed = ui.confirm === key;
  return `<button class="btn ${armed ? 'danger' : 'ghost'} sm" data-act="${armed ? act : 'arm'}" data-key="${key}" ${data} type="button">${armed ? 'Säker? Klicka igen' : label}</button>`;
}

function viewLag() {
  const rows = scoreboard();
  const done = grenar().filter((g) => grenDone(g.id)).length;
  const cards = rows.map((row) => {
    const t = row.team;
    if (admin && ui.editTeam === t.id) return teamForm(t);
    const label = row.rank === 1 ? 'Guld' : row.rank === 2 ? 'Silver' : row.rank === 3 ? 'Brons' : '';
    return `<article class="team-card ${t.status === 'paused' ? 'paused' : ''}">
      <span class="rank-flag ${rankClass(row.rank)}">Rank #${row.rank}${label ? ` (${label})` : ''}${t.status === 'paused' ? ' · pausad' : ''}</span>
      <div class="team-top">
        ${avatar(t, 'lg')}
        <div class="grow">
          <h3 class="team-name">${esc(t.name)}</h3>
          <span class="status ${t.status}">● ${t.status === 'active' ? 'Aktiv' : 'Pausad'}</span>
        </div>
        <div class="team-pts"><b>${fmt(row.total)}</b><label>Poäng</label></div>
      </div>
      <div class="well"><label>🙋 Kämpar</label><div>${esc(t.members) || '<span class="muted">Inga namn angivna</span>'}</div></div>
      ${t.motto ? `<div class="motto">“${esc(t.motto)}”</div>` : ''}
      <div class="split">${splitLine(row)}</div>
      ${admin ? `<div class="team-actions">
        <button class="btn ghost sm" data-act="editTeam" data-id="${t.id}" type="button">✎ Redigera</button>
        <button class="btn ghost sm" data-act="toggleStatus" data-id="${t.id}" type="button">${t.status === 'active' ? '⏸ Pausa' : '▶ Aktivera'}</button>
        ${confirmBtn(`del-${t.id}`, '🗑 Ta bort', 'deleteTeam', `data-id="${t.id}"`)}
      </div>` : ''}
    </article>`;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <div class="kicker">🏁 Turneringstraktat &amp; roster</div>
        <h1 class="display">Laguppställning &amp; Deltagare</h1>
        <p class="muted">Registrera kvällens kämpar innan första grenen. Poängen räknas per lag.</p>
      </div>
      <div class="stats">
        <div><label>Registrerade lag</label><b>${S.teams.length}</b></div>
        <div><label>Deltagare</label><b>${countMembers()}</b></div>
        <div><label>Grenar klara</label><b>${done} / ${grenar().length}</b></div>
      </div>
    </div>
    ${admin ? `<div class="toolbar card">
      <button class="btn gold" data-act="toggleAdd" type="button">＋ Lägg till lag</button>
      <span class="muted small">Tips: skriv kämparna separerade med komma eller &amp;.</span>
    </div>` : ''}
    ${admin && ui.addOpen ? teamForm(null) : ''}
    ${rows.length ? `<div class="team-grid">${cards}</div>` : (admin && ui.addOpen ? '' : emptyTeams())}
    ${admin ? `<div class="card danger-zone">
      <div class="card-head"><span class="kicker red">Festkommitténs verktyg</span></div>
      <div class="row wrap">
        <a class="btn ghost sm" href="api/state" download="oktoberfest-poang.json">⬇ Ladda ner säkerhetskopia</a>
        ${confirmBtn('reset-scores', 'Nollställ alla poäng (behåll lag)', 'reset', 'data-keep="true"')}
        ${confirmBtn('reset-all', 'Radera allt', 'reset', 'data-keep="false"')}
      </div>
    </div>` : ''}`;
}

// Grenar & regler ----------------------------------------------------------

function viewGrenar() {
  const list = grenar();
  const done = list.filter((g) => grenDone(g.id)).length;
  const timeline = list.map((g, i) => {
    const cls = g.id === S.current ? 'live' : grenDone(g.id) ? 'done' : '';
    const tag = admin ? 'button' : 'div';
    const attrs = admin ? `data-act="goScore" data-id="${g.id}" type="button"` : '';
    return `<${tag} class="step ${cls}" ${attrs} title="${esc(g.sv)}">
      <span class="bar"></span><b>G${i + 1}</b><span>${g.icon}</span>
    </${tag}>`;
  }).join('');

  // Domaren ser även avstängda grenar, så att de kan sättas på igen.
  const cards = (admin ? ALL_GRENAR : list).map((g) => {
    const on = isOn(g.id);
    const i = grenIndex(g.id);
    const status = !on ? '<span class="tag">Avstängd</span>' : g.id === S.current ? '<span class="tag live">● Pågår nu</span>' : grenDone(g.id) ? '<span class="tag">Avklarad</span>' : '<span class="tag">Kommande</span>';
    let extra = '';
    if (g.twisters) {
      extra = `<div class="well"><label>Tungvrickare</label><ol class="twisters">${g.twisters.map((t) => `<li><b>${esc(t.de)}</b><span>${esc(t.sv)}</span></li>`).join('')}</ol></div>`;
    } else if (g.id === QUIZ.id) {
      extra = `<div class="well"><label>Blatt 2 · ${QUIZ.sentences.length} meningar + bonus</label><p class="small">Talesätten (★) är 6, 7, 11 och 16. Godkänn allt som fångar betydelsen. Bonus: <b>${esc(QUIZ.bonus.de)}</b></p></div>`;
    } else if (g.id === MUSIC.id) {
      extra = `<div class="well"><label>Utslagsfråga · 1 poäng</label><p class="small">${esc(MUSIC.tiebreak.q)} Närmast utan att gå över vinner vid lika totalpoäng.</p></div>`;
    }
    return `<article class="card gren-card ${on && g.id === S.current ? 'glow' : ''} ${on ? '' : 'off'}">
      <div class="card-head"><div class="row">${on ? `<span class="tag gold">Gren ${i + 1}</span>` : ''}${status}</div><span class="gren-icon">${g.icon}</span></div>
      <h3 class="headline">${esc(g.sv)}</h3>
      <div class="de">${esc(g.de)}</div>
      <p>${esc(g.desc)}</p>
      ${extra}
      ${scoringChips(g)}
      <div class="gren-foot">
        <span class="muted small"><b>Behövs:</b> ${esc(g.kit)}</span>
        ${admin ? `<div class="row">
          <button class="btn ghost sm" data-act="toggleGren" data-id="${g.id}" data-on="${!on}" type="button">${on ? '⏸ Stäng av' : '▶ Sätt på'}</button>
          ${on && g.id !== S.current ? `<button class="btn ghost sm" data-act="setCurrent" data-id="${g.id}" type="button">📺 Starta</button>` : ''}
          ${on ? `<button class="btn gold sm" data-act="goScore" data-id="${g.id}" type="button">Poängsätt →</button>` : ''}
        </div>` : ''}
      </div>
    </article>`;
  }).join('');

  return `
    <div class="page-head">
      <div>
        <div class="kicker">Oktoberfest 3 oktober · Huvudreglemente</div>
        <h1 class="display">Grenar &amp; Tävlingsregler</h1>
        <p class="muted">Lekar, meningsquiz och musikquiz. Allt går att köra med vatten i sejdlarna. Utse en Festleiter som visslar mellan momenten.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><span class="kicker">Mästerskapsstatus</span><h2 class="headline">${done} av ${list.length} grenar avklarade</h2></div></div>
      <div class="timeline" style="--n:${list.length}">${timeline}</div>
    </div>
    <div class="max-grid">
      <div class="card"><label>Lekar</label><b>${maxLekar() / WIN_POINTS} × ${WIN_POINTS}p</b><span>Max ${maxLekar()}p · ${PART_POINTS}p för deltagande</span></div>
      <div class="card"><label>Meningsquiz</label><b>${isOn(QUIZ.id) ? `${QUIZ.max}p` : 'Avstängd'}</b><span>18 meningar + 2p bonus</span></div>
      <div class="card"><label>Musikquiz</label><b>${isOn(MUSIC.id) ? `${MUSIC.max}p` : 'Avstängd'}</b><span>${MUSIC.songCount} låtar × 2p + utslagsfråga</span></div>
      <div class="card gold-card"><label>Totalt max</label><b>${maxTotal()}p</b><span>Prisutdelning efter musikquizet</span></div>
    </div>
    <div class="gren-grid">${cards}</div>
    <div class="card info"><span>ⓘ</span><p><b>Protest eller regelfrågor?</b> Festleitern har sista ordet – och den som säger ”öl” istället för ”Bier” ger laget en minuspoäng.</p></div>`;
}

// --- händelser -------------------------------------------------------------

const actions = {
  pickGame: (d) => { ui.game = d.id; render(); },
  goScore: (d) => { ui.game = d.id; location.hash = 'poang'; },
  pickTeam: (d) => { ui[d.key] = d.id; render(); },
  toggleFacit: () => { ui.showFacit = !ui.showFacit; render(); },
  toggleGren: (d) => op('setGrenOn', { game: d.id, on: d.on === 'true' }).then((ok) => ok && toast(d.on === 'true' ? 'Grenen är på' : 'Grenen är avstängd')),
  setCurrent: (d) => op('setCurrent', { game: d.id }).then((ok) => ok && toast('Grenen visas nu på storskärmen')),
  setGame: (d) => op('setGame', { game: d.game, team: d.team, r: d.r }),
  pen: (d) => op('setGame', { game: d.game, team: d.team, pen: Number(d.v) }),
  extraAmt: (d) => { ui.extraAmt[d.team] = Number(d.v); render(); },
  removeExtra: (d) => op('removeExtra', { team: d.team, id: d.id }).then((ok) => ok && toast('Extrapoängen borttagen')),
  allPart: async (d) => {
    const todo = S.teams.filter((t) => !S.games[d.id]?.[t.id]?.r);
    for (const t of todo) if (!(await op('setGame', { game: d.id, team: t.id, r: 'part' }))) return;
    toast(todo.length ? `${todo.length} lag fick deltagarpoäng` : 'Alla lag har redan ett resultat');
  },
  quiz: (d) => op('setQuiz', { team: d.team, idx: Number(d.idx), value: Number(d.v) }),
  quizAll: async (d) => {
    const v = Number(d.v);
    for (let i = 0; i < QUIZ.sentences.length; i++) if (!(await op('setQuiz', { team: d.team, idx: i, value: v }))) return;
    await op('setQuiz', { team: d.team, idx: QUIZ.sentences.length, value: v ? QUIZ.bonusPoints : 0 });
  },
  music: (d) => op('setMusic', { team: d.team, song: Number(d.song), field: d.field, value: d.v === 'true' }),
  musicAll: async (d) => {
    const v = d.v === 'true';
    for (let i = 0; i < MUSIC.songCount; i++) {
      if (!(await op('setMusic', { team: d.team, song: i, field: 'a', value: v }))) return;
      await op('setMusic', { team: d.team, song: i, field: 't', value: v });
    }
  },
  logResult: (d) => op('logResult', { game: d.game, team: d.team, pts: Number(d.pts) }).then((ok) => ok && toast('Resultatet loggat')),
  clearAnnounce: () => op('announce', { text: '' }),
  toggleAdd: () => { ui.addOpen = !ui.addOpen; clearPhotoDraft('new'); render(); document.getElementById('tf-name-new')?.focus(); },
  editTeam: (d) => { ui.editTeam = d.id; render(); },
  cancelEdit: () => { clearPhotoDraft(ui.editTeam); ui.editTeam = null; render(); },
  removePhoto: (d) => { clearPhotoDraft(d.key); ui.photo[d.key] = { remove: true }; render(); },
  toggleStatus: (d) => {
    const t = S.teams.find((x) => x.id === d.id);
    return op('updateTeam', { id: d.id, status: t.status === 'active' ? 'paused' : 'active' });
  },
  arm: (d) => {
    ui.confirm = d.key;
    render();
    setTimeout(() => { if (ui.confirm === d.key) { ui.confirm = null; render(); } }, 4000);
  },
  deleteTeam: (d) => { ui.confirm = null; return op('deleteTeam', { id: d.id }); },
  reset: (d) => { ui.confirm = null; return op('reset', { keepTeams: d.keep === 'true' }).then((ok) => ok && toast('Nollställt')); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  ev.preventDefault();
  fn({ ...el.dataset });
});

document.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset?.photo && el.files?.[0]) {
    const key = el.dataset.photo;
    try {
      const blob = await shrinkPhoto(el.files[0]);
      clearPhotoDraft(key);
      ui.photo[key] = { blob, url: URL.createObjectURL(blob) };
    } catch {
      toast('Kunde inte läsa bilden', true);
    }
    render();
    return;
  }
  if (el.dataset?.act !== 'guess') return;
  const v = el.value === '' ? null : Number(el.value);
  op('setGuess', { team: el.dataset.team, guess: v });
});

document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const kind = form.dataset.form;
  if (kind === 'announce') {
    if (data.text && (await op('announce', { text: data.text }))) {
      form.reset();
      toast('Utropet visas på storskärmen');
    }
  } else if (kind === 'addTeam') {
    const res = await op('addTeam', data);
    if (res) {
      if (res.id) await savePhoto(res.id, 'new');
      ui.addOpen = false;
      toast(`${data.name} är anmält!`);
    }
  } else if (kind === 'extra') {
    const team = form.dataset.team;
    const pts = ui.extraAmt[team] ?? 1;
    if (await op('addExtra', { team, pts, reason: data.reason ?? '' })) {
      // Formuläret kan redan ha ritats om av live-uppdateringen, så töm fältet som syns nu.
      const input = document.getElementById(`ex-reason-${team}`);
      if (input) input.value = '';
      ui.extraAmt[team] = 1;
      toast(`${signed(pts)}p till ${S.teams.find((t) => t.id === team)?.name ?? 'laget'}`);
    }
  } else if (kind === 'editTeam') {
    if (await op('updateTeam', { id: form.dataset.id, ...data })) {
      await savePhoto(form.dataset.id, form.dataset.id);
      ui.editTeam = null;
    }
  }
  render();
});

document.getElementById('adminBtn').addEventListener('click', () => {
  if (admin) logout();
  else if (pinRequired) askPin();
  else login('').then((error) => toast(error ?? 'Inloggad som domare', !!error));
});

document.getElementById('fullscreenBtn').addEventListener('click', () => {
  location.hash = 'topplista';
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.();
});

document.addEventListener('fullscreenchange', () => document.body.classList.toggle('tv', !!document.fullscreenElement));
window.addEventListener('hashchange', () => { ui.confirm = null; render(); window.scrollTo(0, 0); });
setInterval(() => { if (route() === 'topplista') render(); }, 30_000);

// Kom ihåg inloggningen mellan besök, men kontrollera att PIN-koden fortfarande stämmer.
async function init() {
  const cfg = await fetch('api/config').then((r) => r.json()).catch(() => ({}));
  pinRequired = cfg.pinRequired !== false;
  if (store('okt-pin') !== null && (await login(pin))) store('okt-pin', null);
}

render();
connect();
init();
