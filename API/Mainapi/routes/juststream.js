/**
 * JustStream helper module.
 * Provides scraping functions for JustStream.
 * This is NOT an Express router; it exports plain functions used by tmdb.js.
 */

const cheerio = require('cheerio');
const axios = require('axios');

const JUSTSTREAM_BASE_URL = 'https://juststream.work';

// ---------------------------------------------------------------------------
// Dependencies injected via configure()
// ---------------------------------------------------------------------------
let makeRequestWithCorsFallback;
let axiosJustStreamRequest;
let findTvSeriesOnTMDB;

function configure(deps) {
  if (deps.makeRequestWithCorsFallback) makeRequestWithCorsFallback = deps.makeRequestWithCorsFallback;
  if (deps.axiosJustStreamRequest) axiosJustStreamRequest = deps.axiosJustStreamRequest;
  if (deps.findTvSeriesOnTMDB) findTvSeriesOnTMDB = deps.findTvSeriesOnTMDB;
}

// ---------------------------------------------------------------------------
// getJustStreamMovie
// ---------------------------------------------------------------------------
async function getJustStreamMovie(imdbId) {
  try {
    const searchUrl = `${JUSTSTREAM_BASE_URL}/xfsearch/${imdbId}`;

    const searchResponse = await makeRequestWithCorsFallback(searchUrl, { timeout: 5000, decompress: true });
    const $search = cheerio.load(searchResponse.data);

    let movieLink = null;
    $search('.short').each((index, element) => {
      const $element = $search(element);
      const link = $element.find('.short-poster').attr('href');
      if (link && !movieLink) {
        movieLink = link;
      }
    });

    if (!movieLink) {
      return { error: 'Movie not found on JustStream' };
    }

    const movieResponse = await makeRequestWithCorsFallback(movieLink, { timeout: 5000, decompress: true });
    const $movie = cheerio.load(movieResponse.data);

    let iframeSrc = $movie('body > div:nth-child(2) > div:nth-child(1) > div > article > div:nth-child(1) > div > div > div:nth-child(1) > div > div > div > iframe').attr('src');

    if (!iframeSrc) {
      iframeSrc = $movie('.tabs-content iframe').attr('src');
    }

    if (!iframeSrc) {
      iframeSrc = $movie('iframe').first().attr('src');
    }

    if (!iframeSrc) {
      return { error: 'Iframe not found on movie page' };
    }

    const iframeResponse = await axios.get(iframeSrc, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': `${JUSTSTREAM_BASE_URL}/`
      },
      timeout: 15000,
      decompress: true
    });

    const $iframe = cheerio.load(iframeResponse.data);
    const playerLinks = [];

    $iframe('._player-mirrors li').each((index, element) => {
      const $element = $iframe(element);
      const dataLink = $element.attr('data-link');
      const playerName = $element.text().trim();
      const isHD = $element.hasClass('fullhd');

      if (!dataLink) return;

      let formattedLink = dataLink;
      if (dataLink.startsWith('//')) {
        formattedLink = 'https:' + dataLink;
      }

      playerLinks.push({
        player: playerName,
        link: formattedLink,
        is_hd: isHD
      });
    });

    // Fallback: parse player links from anchor tags
    if (playerLinks.length === 0) {
      $iframe('.player-list a, .mirrors a, [data-link]').each((index, element) => {
        const $element = $iframe(element);
        const dataLink = $element.attr('data-link') || $element.attr('href');
        const playerName = $element.text().trim();

        if (!dataLink || dataLink === '#') return;

        let formattedLink = dataLink;
        if (dataLink.startsWith('//')) {
          formattedLink = 'https:' + dataLink;
        }

        playerLinks.push({
          player: playerName || `Player ${index + 1}`,
          link: formattedLink,
          is_hd: false
        });
      });
    }

    return {
      iframe_src: iframeSrc,
      player_links: playerLinks
    };

  } catch (error) {
    return { error: `Failed to fetch movie data: ${error.message}` };
  }
}

