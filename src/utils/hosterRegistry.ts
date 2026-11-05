// src/utils/hosterRegistry.ts
import {
  BUILTIN_HOSTER_IDS,
  type BuiltinHosterId,
  type HosterId,
} from '../types/sourcePriority';

/**
 * Patterns par défaut pour chaque hoster built-in. Stratégie :
 *
 *   - **Nom unique** (uqload, vidmoly, sibnet…) → pattern "mot" qui match
 *     n'importe quel TLD automatiquement (`uqload` → uqload.cx, .is, .to,
 *     .pro, .com, tout ce qui passe par du nouveau TLD). Pas de false positives
 *     en pratique car ces noms ne sont pas des mots courants.
 *   - **Voe** (3 lettres trop courtes + nombreux alias obfusqués) → `voe\\.`
 *     (voe suivi d'un point) pour limiter les faux matches + liste explicite
 *     des alias aléatoires connus. Les users peuvent ajouter de nouveaux
 *     alias via l'éditeur regex quand Voe change encore de domaine.
 *   - **DoodStream** → préfixes multi-variants (dood\\., d0000d, doodstream,
 *     myvidplay, etc.) car les noms d'hôte varient beaucoup.
 *
 * Rajouter un nouveau domaine → ajouter l'entrée ici ; pas besoin de toucher
 * aux consommateurs (detectHoster lit le registre via getEffectivePatterns).
 */
