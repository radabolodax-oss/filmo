// Test Vidzy — vérifie la disponibilité sur 20 films, 20 séries, 20 films d'animation
const API = 'http://localhost:25565';

const MOVIES = [
  { id: '27205',  title: 'Inception' },
  { id: '157336', title: 'Interstellar' },
  { id: '550',    title: 'Fight Club' },
  { id: '155',    title: 'The Dark Knight' },
  { id: '19995',  title: 'Avatar' },
  { id: '603',    title: 'Matrix' },
  { id: '278',    title: 'Shawshank Redemption' },
  { id: '238',    title: 'The Godfather' },
  { id: '680',    title: 'Pulp Fiction' },
  { id: '13',     title: 'Forrest Gump' },
  { id: '769',    title: 'Goodfellas' },
  { id: '807',    title: 'Seven' },
  { id: '497',    title: 'The Green Mile' },
  { id: '122',    title: 'Le Retour du Roi' },
  { id: '562',    title: 'Die Hard' },
  { id: '424',    title: "Schindler's List" },
  { id: '598',    title: 'City of God' },
  { id: '311',    title: 'Once Upon a Time in America' },
  { id: '637',    title: 'Life is Beautiful' },
  { id: '489',    title: 'Good Will Hunting' },
];

const SERIES = [
  { id: '1396',  title: 'Breaking Bad',       season: 1, episode: 1 },
  { id: '1399',  title: 'Game of Thrones',    season: 1, episode: 1 },
  { id: '66732', title: 'Stranger Things',    season: 1, episode: 1 },
  { id: '71446', title: 'La Casa de Papel',   season: 1, episode: 1 },
  { id: '76479', title: 'The Boys',           season: 1, episode: 1 },
  { id: '75006', title: 'The Crown',          season: 1, episode: 1 },
  { id: '87108', title: 'Chernobyl',          season: 1, episode: 1 },
  { id: '63174', title: 'Lucifer',            season: 1, episode: 1 },
  { id: '60625', title: 'Rick and Morty',     season: 1, episode: 1 },
  { id: '56570', title: 'Mr. Robot',          season: 1, episode: 1 },
  { id: '1668',  title: 'Friends',            season: 1, episode: 1 },
  { id: '4614',  title: 'Lost',               season: 1, episode: 1 },
  { id: '1402',  title: 'The Walking Dead',   season: 1, episode: 1 },
  { id: '1418',  title: 'Big Bang Theory',    season: 1, episode: 1 },
  { id: '2316',  title: 'The Office',         season: 1, episode: 1 },
  { id: '46648', title: 'Vikings',            season: 1, episode: 1 },
  { id: '67744', title: 'Narcos',             season: 1, episode: 1 },
  { id: '1622',  title: 'Supernatural',       season: 1, episode: 1 },
  { id: '57243', title: 'Doctor Who',         season: 1, episode: 1 },
  { id: '82856', title: 'The Mandalorian',    season: 1, episode: 1 },
];

const ANIMATIONS = [
  { id: '129',    title: 'Le Voyage de Chihiro' },
  { id: '12477',  title: 'Le Tombeau des Lucioles' },
  { id: '149870', title: 'Les Enfants Loups' },
  { id: '812',    title: 'Shrek' },
  { id: '10681',  title: 'WALL-E' },
  { id: '10193',  title: 'Toy Story 3' },
  { id: '14160',  title: 'Là-Haut (Up)' },
  { id: '150540', title: 'Vice-Versa (Inside Out)' },
  { id: '354912', title: 'Coco' },
  { id: '260514', title: 'Le Monde de Dory' },
  { id: '585',    title: 'Monstres & Cie' },
  { id: '12155',  title: 'Kung Fu Panda' },
  { id: '126083', title: 'La Reine des Neiges' },
  { id: '177572', title: 'Big Hero 6' },
  { id: '315162', title: 'Puss in Boots 2' },
  { id: '508947', title: 'Alerte Rouge' },
  { id: '809',    title: 'Shrek 2' },
  { id: '62177',  title: 'Rebelle (Brave)' },
  { id: '301528', title: 'Spider-Man: Into the Spider-Verse' },
  { id: '324857', title: 'Spider-Man: Into the Spider-Verse (doublure)' },
];

const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const CYAN  = '\x1b[36m';
const YELLOW= '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';

async function checkMovie(item) {
  try {
    const r = await fetch(`${API}/api/vidzy/movie/${item.id}`, { signal: AbortSignal.timeout(12000) });
    const data = await r.json();
    if (r.ok && data?.embedUrl) return data.embedUrl;
    return null;
  } catch {
    return null;
  }
}

async function checkSeries(item) {
  try {
    const r = await fetch(
      `${API}/api/vidzy/tv/${item.id}?season=${item.season}&episode=${item.episode}`,
      { signal: AbortSignal.timeout(12000) }
    );
    const data = await r.json();
    if (r.ok && data?.embedUrl) return data.embedUrl;
    return null;
  } catch {
    return null;
  }
}

async function runCategory(label, items, checkFn, concurrency = 4) {
  console.log(`\n${BOLD}${CYAN}━━━ ${label} ━━━${RESET}`);
  let ok = 0, fail = 0;
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(checkFn));
    results.forEach((res, j) => {
      const item = batch[j];
      if (res) {
        ok++;
        console.log(`  ${GREEN}✓${RESET} ${item.title.padEnd(35)} ${res}`);
      } else {
        fail++;
        console.log(`  ${RED}✗${RESET} ${item.title.padEnd(35)} non disponible`);
      }
    });
  }
  console.log(`\n  ${BOLD}Résultat : ${ok}/${items.length} disponibles sur Vidzy${RESET}`);
  return { ok, fail, total: items.length };
}

// Vérifie d'abord que la clé est configurée
try {
  const probe = await fetch(`${API}/api/vidzy/movie/27205`, { signal: AbortSignal.timeout(5000) });
  const probeData = await probe.json();
  if (probeData?.error?.includes('VIDZY_API_KEY')) {
    console.log(`\n${YELLOW}⚠️  VIDZY_API_KEY manquant dans API/Mainapi/.env${RESET}`);
    console.log(`Ajoute ta clé Vidzy dans le .env puis relance le backend.\n`);
    process.exit(1);
  }
} catch (e) {
  console.log(`\n${RED}✗ Backend inaccessible sur ${API}${RESET}\n`);
  process.exit(1);
}

console.log(`${BOLD}Test Vidzy — ${new Date().toLocaleString('fr-FR')}${RESET}`);
console.log(`API : ${API}`);

const [r1, r2, r3] = await Promise.all([
  runCategory('FILMS', MOVIES, checkMovie),
  runCategory('SÉRIES (S01E01)', SERIES, checkSeries),
  runCategory('FILMS D\'ANIMATION', ANIMATIONS, checkMovie),
]);

const total = r1.ok + r2.ok + r3.ok;
const grand = r1.total + r2.total + r3.total;
console.log(`\n${BOLD}Total global : ${total}/${grand}${RESET}\n`);
