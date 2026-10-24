/**
 * test_players.mjs — teste tous les lecteurs inline : Vidzy, Webflix (drinkoflix CDN), Wavewatch, Videasy
 *
 * Usage :
 *   node test_players.mjs
 *
 * Variables d'env optionnelles :
 *   API  URL du backend Movix  (défaut : http://localhost:25565)
 */

const API = (process.env.API || 'http://localhost:25565').replace(/\/+$/, '');
const TMDB_KEY = process.env.TMDB_API_KEY || '';

// ── Corpus ────────────────────────────────────────────────────────────────────

const MOVIES = [
  { id: '27205',  title: 'Inception' },
  { id: '157336', title: 'Interstellar' },
  { id: '550',    title: 'Fight Club' },
  { id: '155',    title: 'The Dark Knight' },
  { id: '19995',  title: 'Avatar' },
  { id: '603',    title: 'Matrix' },
  { id: '122',    title: 'Le Seigneur des Anneaux' },
  { id: '680',    title: 'Pulp Fiction' },
  { id: '278',    title: 'Shawshank Redemption' },
  { id: '424',    title: "Schindler's List" },
  { id: '129',    title: 'Le Voyage de Chihiro' },
  { id: '10681',  title: 'WALL-E' },
  { id: '812',    title: 'Shrek' },
  { id: '10193',  title: 'Toy Story 3' },
  { id: '354912', title: 'Coco' },
];

const SERIES = [
  { id: '1396',  title: 'Breaking Bad',       season: 1, episode: 1 },
  { id: '1399',  title: 'Game of Thrones',    season: 1, episode: 1 },
  { id: '66732', title: 'Stranger Things',    season: 1, episode: 1 },
  { id: '71446', title: 'La Casa de Papel',   season: 1, episode: 1 },
  { id: '76479', title: 'The Boys',           season: 1, episode: 1 },
  { id: '63174', title: 'Lucifer',            season: 1, episode: 1 },
  { id: '1668',  title: 'Friends',            season: 1, episode: 1 },
  { id: '46648', title: 'Vikings',            season: 1, episode: 1 },
  { id: '82856', title: 'The Mandalorian',    season: 1, episode: 1 },
  { id: '60625', title: 'Rick and Morty',     season: 1, episode: 1 },
  { id: '1396',  title: 'Breaking Bad',       season: 3, episode: 5 },
  { id: '1399',  title: 'Game of Thrones',    season: 3, episode: 9 },
  { id: '66732', title: 'Stranger Things',    season: 4, episode: 1 },
  { id: '71446', title: 'La Casa de Papel',   season: 2, episode: 1 },
  { id: '76479', title: 'The Boys',           season: 2, episode: 1 },
];

// ── Couleurs ──────────────────────────────────────────────────────────────────

const G = '\x1b[32m';
const R = '\x1b[31m';
const C = '\x1b[36m';
const Y = '\x1b[33m';
const B = '\x1b[1m';
const X = '\x1b[0m';
const D = '\x1b[2m';

// ── Helpers réseau ────────────────────────────────────────────────────────────

async function fetchJson(url, timeoutMs = 12000, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      return await r.json();
    } catch (err) {
      clearTimeout(t);
      const isRetryable = err.message?.includes('ECONNRESET') || err.message?.includes('fetch failed');
      if (isRetryable && attempt < retries) {
        await new Promise(r => setTimeout(r, 500 + attempt * 500));
        continue;
      }
      return null;
    }
  }
  return null;
}

async function headOk(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    return r.status < 400;
  } catch {
    clearTimeout(t);
    return false;
  }
}

// ── Normalisation titre (même logique que fastflux.ts / buildDrinkoflixMovieCdnUrl) ──