// ---------------------------------------------------------------------------
// getJustStreamSeries
// ---------------------------------------------------------------------------
async function getJustStreamSeries(id) {
  try {
    const targetUrl = `${JUSTSTREAM_BASE_URL}/xfsearch/${id}`;

    const response = await makeRequestWithCorsFallback(targetUrl, {
      timeout: 5000,
      decompress: true
    });

    const $ = cheerio.load(response.data);

    const seriesList = [];
    $('.short').each(async (index, element) => {
      try {
        const $element = $(element);
        const link = $element.find('.short-poster').attr('href');
        const title = $element.find('.short-title').text().trim();

        if (!title.toLowerCase().includes('saison')) {
          return;
        }

        const posterImg = $element.find('.short-poster img').attr('src');
        const poster = posterImg ? (posterImg.startsWith('/') ? `${JUSTSTREAM_BASE_URL}${posterImg}` : posterImg) : null;
        const audioType = $element.find('.film-verz a').text().trim();

        let episodeCount = null;
        const episodeElement = $element.find('.mli-eps i');
        if (episodeElement.length > 0) {
          episodeCount = parseInt(episodeElement.text().trim());
        }

        seriesList.push({
          title,
          link,
          poster,
          audio_type: audioType,
          episode_count: episodeCount,
          seasons: []
        });
      } catch (error) {
        console.error(`Error parsing series element:`, error);
      }
    });

    return seriesList;
  } catch (error) {
    return { error: `Erreur lors de la recuperation des series: ${error.message}` };
  }
}

