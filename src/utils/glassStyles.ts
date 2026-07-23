import type { CSSProperties } from 'react';

// Style liquid glass partagé — même structure que la nav du Header / le bouton Regarder du hero.
export const GLASS_BTN_STYLE: CSSProperties = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.06) 100%)',
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  borderTop: '1px solid rgba(255,255,255,0.28)',
  borderLeft: '1px solid rgba(255,255,255,0.16)',
  borderRight: '1px solid rgba(255,255,255,0.07)',
  borderBottom: '1px solid rgba(0,0,0,0.22)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 4px 14px rgba(0,0,0,0.28)',
};
