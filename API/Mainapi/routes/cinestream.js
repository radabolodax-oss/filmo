/**
 * CineStream movie source (helper module, not a router).
 *
 * Fallback pour la partie *films* de la source wiflix (voir wiflix.js) : quand
 * flemmix bloque via son bot-shield (meme avec FlareSolverr), on retente sur
 * cinestream.info (site public Next.js App Router). Les series restent sur
 * flemmix (cinestream ne fait que des films).
 *
 * Flow (tout en GET, HTML public — pas de handshake cookie) :
 *   1. /search?q=<title>            -> <a href="/film/{slug}"> candidats
 *   2. /film/{slug}                 -> RSC flight embarque le tmdb id
 *                                      ("tmdbid":N) + tableau players ordonne
 *                                      ([{name},...]). tmdbid fait foi
 *                                      (cinestream reutilise les ids TMDB).
 *   3. /player/{tmdbid}/{index}     -> <iframe src> url d'embed pour player[index]
 *
 * Langue du player : un player dont le nom commence par "vostfr" -> VOSTFR, sinon VF.
 *
 * Retourne la MEME forme que fetchWiflixMovieData pour etre consomme sans
 * changement par la route existante dans wiflix.js.
 */

const { makeCinestreamRequest } = require("../utils/proxyManager");
const { fetchTmdbDetails } = require("../utils/tmdbCache");

const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const TMDB_API_URL = "https://api.themoviedb.org/3";
// Override via env si cinestream change de domaine (pas de changement de code).
const CINESTREAM_BASE_URL =
  process.env.CINESTREAM_BASE_URL || "https://cinestream.info";

// Cap sur les confirmations de page film par movie. La recherche est triee par
// pertinence et on remonte les matches d'annee en premier, donc le bon film est
// presque toujours dans les 1-2 premiers.
const MAX_FILM_PAGE_FETCHES = 8;

const toBody = (res) =>
  typeof res.data === "string" ? res.data : JSON.stringify(res.data);

// Toutes les requetes cinestream passent par CycleTLS + rotation proxy (voir
// makeCinestreamRequest) — meme mecanisme que les autres scrapers Cloudflare.
// Retourne une reponse meme sur 525/5xx (ne throw jamais sur le statut), donc un
// upstream instable donne juste du HTML que nos regex ne matchent pas -> "not found".
// timeout est en ms ici ; le helper prend des secondes.
async function cinestreamGet(url, timeout = 15000) {
  return makeCinestreamRequest(url, { timeout: Math.ceil(timeout / 1000) });
}

// Chaque slug cinestream se termine par son annee de sortie ("toy-story-5-2026").
const yearFromSlug = (slug) => {
  const m = slug.match(/-(\d{4})$/);
  return m ? parseInt(m[1], 10) : null;
};