// ---------------------------------------------------------------------------
// getJustStreamSeriesDetails
// ---------------------------------------------------------------------------
async function getJustStreamSeriesDetails(seriesUrl, originalTitle) {
  try {
    const response = await makeRequestWithCorsFallback(seriesUrl, {
      timeout: 5000,
      decompress: true
    });

    const $ = cheerio.load(response.data);

    const seriesTitle = originalTitle;

    let releaseDate = null;
    const releaseSelectors = [
      'article div.fmain div.fleft div.poster span.release',
      'span.release',
      'div.poster span.release',
      '.release'
    ];

    for (const selector of releaseSelectors) {
      const releaseElement = $(selector);
      if (releaseElement.length > 0) {
        const releaseDateText = releaseElement.text().trim();
        const yearMatch = releaseDateText.match(/(\d{4})/);
        if (yearMatch) {
          releaseDate = yearMatch[1];
          break;
        }
      }
    }

    if (!releaseDate) {
      const allText = $('body').text();
      const yearMatches = allText.match(/\b(19\d{2}|20\d{2})\b/g);
      if (yearMatches && yearMatches.length > 0) {
        releaseDate = yearMatches[0];
      }
    }

    let summary = null;

    const summarySelectorApproaches = [
      () => {
        const mainContent = $('.finfo, .fcontent, .fdesc, #s-desc');
        if (mainContent.length > 0) {
          const paragraphs = mainContent.find('p');
          let longestText = "";
          paragraphs.each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > longestText.length && !text.includes("streaming complet")) {
              longestText = text;
            }
          });
          return longestText.length > 100 ? longestText : null;
        }
        return null;
      },

      () => {
        const summaryKeywords = ["histoire", "serie", "saison", "episode", "personnage", "aventure"];
        const paragraphs = $('p');
        let bestMatch = null;
        let bestScore = 0;

        paragraphs.each((i, el) => {
          const text = $(el).text().trim();
          if (text.length < 100) return;

          let score = 0;
          const lowerText = text.toLowerCase();
          summaryKeywords.forEach(keyword => {
            if (lowerText.includes(keyword)) score++;
          });

          score += Math.min(text.length / 200, 3);

          if (text.includes("streaming") || text.includes("vostfr") || text.includes("gratuit")) {
            score -= 5;
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = text;
          }
        });

        return bestScore > 2 ? bestMatch : null;
      }
    ];

    for (const approach of summarySelectorApproaches) {
      try {
        const result = approach();
        if (result) {
          summary = result;
          break;
        }
      } catch (error) {
        console.error(`Erreur lors de l'extraction du resume: ${error.message}`);
      }
    }

    let tmdbData = null;
    if (seriesTitle) {
      tmdbData = await findTvSeriesOnTMDB(seriesTitle, releaseDate, summary);
    }

    const seasons = [];
    const seasonsContainer = $('.tab-content > .tab-pane');

    seasonsContainer.each((seasonIndex, seasonElement) => {
      try {
        const $seasonElement = $(seasonElement);
        const seasonId = $seasonElement.attr('id');
        const seasonNumberMatch = seasonId ? seasonId.match(/\d+$/) : null;
        const seasonNumber = seasonNumberMatch ? parseInt(seasonNumberMatch[0]) : seasonIndex + 1;
        const seasonTitle = `Saison ${seasonNumber}`;

        const episodesMap = new Map();

        const episodeElements = $seasonElement.find('ul li');

        episodeElements.each((episodeIndex, episodeElement) => {
          try {
            const $episodeElement = $(episodeElement);
            const episodeLink = $episodeElement.find('a').first();

            const episodeNumStr = episodeLink.text().trim();
            const episodeNumMatch = episodeNumStr.match(/^\d+/);
            const episodeNum = episodeNumMatch ? episodeNumMatch[0] : episodeNumStr;

            const episodeTitle = episodeLink.attr('data-title') || `Episode ${episodeNumStr}`;
            const isVOSTFR = episodeTitle.includes('VOSTFR');
            const langKey = isVOSTFR ? 'vostfr' : 'vf';

            const players = [];
            $episodeElement.find('.mirrors a').each((playerIndex, playerElement) => {
              const $playerElement = $(playerElement);
              const playerName = $playerElement.text().trim();
              const playerLink = $playerElement.attr('data-link');

              if (playerLink) {
                players.push({ name: playerName, link: playerLink });
              }
            });

            if (!episodesMap.has(episodeNum)) {
              episodesMap.set(episodeNum, { number: episodeNum, versions: {} });
            }

            episodesMap.get(episodeNum).versions[langKey] = {
              title: episodeTitle,
              players: players
            };

          } catch (error) {
            console.error(`Error parsing episode element (Index ${episodeIndex}) in ${seriesUrl}:`, error.message);
          }
        });

        const episodes = Array.from(episodesMap.values()).sort((a, b) => {
          const numA = parseInt(a.number);
          const numB = parseInt(b.number);
          if (isNaN(numA) || isNaN(numB)) return a.number.localeCompare(b.number);
          return numA - numB;
        });

        seasons.push({ number: seasonNumber, title: seasonTitle, episodes: episodes });
      } catch (error) {
        console.error(`Error parsing season element in ${seriesUrl}:`, error.message);
      }
    });

    return {
      title: seriesTitle,
      release_date: releaseDate,
      summary: summary,
      tmdb_data: tmdbData,
      seasons: seasons
    };
  } catch (error) {
    return { error: `Failed to fetch series details: ${error.message}` };
  }
}

// ---------------------------------------------------------------------------
// extractSeriesInfo
// ---------------------------------------------------------------------------
const extractSeriesInfo = (title) => {
  let baseName = title;
  let partNumber = 1;
  let seasonInfo = {};

  const partMatch = title.match(/\s*Part\s+(\d+)\s*\(Saison\s+(\d+)\s*-\s*(\d+)\)/i);
  if (partMatch) {
    partNumber = parseInt(partMatch[1]);
    seasonInfo = { part: partNumber, start: parseInt(partMatch[2]), end: parseInt(partMatch[3]) };
    baseName = baseName.replace(/\s*Part\s+\d+\s*\(Saison\s+\d+\s*-\s*\d+\)/i, '');
  }

  baseName = baseName.replace(/\s*-\s*Saison\s+\d+$/i, '');
  baseName = baseName.replace(/\s*\(\d{4}\)/, '');

  return { baseName: baseName.trim(), partNumber, seasonInfo };
};

