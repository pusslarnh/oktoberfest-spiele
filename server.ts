// Oktoberfest Spiele – poängserver.
// Körs direkt av Node 24 (inbyggd TypeScript-typstrippning), inga beroenden.
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, writeFile, rename, mkdir, rm } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GREN_IDS, LEK_IDS, LEKAR, QUIZ, MUSIC } from './public/grenar.js';
import { FACIT } from './facit.ts';

type Result = '' | 'win' | 'part';
type TeamStatus = 'active' | 'paused';

interface Team {
  id: string;
  name: string;
  members: string;
  motto: string;
  status: TeamStatus;
  created: number;
  // Tidpunkt då bilden laddades upp, används för att undvika gammal cache. Saknas = ingen bild.
  photo?: number;
}
interface GameEntry { r: Result; pen: number }
interface QuizEntry { q: number[]; bonus: number }
// ok och dist räknas ut av servern så att svaret på utslagsfrågan inte behöver skickas till alla.
interface MusicEntry { a: boolean[]; t: boolean[]; guess: number | null; ok?: boolean; dist?: number | null }
interface LogEntry { id: string; ts: number; text: string; pts: number | null }

interface State {
  version: number;
  teams: Team[];
  games: Record<string, Record<string, GameEntry>>;
  quiz: Record<string, QuizEntry>;
  music: Record<string, MusicEntry>;
  log: LogEntry[];
  current: string;
  announce: string;
  // Grenar som domaren har stängt av. Poängen sparas men räknas inte.
  disabled: string[];
}

type Op = Record<string, unknown> & { type: string };

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PORT = Number(process.env.PORT ?? 3000);
const DATA_DIR = process.env.DATA_DIR ?? './data';
const ADMIN_PIN = process.env.ADMIN_PIN ?? '';
const PUBLIC_DIR = resolve(import.meta.dirname, 'public');
const STATE_FILE = join(DATA_DIR, 'state.json');
const PHOTO_DIR = join(DATA_DIR, 'photos');
const PHOTO_MAX = 3_000_000;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PHOTO_API = new RegExp(`^/api/teams/(${UUID})/photo$`);
const PHOTO_URL = new RegExp(`^/photos/(${UUID})\\.jpg$`);
const QUIZ_LEN = QUIZ.sentences.length;
const SONG_LEN = MUSIC.songCount;

if (FACIT.quiz.length !== QUIZ_LEN || FACIT.songs.length !== SONG_LEN) {
  throw new Error('facit.ts matchar inte antalet frågor och låtar i public/grenar.js');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function emptyState(): State {
  return { version: 0, teams: [], games: {}, quiz: {}, music: {}, log: [], current: LEK_IDS[0], announce: '', disabled: [] };
}

let state: State = emptyState();
const clients = new Set<ServerResponse>();
let saveChain: Promise<void> = Promise.resolve();

async function load(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = JSON.parse(await readFile(STATE_FILE, 'utf8')) as Partial<State>;
    state = { ...emptyState(), ...raw };
    for (const entry of Object.values(state.music)) scoreGuess(entry);
    console.log(`Laddade ${state.teams.length} lag från ${STATE_FILE}`);
  } catch {
    console.log('Ingen sparad poängställning, startar tomt.');
  }
}

function save(): Promise<void> {
  const snapshot = JSON.stringify(state, null, 2);
  saveChain = saveChain.then(async () => {
    const tmp = `${STATE_FILE}.tmp`;
    await writeFile(tmp, snapshot, 'utf8');
    await rename(tmp, STATE_FILE);
  }).catch((err: unknown) => console.error('Kunde inte spara:', err));
  return saveChain;
}

const photoFile = (teamId: string): string => join(PHOTO_DIR, `${teamId}.jpg`);

function removePhoto(teamId: string): void {
  rm(photoFile(teamId), { force: true }).catch((err: unknown) => console.error('Kunde inte ta bort bild:', err));
}

function broadcast(): void {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) res.write(payload);
}

// --- validering -----------------------------------------------------------

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function teamOf(v: unknown): Team {
  const team = state.teams.find((t) => t.id === v);
  if (!team) throw new HttpError(404, 'Laget finns inte');
  return team;
}

function intIn(v: unknown, min: number, max: number, name: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, `Ogiltigt värde för ${name}`);
  }
  return v;
}

function quizEntry(teamId: string): QuizEntry {
  state.quiz[teamId] ??= { q: Array<number>(QUIZ_LEN).fill(0), bonus: 0 };
  return state.quiz[teamId];
}

function musicEntry(teamId: string): MusicEntry {
  state.music[teamId] ??= { a: Array<boolean>(SONG_LEN).fill(false), t: Array<boolean>(SONG_LEN).fill(false), guess: null };
  return state.music[teamId];
}

// Utslagsfrågan: rätt svar ger 1p, annars avgör avståndet under svaret vid lika poäng.
function scoreGuess(entry: MusicEntry): void {
  const { answer, accept } = FACIT.tiebreak;
  const g = entry.guess;
  entry.ok = g != null && accept.includes(g);
  entry.dist = g == null ? null : entry.ok ? 0 : g > answer ? null : answer - g;
}

