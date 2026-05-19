import React, { useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import { Play, Info, Star, Calendar } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { encodeId } from '../utils/idEncoder';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const AUTO_SLIDE_MS = 20000;

const detectLowEndDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const hc = navigator.hardwareConcurrency;
  const ua = navigator.userAgent || '';
  const isLowEnd = (typeof dm === 'number' && dm <= 2) || (typeof hc === 'number' && hc <= 2);
  const isTV = /Tizen|WebOS|SmartTV|GoogleTV|HbbTV|NetCast|VIDAA|AppleTV|AndroidTV|BRAVIA|Hisense|Aquos/i.test(ua);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let userDisabled = false;
  try {
    userDisabled = localStorage.getItem('settings_anim_carousel') === 'false'
      || localStorage.getItem('settings_light_mode') === 'on';
  } catch { /* localStorage unavailable */ }
  return isLowEnd || isTV || reducedMotion || userDisabled;
};

interface Media {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path: string;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv';
  genre_ids?: number[];
}

interface HeroSliderProps {
  items: Media[];
}

const HeroSliderInner: React.FC<HeroSliderProps> = ({ items }) => {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 40 });
  const autoSlideInterval = useRef<NodeJS.Timeout | null>(null);
  const [logoUrls, setLogoUrls] = useState<{ [key: number]: string | null }>({});
  const [trailerKeys, setTrailerKeys] = useState<{ [key: number]: string | null }>({});
  // true once the active-slide iframe has fired onLoad and the 1.5s reveal delay passed
  const [trailerReady, setTrailerReady] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPaused] = useState(detectLowEndDevice);
  const [isVisible, setIsVisible] = useState(true);
  const logoCache = useRef<{ [key: number]: string | null }>({});
  const trailerCache = useRef<{ [key: number]: string | null }>({});
  const progressStartRef = useRef<number>(performance.now());
  const trailerRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Logo fetching (unchanged) ──────────────────────────────────────────────
  useEffect(() => {
    const fetchLogos = async () => {
      const storedCache = sessionStorage.getItem('movix_hero_logos');
      const storedTimestamp = sessionStorage.getItem('movix_hero_logos_timestamp');
      const oneDayMs = 24 * 60 * 60 * 1000;

      let sessionCache: { [key: number]: string | null } = {};
      if (storedCache && storedTimestamp && (Date.now() - parseInt(storedTimestamp)) < oneDayMs) {
        sessionCache = JSON.parse(storedCache);
        logoCache.current = { ...logoCache.current, ...sessionCache };
      }

      const urls: { [key: number]: string | null } = { ...logoCache.current };
      const missing = items.filter((item) => logoCache.current[item.id] === undefined);

      if (missing.length > 0) {
        const results = await Promise.allSettled(missing.map(async (item) => {
          const url = `https://api.themoviedb.org/3/${item.media_type}/${item.id}/images?api_key=${TMDB_API_KEY}&include_image_language=fr,en,null`;
          const res = await axios.get(url);
          const logos = res.data.logos || [];
          const logo = logos.find((l: any) => l.iso_639_1 === 'fr')
            || logos.find((l: any) => l.iso_639_1 === 'en')
            || logos.find((l: any) => l.iso_639_1)
            || logos[0];
          return logo && logo.file_path
            ? `https://image.tmdb.org/t/p/w500${logo.file_path}`
            : null;
        }));

        results.forEach((result, idx) => {
          const item = missing[idx];
          const logoUrl = result.status === 'fulfilled' ? result.value : null;
          urls[item.id] = logoUrl;
          logoCache.current[item.id] = logoUrl;
        });

        sessionStorage.setItem('movix_hero_logos', JSON.stringify(logoCache.current));
        sessionStorage.setItem('movix_hero_logos_timestamp', Date.now().toString());
      }

      setLogoUrls(urls);
    };

    fetchLogos();
  }, [items]);

  // ── Trailer key fetching ───────────────────────────────────────────────────
  useEffect(() => {
    // Low-end / TV devices: skip trailer fetching entirely to save bandwidth
    if (detectLowEndDevice()) return;

    const fetchTrailers = async () => {
      const storedCache = sessionStorage.getItem('movix_hero_trailers');
      const storedTimestamp = sessionStorage.getItem('movix_hero_trailers_timestamp');
      const oneDayMs = 24 * 60 * 60 * 1000;

      let sessionCache: { [key: number]: string | null } = {};
      if (storedCache && storedTimestamp && (Date.now() - parseInt(storedTimestamp)) < oneDayMs) {
        sessionCache = JSON.parse(storedCache);
        trailerCache.current = { ...trailerCache.current, ...sessionCache };
      }

      const keys: { [key: number]: string | null } = { ...trailerCache.current };
      const missing = items.filter((item) => trailerCache.current[item.id] === undefined);

      if (missing.length > 0) {
        const results = await Promise.allSettled(missing.map(async (item) => {
          const endpoint = `https://api.themoviedb.org/3/${item.media_type}/${item.id}/videos`;

          // Try French first
          let videos: any[] = [];
          try {
            const frRes = await axios.get(endpoint, {
              params: { api_key: TMDB_API_KEY, language: 'fr-FR' },
              timeout: 6000,
            });
            videos = frRes.data.results || [];
          } catch { /* ignore */ }

          const hasYtTrailer = (list: any[]) =>
            list.some(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));

          // Fall back to English if no French trailer
          if (!hasYtTrailer(videos)) {
            try {
              const enRes = await axios.get(endpoint, {
                params: { api_key: TMDB_API_KEY, language: 'en-US' },
                timeout: 6000,
              });
              const enVideos = enRes.data.results || [];
              if (hasYtTrailer(enVideos)) videos = enVideos;
            } catch { /* ignore */ }
          }

          const trailer =
            videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
            videos.find(v => v.site === 'YouTube' && v.type === 'Teaser') ||
            null;

          return trailer ? (trailer.key as string) : null;
        }));

        results.forEach((result, idx) => {
          const item = missing[idx];
          const key = result.status === 'fulfilled' ? result.value : null;
          keys[item.id] = key;
          trailerCache.current[item.id] = key;
        });

        sessionStorage.setItem('movix_hero_trailers', JSON.stringify(trailerCache.current));
        sessionStorage.setItem('movix_hero_trailers_timestamp', Date.now().toString());
      }

      setTrailerKeys(keys);
    };

    fetchTrailers();
  }, [items]);

  // ── Reset trailer reveal when slide changes ────────────────────────────────
  useEffect(() => {
    setTrailerReady(false);
    if (trailerRevealTimerRef.current) clearTimeout(trailerRevealTimerRef.current);
  }, [selectedIndex]);

  // ── Pause tracking ─────────────────────────────────────────────────────────
  const pausedAtRef = useRef<number | null>(null);
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      progressStartRef.current = performance.now();
      pausedAtRef.current = isPausedRef.current ? performance.now() : null;
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    onSelect();
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  // ── IntersectionObserver pause when off-screen ────────────────────────────
  useEffect(() => {
    if (!emblaApi) return;
    const root = emblaApi.rootNode();
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsVisible(entry.intersectionRatio > 0);
      },
      { threshold: [0, 0.05] }
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, [emblaApi]);

  // ── Auto-slide timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!emblaApi) return;

    const frozen = isPaused || !isVisible;
    if (frozen) {
      if (pausedAtRef.current === null) pausedAtRef.current = performance.now();
      if (autoSlideInterval.current) clearTimeout(autoSlideInterval.current);
      return;
    }

    if (pausedAtRef.current !== null) {
      const pauseDuration = performance.now() - pausedAtRef.current;
      progressStartRef.current += pauseDuration;
      pausedAtRef.current = null;
    }

    const scheduleNext = () => {
      if (autoSlideInterval.current) clearTimeout(autoSlideInterval.current);
      const elapsed = performance.now() - progressStartRef.current;
      const remaining = Math.max(AUTO_SLIDE_MS - elapsed, 50);
      autoSlideInterval.current = setTimeout(() => emblaApi.scrollNext(), remaining);
    };
    scheduleNext();

    const pauseOnPointer = () => { if (autoSlideInterval.current) clearTimeout(autoSlideInterval.current); };
    emblaApi.on('pointerDown', pauseOnPointer);
    emblaApi.on('pointerUp', scheduleNext);

    return () => {
      if (autoSlideInterval.current) clearTimeout(autoSlideInterval.current);
      emblaApi.off('pointerDown', pauseOnPointer);
      emblaApi.off('pointerUp', scheduleNext);
    };
  }, [emblaApi, isPaused, isVisible, selectedIndex]);

  // ── Horizontal wheel support ───────────────────────────────────────────────
  useEffect(() => {
    if (!emblaApi) return;
    const rootNode = emblaApi.rootNode();
    if (!rootNode) return;

    let lastWheel = 0;
    const THROTTLE_MS = 250;

    const onWheel = (e: WheelEvent) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absX <= absY || absX < 2) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastWheel < THROTTLE_MS) return;
      lastWheel = now;
      progressStartRef.current = performance.now();
      if (e.deltaX > 0) emblaApi.scrollNext();
      else emblaApi.scrollPrev();
    };

    rootNode.addEventListener('wheel', onWheel, { passive: false });
    return () => rootNode.removeEventListener('wheel', onWheel);
  }, [emblaApi]);


  const getYear = (item: Media) => {
    const date = item.release_date || item.first_air_date;
    return date ? new Date(date).getFullYear() : null;
  };

  const frozen = isPaused || !isVisible;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="embla relative w-full select-none"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      <style>
        {`
          @keyframes hero-progress {
            from { transform: scaleX(0); }
            to   { transform: scaleX(1); }
          }
          .hero-progress-fill {
            transform-origin: left;
            animation: hero-progress var(--hero-duration, 6000ms) linear forwards;
          }
          .hero-progress-fill.is-paused {
            animation-play-state: paused;
          }
          /* Full-bleed YouTube iframe — scaled 1.4x so the control bar and
             watermark at the edges of the 16:9 frame are pushed outside the
             container's overflow:hidden clip boundary. */
          .hero-yt-frame {
            position: absolute;
            top: 50%;
            left: 50%;
            /* scale(1.4): control bar ~48px at bottom of 1080p → 1080*1.4=1512px
               visible window = 550/1.4 ≈ 393px → we see center ±196px → max 736px
               control bar at 1080px → 1080*1.4=1512 → way outside 736 ✓ */
            transform: translate(-50%, calc(-50% + 2cm)) scale(1.12);
            min-width: 100%;
            min-height: 100%;
            width: 177.78vh;
            height: 56.25vw;
            border: 0;
            pointer-events: none;
            transition: opacity 1s ease;
          }
        `}
      </style>
      <div
        className="relative w-full overflow-hidden"
        style={{ height: '550px' }}
      >
        {/* Edge fades */}
        <div className="absolute inset-y-0 left-0 w-10 sm:w-14 md:w-20 z-20 pointer-events-none bg-gradient-to-r from-black via-black/40 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-10 sm:w-14 md:w-20 z-20 pointer-events-none bg-gradient-to-l from-black via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-32 z-20 pointer-events-none bg-gradient-to-t from-black to-transparent" />

        <div className="embla__viewport h-full w-full overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex h-full w-full">
            {items.map((item, idx) => {
              const logoUrl = logoUrls[item.id];
              const trailerKey = trailerKeys[item.id];
              const year = getYear(item);
              const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
              const isActive = idx === selectedIndex;
              // Show trailer only for the active, non-frozen slide that has a key
              const showTrailer = isActive && !frozen && !!trailerKey;

              return (
                <div
                  className="embla__slide h-full relative"
                  key={item.id}
                  style={{ userSelect: 'none', flex: '0 0 100%', minWidth: 0 }}
                >
                  {/* ── Backdrop image — always present as fallback layer ── */}
                  <img
                    src={`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`}
                    alt={item.title || item.name}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                    style={{
                      objectPosition: 'center 30%',
                      // Fade out backdrop once trailer is playing
                      opacity: showTrailer && trailerReady ? 0 : 1,
                      transition: 'opacity 1s ease',
                    }}
                    draggable={false}
                    loading={isActive ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={isActive ? 'high' : 'low'}
                  />

                  {/* ── YouTube trailer iframe — full-bleed, no controls ── */}
                  {showTrailer && (
                    <>
                      <iframe
                        key={`yt-${item.id}-${selectedIndex}`}
                        className="hero-yt-frame z-[1]"
                        style={{ opacity: trailerReady ? 1 : 0 }}
                        src={[
                          `https://www.youtube-nocookie.com/embed/${trailerKey}`,
                          `?autoplay=1&mute=1&loop=1&controls=0`,
                          `&showinfo=0&rel=0&modestbranding=1`,
                          `&playsinline=1&iv_load_policy=3`,
                          `&disablekb=1&fs=0`,
                          `&cc_load_policy=0`,
                          `&playlist=${trailerKey}`,
                        ].join('')}
                        allow="autoplay; encrypted-media"
                        title={item.title || item.name || 'trailer'}
                        onLoad={() => {
                          // 3s delay: ensures autoplay has started before revealing
                          // (hides the initial YouTube thumbnail/play-button overlay)
                          trailerRevealTimerRef.current = setTimeout(
                            () => setTrailerReady(true),
                            4500
                          );
                        }}
                      />
                      {/* Transparent shield so iframe doesn't steal pointer events */}
                      <div className="absolute inset-0 z-[2]" style={{ background: 'transparent' }} />
                    </>
                  )}

                  {/* ── Gradient overlay ── */}
                  <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                      background: `
                        linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.15) 65%, transparent 100%),
                        linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 30%, rgba(0,0,0,0.05) 60%, transparent 100%)
                      `,
                    }}
                  />

                  {/* ── Content ── */}
                  <div className="absolute inset-0 flex items-end md:items-center z-20">
                    <div className="w-full md:max-w-2xl px-4 sm:px-6 md:px-12 pb-20 md:pb-16">
                      <AnimatePresence mode="wait">
                        {isActive && (
                          <motion.div
                            key={`content-${item.id}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="space-y-3 sm:space-y-5"
                          >
                            <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center">
                              <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white/90 text-[10px] sm:text-xs font-medium uppercase tracking-wider">
                                {item.media_type === 'movie' ? t('search.movieLabel') : t('search.serieLabel')}
                              </span>
                              {year && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 text-[10px] sm:text-xs font-medium">
                                  <Calendar className="w-3 h-3" />
                                  {year}
                                </span>
                              )}
                              {rating && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-yellow-500/25 border border-yellow-500/30 text-yellow-300 text-[10px] sm:text-xs font-semibold">
                                  <Star className="w-3 h-3 fill-current" />
                                  {rating}
                                </span>
                              )}
                            </div>

                            <div className="min-h-[56px] sm:min-h-[80px] md:min-h-[110px] flex items-end">
                              {logoUrl ? (
                                <img
                                  src={logoUrl}
                                  alt={item.title || item.name}
                                  className="block object-contain object-left w-auto h-auto max-w-full max-h-[64px] sm:max-h-[80px] md:max-h-[110px] min-h-[40px] md:min-h-[56px] drop-shadow-lg"
                                  draggable={false}
                                  loading={isActive ? 'eager' : 'lazy'}
                                  decoding="async"
                                />
                              ) : (
                                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight line-clamp-2 drop-shadow-lg">
                                  {item.title || item.name || ''}
                                </h1>
                              )}
                            </div>

                            <p className="text-xs sm:text-sm md:text-base text-white/80 max-w-xl line-clamp-2 sm:line-clamp-3 leading-relaxed">
                              {item.overview}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                <Link
                                  to={`/${item.media_type}/${encodeId(item.id)}`}
                                  className="inline-flex items-center gap-2 text-white px-4 sm:px-6 md:px-7 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-semibold transition-all"
                                  style={{ background: 'linear-gradient(135deg,#00e676,#a855f7)' }}
                                >
                                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                                  {t('home.hero.play')}
                                </Link>
                              </motion.div>
                              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                                <Link
                                  to={`/${item.media_type}/${encodeId(item.id)}`}
                                  className="inline-flex items-center gap-2 bg-white/15 text-white px-4 sm:px-6 md:px-7 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-sm sm:text-base font-medium border border-white/20 transition-all"
                                  onMouseEnter={e => {
                                    const span = e.currentTarget.querySelector('span.hero-info-text') as HTMLElement | null;
                                    if (span) span.style.cssText = 'background:linear-gradient(135deg,#00e676,#a855f7);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent';
                                  }}
                                  onMouseLeave={e => {
                                    const span = e.currentTarget.querySelector('span.hero-info-text') as HTMLElement | null;
                                    if (span) span.style.cssText = '';
                                  }}
                                >
                                  <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                                  <span className="hero-info-text">{t('home.hero.moreInfo')}</span>
                                </Link>
                              </motion.div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </motion.div>
  );
};

const HeroSlider: React.FC<HeroSliderProps> = ({ items }) => {
  const [isHidden, setIsHidden] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('settings_hide_hero') === 'true';
  });

  useEffect(() => {
    const sync = () => setIsHidden(localStorage.getItem('settings_hide_hero') === 'true');
    window.addEventListener('storage', sync);
    window.addEventListener('hero_visibility_changed', sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('hero_visibility_changed', sync as EventListener);
    };
  }, []);

  if (isHidden) return null;
  return <HeroSliderInner items={items} />;
};

export default React.memo(HeroSlider);