export const BUILTIN_HOSTER_PATTERNS: Record<BuiltinHosterId, string[]> = {
  webflix: ['webflix\\.bio', 'webflix'],
  fastflux: ['fastflux', 'zen-blk'],
  miaw: ['miaw-embed', 'miaw-video', 'zen-blk', 'miaw\\.tv'],
  moviez: ['moviez\\.ac'],
  voe: [
    // voe.<tld> — catch-all pour tous les TLD de la famille voe
    'voe\\.',
    // les variantes « déblocage » : voe-unblock, v-o-e-unblock, voeunbl0ck12…
    '(?:v-?o-?e)?-?un-?bl[o0]?c?k\\d{0,2}(?:-?voe)?\\.',
    // alias aléatoires (pas de "voe" dans le nom, requiert une liste explicite).
    // Mis à jour avec les domaines observés dans les redirects 302 — voe tourne
    // ses domaines de sortie ~mensuellement.
    '(?:19turanosephantasia|20demidistance9elongations|30sensualizeexpression|321naturelikefurfuroid|35volitantplimsoles5|449unceremoniousnasoseptal|745mingiestblissfully|adrianmissionminute|alleneconomicmatter|antecoxalbobbing1010|anthonysaline|apinchcaseation|audaciousdefaulthouse|auraleanline|availedsmallest|bigclatterhomesguideservice)\\.',
    '(?:boonlessbestselling244|bradleyviewdoctor|brittneystandardwestern|brucevotewithin|caseyimpactstation|charlestoughrace|christopheruntilpoint|chromotypic|chuckle-tube|cindyeyefinal|claudiosepulchral|conscientiousedu|counterclockwisejacky|crownmakermacaronicism|crystaltreatmenteast|cyamidpulverulence530)\\.',
    '(?:dianaavoidthey|diananatureforeign|donaldlineelse|edwardarriveoften|effortlessexperim|ellenpoliticalfollow|erikcoldperson|figeterpiazine|fittingcentermondaysunday|fraudclatterflyingcar|gamoneinterrupted|garylargeavailable|generatesnitrosate|goofy-banana|graceaddresscommunity|greaseball6eventual20)\\.',
    '(?:guidon40hyporadius9|heatherdiscussionwhen|housecardsummerbutton|ianrequireadult|jamessoundcost|jamiesamewalk|jasminetesttry|jayservicestuff|jeanprofessorcentral|jefferycontrolmodel|jennifercertaindevelopment|jennifereconomicgive|jessicachoosemake|jessicayeahcatch|jilliandescribecompany|johnalwayssame)\\.',
    '(?:johnbeyondnation|jonathansociallike|josephseveralconcern|juliewomanwish|kathleenmemberhistory|kellywhatcould|kennethofficialitem|kinoger|kristiesoundsimply|lancewhosedifficult|launchreliantcleaverriver|lauradaydo|letsupload|lisatrialidea|loriwithinfamily|lukecomparetwo)\\.',
    '(?:lukesitturn|mariatheserepublican|marissasharecareer|matriculant401merited|matthewhotelscience|maxfinishseveral|metagnathtuggers|michaelapplysome|mikaylaarealike|nathanfromsubject|nectareousoverelate|nonesnanking|ogladaj|pamelachangemission|paulkitchendark|preferciseaccurate)\\.',
    '(?:prepareddare|ralphysuccessfull|realfinanceblogcenter|rebeccaneverbase|rebeccapracticeloss|reputationsheriffkennethsand|richardsignfish|roberteachfinal|robertordercharacter|robertplacespace|sandratableother|sandrataxeight|scatch176duplicities|sethniceletter|shannonpersonalcost|simpulumlamerop|smoki)\\.',
    '(?:stevenfamilyedge|stevenimaginelittle|strawberriesporail|telyn610zoanthropy|timberwoodanotia|timmaybealready|toddpartneranimal|toxitabellaeatrebates306|tracylocalschool|uptodatefinishconferenceroom|valeronevijao|walterprettytheir|wolfdyslectic|yodelswartlike)\\.',
    // Domaines VOE observés dans les flux anime-sama
    '(?:claireguessthousand|derricknationtop|jamesbornmain|jeremyparticipantanything|megankiddifference|teresapoliticallearn|shanelocaldog|ashleyhardat)\\.',
  ],
  // `ansembed` sert le lecteur Vidmoly sous un autre nom : même extracteur.
  vidmoly: ['vidmoly', 'ansembed'],
  uqload: ['uqload'],
  sibnet: ['sibnet'],
  // Veev partage `doods.to` avec la nébuleuse DoodStream mais parle un tout
  // autre protocole. Il est testé avant grâce à sa position dans BUILTIN_HOSTER_IDS.
  veev: ['veev\\.', 'poophq', 'doods\\.to'],
  doodstream: [
    'doodstream', 'd0000d', 'd000d', 'd0o0d', 'do0od',
    'dood\\.', 'doodster', 'dooodster', 'dooood', 'doodcdn',
    'myvidplay', 'dsvplay', 'doply', 'playmogo',
    'ds2play', 'ds2video', 'dood2', 'all3do', 'do7go',
    'vidply', 'vide0\\.net', 'vvide0', 'd-s\\.io',
  ],
  lulustream: [
    'lulustream', 'luluvdo', 'luluvdoo', 'luluvid', 'lulu\\.st',
    'streamhihi', 'd00ds\\.site', 'cdn1\\.site', '732eg54de642sa',
  ],
  vidara: ['vidara\\.(?:to|so)'],
  seekstreaming: [
    'embedseek',
    'embed4me',
    'servicecatalog',
    'technicalcatalog',
    'seekplayer',
    'seeks.cloud',
    'seekplays',
  ],
  // Famille Earnvids : anime-sama sert le même lecteur sous plusieurs domaines ;
  // dingtezuni redirige, comme minochinos, vers callistanise.
  smoothpre: ['smoothpre', 'morencius', 'movearnpre', 'earnvids'],
  minochinos: ['minochinos', 'dingtezuni', 'callistanise'],
  vidzy: ['vidzy'],
  darkibox: ['darkibox'],
  supervideo: ['supervideo'],
  dropload: ['dropload'],
  oneupload: ['oneupload'],
  fsvid: ['fsvid'],
};

/**
 * Domaine canonique par hoster : celui que le serveur d'extraction attend en
 * `Origin` / `Referer`. Les agrégateurs servent le lecteur sur le TLD du
 * moment, qui tourne régulièrement ; on normalise vers celui-ci AVANT
 * extraction uniquement — l'URL d'une iframe doit garder le domaine servi,
 * seul dont on sait qu'il est vivant.
 */
