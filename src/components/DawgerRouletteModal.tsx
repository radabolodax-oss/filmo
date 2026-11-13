import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Dices, Play, RefreshCw, Flame, Star, Calendar, Clock, Film, Tv2, SlidersHorizontal } from 'lucide-react';
import axios from 'axios';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';
import { encodeId } from '../utils/idEncoder';

interface DawgerRouletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GENRES = [
  { id: 28, tvId: 10759, label: 'Action' },
  { id: 35, tvId: 35, label: 'Comédie' },
  { id: 18, tvId: 18, label: 'Drame' },
  { id: 878, tvId: 10765, label: 'Science-Fiction' },
  { id: 53, tvId: 9648, label: 'Thriller' },
  { id: 27, tvId: 9648, label: 'Horreur' },
  { id: 10749, tvId: 10766, label: 'Romance' },
  { id: 16, tvId: 16, label: 'Animation' },
  { id: 80, tvId: 80, label: 'Crime' },
  { id: 99, tvId: 99, label: 'Documentaire' },
];

const YEAR_RANGES = [
  { label: 'Toutes époques', gte: '', lte: '' },
  { label: '2020 - 2026', gte: '2020-01-01', lte: '2026-12-31' },
  { label: '2010 - 2019', gte: '2010-01-01', lte: '2019-12-31' },
  { label: '2000 - 2009', gte: '2000-01-01', lte: '2009-12-31' },
  { label: 'Classiques (< 2000)', gte: '1970-01-01', lte: '1999-12-31' },
];

function playSpinSound(isWin = false) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    if (isWin) {
      // Fanfare win chime
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.36);
      });
    } else {
      // Ticking click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch {
    // Silent
  }
}