// === Etape 1 : recherche -> slugs candidats (dedup, ordre de recherche preserve) ===
async function searchCinestream(title) {
  const url = `${CINESTREAM_BASE_URL}/search?q=${encodeURIComponent(title)}`;
  const res = await cinestreamGet(url);
  const html = toBody(res);

  const slugs = [];
  const seen = new Set();
  const re = /href="\/film\/([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}

// === Etape 2 : page film -> { tmdbid, players: [{name}, ...] } ===
// Le RSC flight est embarque *escaped* dans le HTML (\"tmdbid\":N, \"players\":[...]).
async function fetchCinestreamFilm(slug) {
  const url = `${CINESTREAM_BASE_URL}/film/${slug}`;
  const res = await cinestreamGet(url);
  const html = toBody(res);

  const tmdbMatch = html.match(/tmdbid\\?":(\d+)/);
  const tmdbid = tmdbMatch ? parseInt(tmdbMatch[1], 10) : null;

  let players = [];
  const playersMatch = html.match(/players\\?":(\[.*?\])/);
  if (playersMatch) {
    try {
      players = JSON.parse(playersMatch[1].replace(/\\"/g, '"'));
    } catch {
      players = [];
    }
  }

  return { tmdbid, players, url };
}

// === Etape 3 : page player -> iframe embed url pour un index donne ===
async function fetchCinestreamEmbed(tmdbid, index) {
  const url = `${CINESTREAM_BASE_URL}/player/${tmdbid}/${index}`;
  try {
    const res = await cinestreamGet(url, 12000);
    const html = toBody(res);
    const m = html.match(/<iframe[^>]+src="([^"]+)"/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function categorize(players) {
  const vf = [];
  const vostfr = [];
  for (const p of players) {
    if (p.type === "VOSTFR") vostfr.push(p);
    else vf.push(p);
  }
  return { vf, vostfr };
}

// === Principal : meme forme de retour que fetchWiflixMovieData ===
async function fetchCinestreamMovieData(tmdbId, cachedData = null) {
  try {
    const tmdbData = await fetchTmdbDetails(
      TMDB_API_URL,
      TMDB_API_KEY,
      tmdbId,
      "movie",
      "fr-FR",
    );

    if (!tmdbData) {
      if (cachedData) return cachedData;
      return {
        success: false,
        error: "Film non trouve sur TMDB",
        tmdb_id: tmdbId,
      };
    }

    const tmdbYear = tmdbData.release_date
      ? new Date(tmdbData.release_date).getFullYear()
      : null;

    const titlesToTry = [tmdbData.title, tmdbData.original_title].filter(
      (t, i, arr) => t && arr.indexOf(t) === i,
    );

    // Rassemble les slugs candidats sur tous les titres (dedup, ordre garde).
    const candidates = [];
    const seen = new Set();
    for (const title of titlesToTry) {
      let slugs = [];
      try {
        slugs = await searchCinestream(title);
      } catch (err) {
        console.log(`[CINESTREAM SEARCH] "${title}": ${err.message}`);
      }
      for (const slug of slugs) {
        if (seen.has(slug)) continue;
        seen.add(slug);
        candidates.push(slug);
      }
    }

    if (candidates.length === 0)
      return {
        success: false,
        error: "Film non trouve sur CineStream",
        tmdb_id: tmdbId,
        titles_tried: titlesToTry,
      };

    // Remonte les matches d'annee en premier (stable) — tmdbid fait le vrai
    // match, ca minimise juste les fetches de page film gaspilles.
    const ranked = tmdbYear
      ? candidates
          .map((slug, i) => ({ slug, i, yearHit: yearFromSlug(slug) === tmdbYear }))
          .sort((a, b) => (b.yearHit ? 1 : 0) - (a.yearHit ? 1 : 0) || a.i - b.i)
          .map((c) => c.slug)
      : candidates;

    // Confirme le bon film par tmdbid.
    let matched = null;
    for (const slug of ranked.slice(0, MAX_FILM_PAGE_FETCHES)) {
      let film;
      try {
        film = await fetchCinestreamFilm(slug);
      } catch (err) {
        console.log(`[CINESTREAM FILM] "${slug}": ${err.message}`);
        continue;
      }
      if (film.tmdbid === Number(tmdbId)) {
        matched = film;
        break;
      }
    }

    if (!matched)
      return {
        success: false,
        error: "Film non trouve sur CineStream",
        tmdb_id: tmdbId,
        titles_tried: titlesToTry,
      };

    if (!matched.players.length)
      return {
        success: false,
        error: "Aucun lecteur video trouve",
        tmdb_id: tmdbId,
        cinestream_url: matched.url,
      };

    // Resout chaque player[index] -> embed url (en parallele). Index = celui
    // de /player/{tmdbid}/{index}, on mappe donc le tableau tel quel.
    const embeds = await Promise.all(
      matched.players.map((p, index) =>
        fetchCinestreamEmbed(matched.tmdbid, index).then((url) => ({
          name: p.name,
          url,
        })),
      ),
    );

    const players = [];
    for (const e of embeds) {
      if (!e.url) continue;
      const type = /^vostfr/i.test((e.name || "").trim()) ? "VOSTFR" : "VF";
      const domainMatch = e.url.match(/https?:\/\/(?:www\.)?([^/]+)/);
      players.push({
        name: domainMatch ? domainMatch[1] : e.name,
        url: e.url,
        episode: 1,
        type,
      });
    }

    if (players.length === 0)
      return {
        success: false,
        error: "Aucun lecteur video trouve",
        tmdb_id: tmdbId,
        cinestream_url: matched.url,
      };

    const categorized = categorize(players);
    return {
      success: true,
      tmdb_id: tmdbId,
      title: tmdbData.title,
      original_title: tmdbData.original_title,
      source: "cinestream",
      // Cle gardee en wiflix_url pour rester compatible avec la forme de la route wiflix.
      wiflix_url: matched.url,
      players: { vf: categorized.vf, vostfr: categorized.vostfr },
      cache_timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[CINESTREAM MOVIE] ${tmdbId}: ${error.message}`);
    if (cachedData) return cachedData;
    return {
      success: false,
      error: "Erreur lors de la recuperation des donnees CineStream",
      message: error.message,
      tmdb_id: tmdbId,
    };
  }
}

module.exports = { fetchCinestreamMovieData };