function normSlugLower(title) {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''']/g, ' ')
    .replace(/[:",!?()&]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean).join('-');
}

function normSlugPascal(title) {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''']/g, ' ')
    .replace(/[:",!?()&]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
}

// ── Checkers ──────────────────────────────────────────────────────────────────

async function checkVidzyMovie(id) {
  const d = await fetchJson(`${API}/api/vidzy/movie/${id}`);
  return d?.embedUrl || null;
}

async function checkVidzyTV(id, s, e) {
  const d = await fetchJson(`${API}/api/vidzy/tv/${id}?season=${s}&episode=${e}`);
  return d?.embedUrl || null;
}

// Webflix films — drinkoflix CDN direct (lowercase puis PascalCase en fallback)
async function checkWebflixMovie(title) {
  const slugLow = normSlugLower(title);
  const urlLow = `https://cdn.drinkoflix.lol/movies/VF/${slugLow}/${slugLow}.mp4?t=1`;
  if (await headOk(urlLow)) return urlLow;
  const slugPascal = normSlugPascal(title);
  const urlPascal = `https://cdn.drinkoflix.lol/movies/VF/${slugPascal}/${slugPascal}.mp4?t=1`;
  if (await headOk(urlPascal)) return urlPascal;
  return null;
}

// Webflix séries — drinkoflix CDN direct (lowercase puis PascalCase en fallback)
async function checkWebflixTV(title, season, episode) {
  const s = `S${String(season).padStart(2,'0')}`;
  const e = `E${String(episode).padStart(2,'0')}`;
  const slugLow = normSlugLower(title);
  const urlLow = `https://cdn.drinkoflix.lol/series/VF/${slugLow}/${s}/${slugLow}-${s}-${e}.mp4?t=1`;
  if (await headOk(urlLow)) return urlLow;
  const slugPascal = normSlugPascal(title);
  const urlPascal = `https://cdn.drinkoflix.lol/series/VF/${slugPascal}/${s}/${slugPascal}-${s}-${e}.mp4?t=1`;
  if (await headOk(urlPascal)) return urlPascal;
  return null;
}

async function checkWavewatchMovie(id) {
  return (await headOk(`https://wwembed.wavewatch.top/api/v1/streaming/ww-movie-${id}`))
    ? `ww-movie-${id}` : null;
}

async function checkWavewatchTV(id, s, e) {
  return (await headOk(`https://wwembed.wavewatch.top/api/v1/streaming/ww-tv-${id}-s${s}-e${e}`))
    ? `ww-tv` : null;
}

async function checkVideasyMovie(id) {
  return (await headOk(`https://player.videasy.net/movie/${id}`))
    ? `videasy/movie/${id}` : null;
}

async function checkVideasyTV(id, s, e) {
  return (await headOk(`https://player.videasy.net/tv/${id}/${s}/${e}`))
    ? `videasy/tv` : null;
}

// ── Affichage ─────────────────────────────────────────────────────────────────

function cell(val) { return val ? `${G}✓${X}` : `${R}✗${X}`; }

function pct(n, total) {
  const p = Math.round(100 * n / total);
  const col = p >= 80 ? G : p >= 50 ? Y : R;
  return `${col}${n}/${total} (${p}%)${X}`;
}

const COL = 28;
const HEADER = `${'Titre'.padEnd(COL)} ${B}Vidzy${X}   ${B}Webflix${X}  ${B}Wavewatch${X}  ${B}Videasy${X}`;
const SEP = '─'.repeat(68);

// ── Runners ───────────────────────────────────────────────────────────────────

const CONCURRENCY = 2; // limité pour ne pas surcharger le backend

async function runMovies() {
  console.log(`\n${B}${C}━━━━━━━━━━━━━━━━━━━━━━━━ FILMS ━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
  console.log(HEADER);
  console.log(SEP);

  const stats = { vidzy: 0, webflix: 0, wavewatch: 0, videasy: 0 };

  for (let i = 0; i < MOVIES.length; i += CONCURRENCY) {
    const batch = MOVIES.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (m) => ({
      m,
      vidzy:     await checkVidzyMovie(m.id),
      webflix:   await checkWebflixMovie(m.title),
      wavewatch: await checkWavewatchMovie(m.id),
      videasy:   await checkVideasyMovie(m.id),
    })));

    for (const { m, vidzy, webflix, wavewatch, videasy } of results) {
      if (vidzy)    stats.vidzy++;
      if (webflix)  stats.webflix++;
      if (wavewatch) stats.wavewatch++;
      if (videasy)  stats.videasy++;
      console.log(
        `${m.title.slice(0, COL - 1).padEnd(COL)} ${cell(vidzy)}      ${cell(webflix)}      ${cell(wavewatch)}         ${cell(videasy)}`
      );
    }
  }

  console.log(SEP);
  console.log(
    `${'Résultats'.padEnd(COL)} ${pct(stats.vidzy, MOVIES.length).padEnd(20)} ${pct(stats.webflix, MOVIES.length).padEnd(20)} ${pct(stats.wavewatch, MOVIES.length).padEnd(20)} ${pct(stats.videasy, MOVIES.length)}`
  );
  return stats;
}

async function runSeries() {
  console.log(`\n${B}${C}━━━━━━━━━━━━━━━━━━━━━━━━ SÉRIES ━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
  console.log(HEADER);
  console.log(SEP);

  const stats = { vidzy: 0, webflix: 0, wavewatch: 0, videasy: 0 };

  for (let i = 0; i < SERIES.length; i += CONCURRENCY) {
    const batch = SERIES.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (s) => ({
      s,
      vidzy:     await checkVidzyTV(s.id, s.season, s.episode),
      webflix:   await checkWebflixTV(s.title, s.season, s.episode),
      wavewatch: await checkWavewatchTV(s.id, s.season, s.episode),
      videasy:   await checkVideasyTV(s.id, s.season, s.episode),
    })));

    for (const { s, vidzy, webflix, wavewatch, videasy } of results) {
      if (vidzy)    stats.vidzy++;
      if (webflix)  stats.webflix++;
      if (wavewatch) stats.wavewatch++;
      if (videasy)  stats.videasy++;
      const label = `${s.title} S${String(s.season).padStart(2,'0')}E${String(s.episode).padStart(2,'0')}`;
      console.log(
        `${label.slice(0, COL - 1).padEnd(COL)} ${cell(vidzy)}      ${cell(webflix)}      ${cell(wavewatch)}         ${cell(videasy)}`
      );
    }
  }

  console.log(SEP);
  console.log(
    `${'Résultats'.padEnd(COL)} ${pct(stats.vidzy, SERIES.length).padEnd(20)} ${pct(stats.webflix, SERIES.length).padEnd(20)} ${pct(stats.wavewatch, SERIES.length).padEnd(20)} ${pct(stats.videasy, SERIES.length)}`
  );
  return stats;
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

try {
  const probe = await fetch(`${API}/api/vidzy/movie/27205`, { signal: AbortSignal.timeout(5000) });
  if (!probe.ok && probe.status !== 404) throw new Error(`status ${probe.status}`);
} catch (e) {
  if (e.message?.includes('fetch failed') || e.message?.includes('ECONNREFUSED') || e.name === 'TimeoutError') {
    console.error(`\n${R}✗ Backend inaccessible sur ${API}${X}`);
    console.error(`  Lance d'abord : node API/Mainapi/server.js\n`);
    process.exit(1);
  }
}

console.log(`${B}Test lecteurs — ${new Date().toLocaleString('fr-FR')}${X}`);
console.log(`${D}Backend : ${API}${X}`);
console.log(`${D}Note    : Webflix testé via cdn.drinkoflix.lol (HEAD direct)${X}`);

// Exécution séquentielle pour éviter de surcharger le backend Vidzy
const rm = await runMovies();
const rs = await runSeries();

const T = MOVIES.length + SERIES.length;

console.log(`\n${B}${C}━━━━━━━━━━━━━━━━━━━━━━━━ BILAN GLOBAL ━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
console.log(`${'Lecteur'.padEnd(16)} ${'Films'.padEnd(24)} ${'Séries'.padEnd(24)} Total`);
console.log('─'.repeat(72));
for (const [key, label] of [['vidzy','Vidzy'],['webflix','Webflix (CDN)'],['wavewatch','Wavewatch'],['videasy','Videasy']]) {
  const fOk = rm[key], sOk = rs[key];
  console.log(`${label.padEnd(16)} ${pct(fOk, MOVIES.length).padEnd(32)} ${pct(sOk, SERIES.length).padEnd(32)} ${pct(fOk + sOk, T)}`);
}
console.log();