export const CANONICAL_HOSTER_DOMAINS: Partial<Record<BuiltinHosterId, string>> = {
  vidmoly: 'vidmoly.org',
  uqload: 'uqload.is',
};

/**
 * Façades d'un même hébergeur : domaines qui servent le catalogue d'un hoster
 * sous une autre marque. L'identifiant de fichier est identique de part et
 * d'autre, donc réécrire l'hôte suffit à réutiliser l'extracteur existant.
 *
 * La clé est le premier label du domaine (`ansembed` pour `ansembed.net`),
 * pour rester insensible au TLD comme le reste du registre.
 */
export const HOSTER_FRONTEND_ALIASES: Partial<Record<BuiltinHosterId, readonly string[]>> = {
  vidmoly: ['ansembed'],
};

/** Premier label de l'hôte d'une URL (`ansembed.net` → `ansembed`). */
function hostFamily(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').split('.')[0].toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Réécrit le domaine d'une URL vers le domaine canonique de son hoster.
 *
 * Deux cas : une façade déclarée voit son hôte entier remplacé ; sinon on
 * remplace le domaine de la famille (uqload.cx → uqload.is). Sans domaine
 * canonique déclaré, l'URL est rendue telle quelle.
 */
export function toCanonicalHosterDomain(url: string, hoster: BuiltinHosterId): string {
  const canonical = CANONICAL_HOSTER_DOMAINS[hoster];
  if (!canonical || !url) return url;

  const aliases = HOSTER_FRONTEND_ALIASES[hoster];
  const family = hostFamily(url);
  if (aliases && family && aliases.includes(family)) {
    try {
      const parsed = new URL(url);
      parsed.hostname = canonical;
      return parsed.toString();
    } catch {
      return url;
    }
  }

  const canonicalFamily = canonical.split('.')[0];
  return url.replace(new RegExp(`${canonicalFamily}\\.[a-z0-9-]+`, 'gi'), canonical);
}

/**
 * Nom à afficher dans le menu des sources. Une façade garde sa propre marque
 * — l'utilisateur a cliqué sur « Ansembed », il doit retrouver « Ansembed »,
 * même si techniquement le flux est extrait par le chemin Vidmoly.
 */
export function getHosterDisplayName(url: string, hoster: BuiltinHosterId): string {
  const aliases = HOSTER_FRONTEND_ALIASES[hoster];
  const family = hostFamily(url);
  if (aliases && family && aliases.includes(family)) {
    return family.charAt(0).toUpperCase() + family.slice(1);
  }
  return HOSTER_LABELS[hoster] || hoster.charAt(0).toUpperCase() + hoster.slice(1);
}

/** Labels human-readable pour UI. */
export const HOSTER_LABELS: Record<BuiltinHosterId, string> = {
  webflix: 'Webflix (Lecteur HD)',
  fastflux: 'Webflix FastFlux (1080p FHD)',
  miaw: 'Serveur Ultra (1080p HD)',
  moviez: 'Moviez',
  voe: 'Voe',
  vidmoly: 'Vidmoly',
  uqload: 'Uqload',
  sibnet: 'Sibnet',
  veev: 'Veev',
  doodstream: 'DoodStream',
  lulustream: 'LuluStream',
  vidara: 'Vidara',
  seekstreaming: 'SeekStreaming',
  smoothpre: 'SmoothPre',
  minochinos: 'Minochinos',
  vidzy: 'Vidzy',
  darkibox: 'Darkibox',
  supervideo: 'Supervideo',
  dropload: 'Dropload',
  oneupload: 'OneUpload',
  fsvid: 'Fsvid',
};

export function formatPlayerDisplayName(rawName: string | undefined): string {
  if (!rawName) return 'Lecteur HD';
  let name = String(rawName).trim();
  name = name.replace(/miaw[\s_-]*(1080p)?/gi, 'Serveur Ultra $1');
  name = name.replace(/\bmiaw\b/gi, 'Serveur Ultra');
  if (/^moviez$/i.test(name)) name = 'Lecteur Moviez';
  name = name.replace(/\s+/g, ' ').trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function safeCompile(pattern: string): RegExp | null {
  try { return new RegExp(pattern, 'i'); } catch { return null; }
}

let cacheEpoch = 0;
let builtinCacheEpoch = -1;
const builtinCompiled = new Map<BuiltinHosterId, RegExp[]>();

let overrideCacheEpoch = -1;
const overrideCompiled = new Map<BuiltinHosterId, RegExp[]>();

let customCacheEpoch = -1;
const customCompiled = new Map<string, RegExp[]>();

if (typeof window !== 'undefined') {
  window.addEventListener('movix-source-priority-changed', () => {
    cacheEpoch += 1;
  });
}

/**
 * Patterns effectifs pour un hoster built-in, overrides utilisateur compris.
 * Les façades listées dans HOSTER_FRONTEND_ALIASES sont TOUJOURS ajoutées.
 */
export function getEffectivePatterns(
  id: BuiltinHosterId,
  overrides: Partial<Record<BuiltinHosterId, string[]>> = {},
): RegExp[] {
  const aliases = HOSTER_FRONTEND_ALIASES[id] ?? [];
  const override = overrides[id];

  if (override !== undefined && override.length > 0) {
    if (overrideCacheEpoch !== cacheEpoch) {
      overrideCompiled.clear();
      overrideCacheEpoch = cacheEpoch;
    }
    if (overrideCompiled.has(id)) return overrideCompiled.get(id)!;
    const compiled = [...override, ...aliases]
      .map(safeCompile)
      .filter((r): r is RegExp => r !== null);
    overrideCompiled.set(id, compiled);
    return compiled;
  }

  if (builtinCacheEpoch !== cacheEpoch) {
    builtinCompiled.clear();
    builtinCacheEpoch = cacheEpoch;
  }
  if (builtinCompiled.has(id)) return builtinCompiled.get(id)!;
  const compiled = [...(BUILTIN_HOSTER_PATTERNS[id] ?? []), ...aliases]
    .map(safeCompile)
    .filter((r): r is RegExp => r !== null);
  builtinCompiled.set(id, compiled);
  return compiled;
}

export function getEffectivePatternStrings(
  id: BuiltinHosterId,
  overrides: Partial<Record<BuiltinHosterId, string[]>> = {},
): string[] {
  const override = overrides[id];
  if (override !== undefined && override.length > 0) return override;
  return BUILTIN_HOSTER_PATTERNS[id] ?? [];
}

export function isHosterCustomized(
  id: BuiltinHosterId,
  overrides: Partial<Record<BuiltinHosterId, string[]>> = {},
): boolean {
  const o = overrides[id];
  return o !== undefined && o.length > 0;
}

function getCustomPatterns(customId: string, patterns: string[]): RegExp[] {
  if (customCacheEpoch !== cacheEpoch) {
    customCompiled.clear();
    customCacheEpoch = cacheEpoch;
  }
  if (customCompiled.has(customId)) return customCompiled.get(customId)!;
  const compiled = patterns.map(safeCompile).filter((r): r is RegExp => r !== null);
  customCompiled.set(customId, compiled);
  return compiled;
}

export function detectHoster(
  url: string,
  opts: {
    patternOverrides?: Partial<Record<BuiltinHosterId, string[]>>;
    customHosters?: Array<{ id: string; patterns: string[] }>;
  } = {},
): HosterId | null {
  if (!url) return null;
  const { patternOverrides = {}, customHosters = [] } = opts;

  for (const id of BUILTIN_HOSTER_IDS) {
    const patterns = getEffectivePatterns(id, patternOverrides);
    if (patterns.some((re) => re.test(url))) return id;
  }

  for (const custom of customHosters) {
    const patterns = getCustomPatterns(custom.id, custom.patterns);
    if (patterns.some((re) => re.test(url))) return custom.id;
  }

  return null;
}
