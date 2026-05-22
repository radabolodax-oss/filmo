import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface WatchInterstitialProps {
  posterUrl?: string;
  onDone: () => void;
  contained?: boolean;
}

const WatchInterstitial: React.FC<WatchInterstitialProps> = ({ posterUrl, onDone, contained = false }) => {
  const [count, setCount] = useState(5);
  const onDoneRef = useRef(onDone);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (count <= 0) { onDoneRef.current(); return; }
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <motion.div
      className={`${contained ? 'absolute' : 'fixed'} inset-0 z-10 flex items-center justify-center`}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(3px) brightness(0.5)', transform: 'scale(1.06)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black" />
      )}
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 max-w-sm px-8 text-center flex flex-col items-center gap-6">
        <p className="text-white text-base font-normal leading-relaxed tracking-wide">
          Pour éviter les pubs des lecteurs, installe l'extension{' '}
          <span className="font-bold text-white">uBlock</span>{' '}
          ou <span className="font-bold text-white">AdGuard</span>{' '}
          sur ton navigateur
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onDoneRef.current()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl backdrop-blur bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all duration-200 shadow-lg"
          >
            Passer
          </button>
          <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 border-red-500/80">
            <span className="text-red-500 font-bold text-2xl tabular-nums">{count}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WatchInterstitial;