function log(text: string, pts: number | null = null): void {
  state.log.unshift({ id: randomUUID(), ts: Date.now(), text, pts });
  state.log.length = Math.min(state.log.length, 80);
}

function gameName(id: string): string {
  if (id === QUIZ.id) return QUIZ.sv;
  if (id === MUSIC.id) return MUSIC.sv;
  return LEKAR.find((l: { id: string }) => l.id === id)?.sv ?? id;
}

// --- operationer ---------------------------------------------------------

function apply(op: Op): string | void {
  switch (op.type) {
    case 'addTeam': {
      const name = str(op.name, 60);
      if (!name) throw new HttpError(400, 'Laget måste ha ett namn');
      const id = randomUUID();
      state.teams.push({ id, name, members: str(op.members, 200), motto: str(op.motto, 200), status: 'active', created: Date.now() });
      log(`Nytt lag: ${name}`);
      return id;
    }
    case 'updateTeam': {
      const team = teamOf(op.id);
      if (op.name !== undefined) {
        const name = str(op.name, 60);
        if (!name) throw new HttpError(400, 'Laget måste ha ett namn');
        team.name = name;
      }
      if (op.members !== undefined) team.members = str(op.members, 200);
      if (op.motto !== undefined) team.motto = str(op.motto, 200);
      if (op.status === 'active' || op.status === 'paused') team.status = op.status;
      break;
    }
    case 'deleteTeam': {
      const team = teamOf(op.id);
      state.teams = state.teams.filter((t) => t.id !== team.id);
      for (const g of Object.values(state.games)) delete g[team.id];
      delete state.quiz[team.id];
      delete state.music[team.id];
      removePhoto(team.id);
      log(`Lag borttaget: ${team.name}`);
      break;
    }
    case 'setGame': {
      const game = String(op.game);
      if (!LEK_IDS.includes(game)) throw new HttpError(400, 'Okänd gren');
      const team = teamOf(op.team);
      const byTeam = (state.games[game] ??= {});
      const entry = (byTeam[team.id] ??= { r: '', pen: 0 });
      if (op.r !== undefined) {
        if (op.r !== '' && op.r !== 'win' && op.r !== 'part') throw new HttpError(400, 'Ogiltigt resultat');
        entry.r = op.r;
        const label = op.r === 'win' ? 'vinst' : op.r === 'part' ? 'deltog' : 'nollställd';
        log(`${team.name} · ${gameName(game)}: ${label}`, op.r === 'win' ? 3 : op.r === 'part' ? 1 : null);
      }
      if (op.pen !== undefined) {
        const pen = intIn(op.pen, 0, 99, 'minuspoäng');
        const diff = pen - entry.pen;
        entry.pen = pen;
        if (diff !== 0) log(`${team.name} · ${gameName(game)}: ${diff > 0 ? 'minuspoäng' : 'minuspoäng borttagen'}`, -diff);
      }
      break;
    }
    case 'setQuiz': {
      const team = teamOf(op.team);
      const entry = quizEntry(team.id);
      const idx = intIn(op.idx, 0, QUIZ_LEN, 'fråga');
      if (idx === QUIZ_LEN) {
        entry.bonus = intIn(op.value, 0, QUIZ.bonusPoints, 'bonus');
      } else {
        if (op.value !== 0 && op.value !== 0.5 && op.value !== 1) throw new HttpError(400, 'Poäng måste vara 0, ½ eller 1');
        entry.q[idx] = op.value;
      }
      break;
    }
    case 'setMusic': {
      const team = teamOf(op.team);
      const entry = musicEntry(team.id);
      const song = intIn(op.song, 0, SONG_LEN - 1, 'låt');
      if (op.field !== 'a' && op.field !== 't') throw new HttpError(400, 'Ogiltigt fält');
      entry[op.field][song] = op.value === true;
      break;
    }
    case 'setGuess': {
      const team = teamOf(op.team);
      const entry = musicEntry(team.id);
      entry.guess = op.guess === null || op.guess === '' ? null : intIn(op.guess, 0, SONG_LEN, 'gissning');
      scoreGuess(entry);
      break;
    }
    case 'logResult': {
      // Sammanfattning efter rättning av quiz, bara för händelseloggen.
      const team = teamOf(op.team);
      const game = String(op.game);
      if (game !== QUIZ.id && game !== MUSIC.id) throw new HttpError(400, 'Okänd gren');
      const pts = typeof op.pts === 'number' && Number.isFinite(op.pts) ? op.pts : null;
      log(`${team.name} · ${gameName(game)}: rättat`, pts);
      break;
    }
    case 'setGrenOn': {
      const game = String(op.game);
      if (!GREN_IDS.includes(game)) throw new HttpError(400, 'Okänd gren');
      const on = op.on === true;
      state.disabled = on ? state.disabled.filter((id) => id !== game) : [...new Set([...state.disabled, game])];
      if (!on && state.current === game) state.current = GREN_IDS.find((id) => !state.disabled.includes(id)) ?? state.current;
      log(`${gameName(game)}: ${on ? 'aktiverad' : 'avstängd'}`);
      break;
    }
    case 'setCurrent': {
      const game = String(op.game);
      if (!GREN_IDS.includes(game)) throw new HttpError(400, 'Okänd gren');
      if (state.disabled.includes(game)) throw new HttpError(400, 'Grenen är avstängd');
      state.current = game;
      log(`Aktuell gren: ${gameName(game)}`);
      break;
    }
    case 'announce': {
      state.announce = str(op.text, 200);
      if (state.announce) log(`Utrop: ${state.announce}`);
      break;
    }
    case 'reset': {
      const keepTeams = op.keepTeams === true;
      const teams = keepTeams ? state.teams : [];
      if (!keepTeams) for (const t of state.teams) removePhoto(t.id);
      state = { ...emptyState(), teams, disabled: state.disabled, version: state.version };
      log(keepTeams ? 'Alla poäng nollställda' : 'Allt nollställt');
      break;
    }
    default:
      throw new HttpError(400, 'Okänd operation');
  }
}

