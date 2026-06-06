var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var NAKIOS_API = "https://api.nakios.ink/api/sources";
var NAKIOS_ORIGIN = "https://nakios.ink";
var FRANIME_API = "https://api.franime.fr";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges"
};
var STRIP_RESPONSE = /* @__PURE__ */ new Set(["content-encoding", "transfer-encoding", "connection"]);
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}
__name(json, "json");
function nakiosHeaders() {
  return {
    "User-Agent": UA,
    "Accept": "*/*",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Referer": NAKIOS_ORIGIN + "/",
    "Origin": NAKIOS_ORIGIN
  };
}
__name(nakiosHeaders, "nakiosHeaders");
function getRealContentUrl(targetUrl) {
  try {
    const u = new URL(targetUrl);
    const urlParam = u.searchParams.get("url");
    if (urlParam) return decodeURIComponent(urlParam);
  } catch (_) {
  }
  return targetUrl;
}
__name(getRealContentUrl, "getRealContentUrl");
function rewriteM3u8(content, workerOrigin, targetUrl) {
  const realBase = getRealContentUrl(targetUrl);
  const proxyBase = `${workerOrigin}/proxy?url=`;
  function toProxied(uri) {
    let absolute;
    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      absolute = uri;
    } else {
      try {
        absolute = new URL(uri, realBase).href;
      } catch (_) {
        return uri;
      }
    }
    return proxyBase + encodeURIComponent(absolute);
  }
  __name(toProxied, "toProxied");
  return content.split("\n").map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP") || trimmed.startsWith("#EXT-X-SESSION-KEY")) {
      return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${toProxied(uri)}"`);
    }
    if (trimmed === "" || trimmed.startsWith("#")) return line;
    return toProxied(trimmed);
  }).join("\n");
}
__name(rewriteM3u8, "rewriteM3u8");
function extractVidmolyFromNakios(data) {
  const search = /* @__PURE__ */ __name((obj) => {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const result = search(item);
        if (result) return result;
      }
      return null;
    }
    for (const key of ["url", "link", "file", "embed", "src"]) {
      const val = obj[key];
      if (typeof val === "string" && val.toLowerCase().includes("vidmoly")) {
        return val.replace(/vidmoly\.[a-z]{2,4}/, "vidmoly.me");
      }
    }
    const label = (obj.name || obj.label || obj.source || obj.host || "").toLowerCase();
    if (label.includes("vidmoly") && (obj.file_code || obj.code || obj.hash || obj.id)) {
      const hash = obj.file_code || obj.code || obj.hash || obj.id;
      if (typeof hash !== "number" && !(typeof hash === "string" && /^\d+$/.test(hash))) {
        return `https://vidmoly.me/embed-${hash}.html`;
      }
    }
    for (const val of Object.values(obj)) {
      const result = search(val);
      if (result) return result;
    }
    return null;
  }, "search");
  return search(data);
}
__name(extractVidmolyFromNakios, "extractVidmolyFromNakios");
async function handleSeries(url) {
  const id = url.searchParams.get("id");
  const season = url.searchParams.get("s");
  const episode = url.searchParams.get("e");
  if (!id || !season || !episode) {
    return json({ error: "Param\xE8tres requis : id, s, e" }, 400);
  }
  const targetUrl = `${NAKIOS_API}/tv/${encodeURIComponent(id)}/${encodeURIComponent(season)}/${encodeURIComponent(episode)}`;
  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      headers: { ...nakiosHeaders(), Accept: "application/json, text/plain, */*" }
    });
  } catch (err) {
    return json({ error: `Erreur r\xE9seau Nakios: ${err.message}` }, 502);
  }
  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: `R\xE9ponse non-JSON (status ${upstream.status})` }, 502);
  }
  if (!upstream.ok) {
    return json({ error: `Nakios a r\xE9pondu ${upstream.status}`, details: data }, upstream.status);
  }
  const vidmolyUrl = extractVidmolyFromNakios(data);
  return json({ ...data, _vidmolyUrl: vidmolyUrl || null });
}
__name(handleSeries, "handleSeries");
function extractMovieStreamUrl(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) return data.length ? extractMovieStreamUrl(data[0]) : null;
  for (const key of ["url", "stream", "link", "file", "src"]) {
    const val = data[key];
    if (typeof val === "string" && val && !val.toLowerCase().includes("vidmoly")) return val;
  }
  if (Array.isArray(data.sources) && data.sources.length > 0) {
    for (const src of data.sources) {
      for (const key of ["file", "url", "src", "link"]) {
        const val = src?.[key];
        if (typeof val === "string" && val && !val.toLowerCase().includes("vidmoly")) return val;
      }
    }
  }
  for (const key of ["data", "result", "video", "media", "player"]) {
    if (data[key] && typeof data[key] === "object") {
      const found = extractMovieStreamUrl(data[key]);
      if (found) return found;
    }
  }
  return null;
}
__name(extractMovieStreamUrl, "extractMovieStreamUrl");
async function handleMovie(url) {
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "Param\xE8tre requis : id" }, 400);
  const apiUrl = `${NAKIOS_API}/movie/${encodeURIComponent(id)}`;
  let upstream;
  try {
    upstream = await fetch(apiUrl, {
      headers: { ...nakiosHeaders(), Accept: "application/json, text/plain, */*" }
    });
  } catch (err) {
    return json({ error: `Erreur r\xE9seau Nakios: ${err.message}` }, 502);
  }
  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: `R\xE9ponse non-JSON (status ${upstream.status})` }, 502);
  }
  if (!upstream.ok) {
    return json({ error: `Nakios API a r\xE9pondu ${upstream.status}`, details: data }, upstream.status);
  }
  const streamUrl = extractMovieStreamUrl(data);
  const vidmolyUrl = extractVidmolyFromNakios(data);
  if (streamUrl) {
    const absoluteUrl = String(streamUrl).startsWith("/") ? `https://api.nakios.ink${streamUrl}` : String(streamUrl);
    const type = absoluteUrl.includes(".m3u8") ? "hls" : "mp4";
    return json({ url: absoluteUrl, type, _vidmolyUrl: vidmolyUrl || null });
  }
  if (vidmolyUrl) {
    return json({ url: null, type: null, _vidmolyUrl: vidmolyUrl });
  }
  return json({ error: "URL de flux introuvable dans la r\xE9ponse Nakios", raw: JSON.stringify(data).slice(0, 500) }, 404);
}
__name(handleMovie, "handleMovie");
async function handleVidmoly(url) {
  const rawUrl = url.searchParams.get("url");
  if (!rawUrl) return json({ error: "Param\xE8tre url requis (URL embed Vidmoly encod\xE9e)" }, 400);
  const embedUrl = decodeURIComponent(rawUrl);
  const match = embedUrl.match(/embed[-/]([a-zA-Z0-9]+)(?:\.html?)?/i);
  if (!match?.[1]) {
    return json({ error: `file_code introuvable dans l'URL embed: ${embedUrl}` }, 400);
  }
  const fileCode = match[1];
  try {
    const apiResp = await fetch(`https://sw.vidmoly.me/v1/watch?file_code=${fileCode}`, {
      headers: {
        "User-Agent": UA,
        "Referer": "https://vidmoly.me/",
        "Origin": "https://vidmoly.me",
        "Accept": "application/json, */*"
      }
    });
    if (!apiResp.ok) {
      return json({ error: `API Vidmoly sw.vidmoly.me: ${apiResp.status}` }, apiResp.status);
    }
    const data = await apiResp.json();
    const streamUrl = data?.data?.file || data?.file || data?.url || data?.stream || data?.sources?.[0]?.file || data?.sources?.[0]?.url || data?.result?.file || null;
    if (!streamUrl) {
      return json({ error: "Flux introuvable dans la r\xE9ponse API Vidmoly", debug: JSON.stringify(data).slice(0, 300) }, 404);
    }
    const type = String(streamUrl).includes(".m3u8") ? "hls" : "mp4";
    return json({ url: streamUrl, type });
  } catch (err) {
    return json({ error: `Erreur API Vidmoly: ${err.message}` }, 502);
  }
}
__name(handleVidmoly, "handleVidmoly");
function extractVidmolyFromFranime(data) {
  const search = /* @__PURE__ */ __name((obj) => {
    if (!obj || typeof obj !== "object") return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const r = search(item);
        if (r) return r;
      }
      return null;
    }
    for (const key of ["url", "link", "file", "embed", "lecteur", "player"]) {
      const val = obj[key];
      if (typeof val === "string" && val.toLowerCase().includes("vidmoly")) return val;
    }
    const host = (obj.host || obj.name || obj.label || obj.lecteur || "").toLowerCase();
    if (host.includes("vidmoly")) {
      const hash = obj.file_code || obj.code || obj.hash || obj.url || obj.id;
      if (hash) {
        if (typeof hash === "string" && hash.startsWith("http")) return hash;
        return `https://vidmoly.me/embed-${hash}.html`;
      }
    }
    for (const val of Object.values(obj)) {
      const r = search(val);
      if (r) return r;
    }
    return null;
  }, "search");
  return search(data);
}
__name(extractVidmolyFromFranime, "extractVidmolyFromFranime");
async function handleFranime(url) {
  const tmdbId = url.searchParams.get("tmdb");
  const season = url.searchParams.get("s") || "1";
  const episode = url.searchParams.get("e");
  if (!tmdbId || !episode) return json({ error: "Param\xE8tres tmdb et e requis" }, 400);
  const browserHeaders = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "fr-FR,fr;q=0.9",
    "Referer": "https://franime.fr/",
    "Origin": "https://franime.fr"
  };
  let animeId = null;
  const lookupEndpoints = [
    `${FRANIME_API}/api/anime?tmdb=${tmdbId}`,
    `${FRANIME_API}/api/anime/tmdb/${tmdbId}`,
    `${FRANIME_API}/api/animes?tmdb=${tmdbId}`,
    `${FRANIME_API}/api/v1/anime?tmdb=${tmdbId}`
  ];
  for (const endpoint of lookupEndpoints) {
    try {
      const resp = await fetch(endpoint, { headers: browserHeaders });
      if (!resp.ok) continue;
      const data = await resp.json();
      const candidate = Array.isArray(data) ? data[0] : data?.data?.[0] || data;
      if (candidate?.id || candidate?._id) {
        animeId = candidate.id || candidate._id;
        break;
      }
    } catch (_) {
    }
  }
  if (!animeId) return json({ error: `Anime tmdb:${tmdbId} non trouv\xE9 sur FRAnime` }, 404);
  const epEndpoints = [
    `${FRANIME_API}/api/anime/${animeId}/episode/${episode}`,
    `${FRANIME_API}/api/anime/${animeId}/saison/${season}/episode/${episode}`,
    `${FRANIME_API}/api/anime/${animeId}/episodes/${episode}`,
    `${FRANIME_API}/api/v1/anime/${animeId}/episode/${episode}`
  ];
  for (const endpoint of epEndpoints) {
    try {
      const resp = await fetch(endpoint, { headers: browserHeaders });
      if (!resp.ok) continue;
      const epData = await resp.json();
      const vidmolyUrl = extractVidmolyFromFranime(epData);
      if (vidmolyUrl) return json({ vidmolyUrl });
    } catch (_) {
    }
  }
  return json({ error: `\xC9pisode S${season}E${episode} ou lien Vidmoly non trouv\xE9 sur FRAnime` }, 404);
}
__name(handleFranime, "handleFranime");
async function handleProxy(request, url) {
  const rawUrl = url.searchParams.get("url");
  if (!rawUrl) return json({ error: "Param\xE8tre url requis" }, 400);
  const targetUrl = decodeURIComponent(rawUrl);
  const proxyHeaders = { ...nakiosHeaders() };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) proxyHeaders["Range"] = rangeHeader;
  const ifRangeHeader = request.headers.get("if-range");
  if (ifRangeHeader) proxyHeaders["If-Range"] = ifRangeHeader;
  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers: proxyHeaders,
      redirect: "follow"
    });
  } catch (err) {
    return new Response(`Erreur proxy: ${err.message}`, { status: 502, headers: CORS });
  }
  const contentType = (upstream.headers.get("Content-Type") || "").toLowerCase();
  const responseHeaders = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (!STRIP_RESPONSE.has(k.toLowerCase())) {
      try {
        responseHeaders.set(k, v);
      } catch (_) {
      }
    }
  }
  for (const [k, v] of Object.entries(CORS)) responseHeaders.set(k, v);
  const mightBeM3u8 = contentType.includes("mpegurl") || contentType.includes("apple.mpegurl") || targetUrl.split("?")[0].toLowerCase().endsWith(".m3u8") || targetUrl.split("?")[0].toLowerCase().endsWith(".m3u");
  if (mightBeM3u8 || contentType.startsWith("text/")) {
    const text = await upstream.text();
    const isM3u8 = mightBeM3u8 || text.trimStart().startsWith("#EXTM3U");
    if (isM3u8) {
      const rewritten = rewriteM3u8(text, url.origin, targetUrl);
      responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
      return new Response(rewritten, { status: upstream.status, headers: responseHeaders });
    }
    responseHeaders.set("Content-Type", contentType || "text/plain");
    return new Response(text, { status: upstream.status, headers: responseHeaders });
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
__name(handleProxy, "handleProxy");
var worker_default = {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
    }
    if (url.pathname === "/health") return json({ status: "ok", worker: "nakios-vidmoly-franime-proxy" });
    if (url.pathname === "/movie") return handleMovie(url);
    if (url.pathname === "/series") return handleSeries(url);
    if (url.pathname === "/vidmoly") return handleVidmoly(url);
    if (url.pathname === "/franime") return handleFranime(url);
    if (url.pathname === "/proxy") return handleProxy(request, url);
    return json({ error: "Routes disponibles : /movie /series /vidmoly /franime /proxy /health" }, 404);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