export const DawgerRouletteModal: React.FC<DawgerRouletteModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  // Filters
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>('movie');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [selectedYearIdx, setSelectedYearIdx] = useState(0);
  const [movieDuration, setMovieDuration] = useState<'any' | 'short' | 'medium' | 'long'>('any');
  const [seriesLength, setSeriesLength] = useState<'any' | 'short' | 'long'>('any');

  // Roulette Animation State
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinCandidates, setSpinCandidates] = useState<any[]>([]);
  const [currentCandidateIdx, setCurrentCandidateIdx] = useState(0);
  const [winner, setWinner] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const spinIntervalRef = useRef<number | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  const handleStartSpin = async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinner(null);
    setErrorMsg('');

    try {
      const yearRange = YEAR_RANGES[selectedYearIdx];
      const params: Record<string, any> = {
        api_key: TMDB_API_KEY,
        language: getTmdbLanguage(),
        sort_by: 'popularity.desc',
        'vote_count.gte': 80,
        'vote_average.gte': 6.0,
      };

      if (selectedGenre) {
        params.with_genres = selectedGenre;
      }

      if (mediaType === 'movie') {
        if (yearRange.gte) params['primary_release_date.gte'] = yearRange.gte;
        if (yearRange.lte) params['primary_release_date.lte'] = yearRange.lte;
        if (movieDuration === 'short') params['with_runtime.lte'] = 90;
        if (movieDuration === 'medium') {
          params['with_runtime.gte'] = 90;
          params['with_runtime.lte'] = 135;
        }
        if (movieDuration === 'long') params['with_runtime.gte'] = 135;
      } else {
        if (yearRange.gte) params['first_air_date.gte'] = yearRange.gte;
        if (yearRange.lte) params['first_air_date.lte'] = yearRange.lte;
      }

      // Pick a random page between 1 and 6 for variety
      const randomPage = Math.floor(Math.random() * 5) + 1;
      params.page = randomPage;

      const endpoint = mediaType === 'movie' ? `${TMDB_API_URL}/discover/movie` : `${TMDB_API_URL}/discover/tv`;
      const res = await axios.get(endpoint, { params });
      let results: any[] = res.data?.results || [];

      // Filter series by length if specified
      if (mediaType === 'tv' && seriesLength !== 'any' && results.length > 0) {
        // We will keep results as candidate pool
      }

      // Filter items without poster
      results = results.filter((item) => item.poster_path);

      if (results.length === 0) {
        // Fallback without strict filters
        const fallbackRes = await axios.get(endpoint, {
          params: { api_key: TMDB_API_KEY, language: getTmdbLanguage(), sort_by: 'popularity.desc', page: 1 },
        });
        results = (fallbackRes.data?.results || []).filter((item: any) => item.poster_path);
      }

      if (results.length === 0) {
        setErrorMsg('Aucun résultat trouvé avec ces filtres. Essaie d\'élargir tes critères !');
        setIsSpinning(false);
        return;
      }

      // Shuffle candidates for the spinning reel
      const shuffled = [...results].sort(() => Math.random() - 0.5);
      setSpinCandidates(shuffled);

      // Select true winner
      const chosenWinner = shuffled[Math.floor(Math.random() * shuffled.length)];

      // Animated reel speed controller
      let currentIdx = 0;
      let delay = 60;
      const totalSteps = 24;
      let step = 0;

      const runSpin = () => {
        step++;
        currentIdx = (currentIdx + 1) % shuffled.length;
        setCurrentCandidateIdx(currentIdx);
        playSpinSound(false);

        if (step < totalSteps) {
          // Progressively decelerate
          if (step > 15) {
            delay += 25;
          } else if (step > 8) {
            delay += 10;
          }
          setTimeout(runSpin, delay);
        } else {
          // Stopped on winner!
          setWinner(chosenWinner);
          setIsSpinning(false);
          playSpinSound(true);
        }
      };

      setTimeout(runSpin, delay);
    } catch (err) {
      console.error('Error spinning roulette:', err);
      setErrorMsg('Erreur lors du tirage. Réessaie dans un instant !');
      setIsSpinning(false);
    }
  };

  const handleWatch = (item: any) => {
    onClose();
    const type = mediaType;
    navigate(`/${type}/${encodeId(item.id)}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-[#0f0e17] rounded-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <Dices size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Dawger Spin</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white font-semibold border border-white/20">
                  Roulette
                </span>
              </h2>
              <p className="text-xs text-white/50">Tu hésites ? Laisse le hasard choisir ta soirée !</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Winner Showcase or Reel */}
          <div className="relative min-h-[250px] sm:min-h-[280px] rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 p-4 sm:p-5 flex flex-col items-center justify-center overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute inset-0 bg-radial from-purple-500/15 via-transparent to-transparent pointer-events-none" />

            {isSpinning ? (
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative w-36 h-52 sm:w-40 sm:h-60 rounded-xl overflow-hidden border-2 border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.2)] transform scale-105 transition-all">
                  {spinCandidates[currentCandidateIdx]?.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${spinCandidates[currentCandidateIdx].poster_path}`}
                      alt="Spinning..."
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center text-white/50">
                      ?
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm font-semibold animate-pulse">
                  <RefreshCw size={16} className="animate-spin text-white" />
                  <span>Tirage en cours...</span>
                </div>
              </div>
            ) : winner ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full flex flex-col sm:flex-row items-center sm:items-start gap-5 z-10"
              >
                <div className="relative w-32 sm:w-40 flex-shrink-0 aspect-[2/3] rounded-xl overflow-hidden border-2 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  <img
                    src={`https://image.tmdb.org/t/p/w342${winner.poster_path}`}
                    alt={winner.title || winner.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-yellow-400 text-xs font-bold flex items-center gap-1 border border-yellow-400/30">
                    <Star size={11} fill="currentColor" />
                    <span>{winner.vote_average?.toFixed(1) || '7.5'}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 text-center sm:text-left space-y-2.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-xs font-bold border border-white/20">
                    <Sparkles size={12} />
                    <span>PÉPITE TROUVÉE</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {winner.title || winner.name}
                  </h3>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-white/60">
                    <span>
                      📅{' '}
                      {winner.release_date
                        ? new Date(winner.release_date).getFullYear()
                        : winner.first_air_date
                        ? new Date(winner.first_air_date).getFullYear()
                        : 'Classique'}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{mediaType === 'movie' ? 'Film' : 'Série'}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-white/70 line-clamp-3 leading-relaxed">
                    {winner.overview || 'Aucun synopsis disponible.'}
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <button
                      type="button"
                      onClick={() => handleWatch(winner)}
                      className="px-5 py-2.5 rounded-xl bg-white hover:bg-white/90 text-black font-extrabold text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <Play size={16} fill="currentColor" />
                      <span>Regarder maintenant</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartSpin}
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center gap-1.5 border border-white/15 active:scale-95 transition-all"
                    >
                      <RefreshCw size={14} />
                      <span>Relancer</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center text-center space-y-3 z-10">
                <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                  🎰
                </div>
                <h3 className="text-base font-bold text-white">Prêt pour le tirage ?</h3>
                <p className="text-xs text-white/50 max-w-sm">
                  Sélectionne tes préférences ci-dessous ou laisse tout par défaut pour une surprise totale !
                </p>
                <button
                  type="button"
                  onClick={handleStartSpin}
                  className="px-6 py-3 rounded-2xl bg-white hover:bg-white/90 text-black font-black text-sm tracking-wide uppercase flex items-center gap-2 shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 transition-all"
                >
                  <Dices size={18} />
                  <span>LANCER LE SPIN</span>
                </button>
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* Filters Section */}
          <div className="space-y-4 pt-1 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
              <SlidersHorizontal size={14} className="text-white/70" />
              <span>Ajuster les critères</span>
            </div>

            {/* Type selector: Film / Serie */}
            <div>
              <label className="text-xs text-white/50 block mb-1.5">Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMediaType('movie')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    mediaType === 'movie'
                      ? 'bg-white/20 text-white border border-white/40 shadow-sm'
                      : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                  }`}
                >
                  <Film size={14} />
                  <span>Film</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('tv')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    mediaType === 'tv'
                      ? 'bg-white/20 text-white border border-white/40 shadow-sm'
                      : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                  }`}
                >
                  <Tv2 size={14} />
                  <span>Série</span>
                </button>
              </div>
            </div>

            {/* Genres */}
            <div>
              <label className="text-xs text-white/50 block mb-1.5">Genre</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedGenre(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedGenre === null
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/50 hover:text-white/80'
                  }`}
                >
                  Tous genres
                </button>
                {GENRES.map((g) => {
                  const targetId = mediaType === 'movie' ? g.id : g.tvId;
                  const isSel = selectedGenre === targetId;
                  return (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => setSelectedGenre(isSel ? null : targetId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSel
                          ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                          : 'bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Year selector */}
            <div>
              <label className="text-xs text-white/50 block mb-1.5">Époque de sortie</label>
              <div className="flex flex-wrap gap-1.5">
                {YEAR_RANGES.map((yr, idx) => (
                  <button
                    key={yr.label}
                    type="button"
                    onClick={() => setSelectedYearIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedYearIdx === idx
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {yr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration / Length */}
            {mediaType === 'movie' ? (
              <div>
                <label className="text-xs text-white/50 block mb-1.5">Durée du film</label>
                <div className="grid grid-cols-4 gap-1.5 text-xs">
                  {[
                    { id: 'any', label: 'Toutes' },
                    { id: 'short', label: 'Court (< 1h30)' },
                    { id: 'medium', label: 'Standard (1h30-2h15)' },
                    { id: 'long', label: 'Long (> 2h15)' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setMovieDuration(d.id as any)}
                      className={`py-1.5 px-2 rounded-lg text-xs text-center font-medium transition-all ${
                        movieDuration === d.id
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-white/50 block mb-1.5">Format de série</label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  {[
                    { id: 'any', label: 'Toutes durées' },
                    { id: 'short', label: 'Courte / Mini-série' },
                    { id: 'long', label: 'Série longue (2+ saisons)' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeriesLength(s.id as any)}
                      className={`py-1.5 px-2 rounded-lg text-xs text-center font-medium transition-all ${
                        seriesLength === s.id
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Spin CTA */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <span className="text-xs text-white/40">Filtres prêts • Tirage instantané</span>
          <button
            type="button"
            disabled={isSpinning}
            onClick={handleStartSpin}
            className="px-6 py-2.5 rounded-xl bg-white hover:bg-white/90 text-black font-black text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            <Dices size={16} />
            <span>{winner ? 'Relancer le Spin' : 'Lancer le Spin'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DawgerRouletteModal;