// --- pin -----------------------------------------------------------------

// Enkel spärr mot att gissa PIN: efter 5 fel från samma adress låses den i 30 sekunder.
const failures = new Map<string, { count: number; until: number }>();

function checkPin(req: IncomingMessage, pin: unknown): void {
  if (!ADMIN_PIN) return;
  const ip = req.socket.remoteAddress ?? '';
  const f = failures.get(ip);
  if (f && f.until > Date.now()) throw new HttpError(429, 'För många fel, vänta en stund');
  if (pin === ADMIN_PIN) {
    failures.delete(ip);
    return;
  }
  const count = (f?.count ?? 0) + 1;
  failures.set(ip, { count: count >= 5 ? 0 : count, until: count >= 5 ? Date.now() + 30_000 : 0 });
  throw new HttpError(401, 'Fel PIN-kod');
}

// --- http ----------------------------------------------------------------

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readRaw(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'För stor förfrågan');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readBody(req: IncomingMessage): Promise<string> {
  return (await readRaw(req, 64_000)).toString('utf8');
}

async function commit(): Promise<void> {
  state.version++;
  await save();
  broadcast();
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + sep)) throw new HttpError(403, 'Förbjudet');
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': extname(file) === '.png' ? 'public, max-age=86400' : 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    throw new HttpError(404, 'Hittades inte');
  }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');

  if (pathname === '/api/state' && req.method === 'GET') return sendJson(res, 200, state);
  if (pathname === '/api/config' && req.method === 'GET') return sendJson(res, 200, { pinRequired: ADMIN_PIN !== '' });
  if (pathname === '/healthz') return sendJson(res, 200, { ok: true });

  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    checkPin(req, req.headers['x-admin-pin']);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/facit' && req.method === 'GET') {
    checkPin(req, req.headers['x-admin-pin']);
    return sendJson(res, 200, FACIT);
  }

  const photoApi = PHOTO_API.exec(pathname);
  if (photoApi && (req.method === 'POST' || req.method === 'DELETE')) {
    checkPin(req, req.headers['x-admin-pin']);
    const team = teamOf(photoApi[1]);
    if (req.method === 'DELETE') {
      removePhoto(team.id);
      delete team.photo;
    } else {
      // Webbläsaren skalar alltid om bilden till JPEG innan uppladdning.
      const data = await readRaw(req, PHOTO_MAX);
      if (data.length < 3 || data[0] !== 0xff || data[1] !== 0xd8 || data[2] !== 0xff) throw new HttpError(400, 'Bilden måste vara JPEG');
      await mkdir(PHOTO_DIR, { recursive: true });
      await writeFile(photoFile(team.id), data);
      team.photo = Date.now();
    }
    await commit();
    return sendJson(res, 200, { ok: true, version: state.version });
  }

  const photoUrl = PHOTO_URL.exec(pathname);
  if (photoUrl && (req.method === 'GET' || req.method === 'HEAD')) {
    const data = await readFile(photoFile(photoUrl[1])).catch(() => null);
    if (!data) throw new HttpError(404, 'Hittades inte');
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.end(req.method === 'HEAD' ? undefined : data);
    return;
  }

  if (pathname === '/api/op' && req.method === 'POST') {
    checkPin(req, req.headers['x-admin-pin']);
    let op: Op;
    try {
      op = JSON.parse(await readBody(req)) as Op;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, 'Ogiltig JSON');
    }
    if (typeof op !== 'object' || op === null || typeof op.type !== 'string') throw new HttpError(400, 'Ogiltig operation');
    const id = apply(op);
    await commit();
    return sendJson(res, 200, { ok: true, version: state.version, ...(id ? { id } : {}) });
  }

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  throw new HttpError(405, 'Metoden stöds inte');
}

await load();

createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: err instanceof Error ? err.message : 'Serverfel' });
    else res.end();
  });
}).listen(PORT, () => {
  console.log(`Oktoberfest Spiele kör på http://localhost:${PORT}${ADMIN_PIN ? ' (PIN krävs för poängsättning)' : ''}`);
});

setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25_000);