// ---------------------------------------------------------------------------
// mergeSeriesParts
// ---------------------------------------------------------------------------
const mergeSeriesParts = (parts) => {
  if (!parts || parts.length === 0) return null;
  if (parts.length === 1) return parts[0];

  parts.sort((a, b) => a.partNumber - b.partNumber);

  const mainPart = parts[0];
  const mergedSeasons = [...(mainPart.seasons || [])];

  let maxSeasonNumberSoFar = 0;
  if (mergedSeasons.length > 0) {
    maxSeasonNumberSoFar = Math.max(...mergedSeasons.map(s => s.number));
  }

  for (let i = 1; i < parts.length; i++) {
    const currentPart = parts[i];
    const adjustment = maxSeasonNumberSoFar;

    if (!currentPart.seasons || currentPart.seasons.length === 0) continue;

    let partMaxSeason = 0;
    currentPart.seasons.forEach(season => {
      const adjustedSeasonNumber = adjustment + season.number;
      const adjustedSeason = { ...season, number: adjustedSeasonNumber, title: `Saison ${adjustedSeasonNumber}` };
      mergedSeasons.push(adjustedSeason);
      if (adjustedSeasonNumber > partMaxSeason) partMaxSeason = adjustedSeasonNumber;
    });
    maxSeasonNumberSoFar = partMaxSeason;
  }

  mergedSeasons.sort((a, b) => a.number - b.number);
  return { ...mainPart, seasons: mergedSeasons };
};

// ---------------------------------------------------------------------------
// cleanTvCacheData
// ---------------------------------------------------------------------------
const cleanTvCacheData = (cachedData) => {
  if (!cachedData || !cachedData.series) return cachedData;
  return {
    type: cachedData.type || 'tv',
    series: (cachedData.series || []).map(s => ({
      title: s.title || s.baseName,
      audio_type: s.audio_type,
      episode_count: s.episode_count,
      release_date: s.release_date,
      summary: s.summary,
      tmdb_data: s.tmdb_data ? {
        id: s.tmdb_data.id,
        name: s.tmdb_data.name,
        overview: s.tmdb_data.overview,
        first_air_date: s.tmdb_data.first_air_date,
        poster_path: s.tmdb_data.poster_path,
        backdrop_path: s.tmdb_data.backdrop_path,
        vote_average: s.tmdb_data.vote_average,
        match_score: s.tmdb_data.match_score,
        is_season_part: s.tmdb_data.is_season_part,
        season_offset: s.tmdb_data.season_offset
      } : null,
      seasons: s.seasons || []
    }))
  };
};

// ---------------------------------------------------------------------------
// checkJustStreamVersion
// ---------------------------------------------------------------------------
async function checkJustStreamVersion(imdbId) {
  try {
    const url = `${JUSTSTREAM_BASE_URL}/xfsearch/${imdbId}`;
    const response = await axiosJustStreamRequest({ method: 'get', url });
    const $ = cheerio.load(response.data);

    const versionElement = $('*[id="dle-content"] div div span:nth-child(2) a');
    const version = versionElement.text().trim();

    return {
      version: version || 'Unknown',
      url: versionElement.attr('href') || null
    };
  } catch (error) {
    return { version: 'Unknown', url: null };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  configure,
  getJustStreamMovie,
  getJustStreamSeries,
  getJustStreamSeriesDetails,
  extractSeriesInfo,
  mergeSeriesParts,
  cleanTvCacheData,
  checkJustStreamVersion
};
