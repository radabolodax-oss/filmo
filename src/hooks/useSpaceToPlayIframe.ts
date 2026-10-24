import { useEffect } from 'react';

// Les lecteurs tiers (Wavewatch, Multi, Omega, Wiflix, Fstream, Viper...) sont
// des <iframe> cross-origin : impossible d'y injecter un vrai play/pause en JS.
// Le mieux qu'on puisse faire depuis la page parente : empêcher le scroll natif
// de la barre d'espace et donner le focus à l'iframe, pour que le lecteur qu'elle
// contient (qui gère en général lui-même Espace en interne) reçoive la touche.

const MIN_PLAYER_WIDTH = 250;
const MIN_PLAYER_HEIGHT = 150;

function isInTextInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// Boutons/liens focusables : Espace y a déjà un sens natif (activer l'élément),
// on ne veut pas l'écraser.
function isActivatableControl(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'BUTTON' || tag === 'A') return true;
  const role = target.getAttribute('role');
  return role === 'button' || role === 'link' || role === 'checkbox' || role === 'radio';
}

function findVisiblePlayerIframe(): HTMLIFrameElement | null {
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
  for (const iframe of iframes) {
    const r = iframe.getBoundingClientRect();
    if (
      r.width >= MIN_PLAYER_WIDTH &&
      r.height >= MIN_PLAYER_HEIGHT &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < window.innerHeight &&
      r.left < window.innerWidth
    ) {
      return iframe;
    }
  }
  return null;
}

export const useSpaceToPlayIframe = () => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isInTextInput(e.target) || isActivatableControl(e.target)) return;

      const iframe = findVisiblePlayerIframe();
      if (!iframe) return;

      e.preventDefault();
      iframe.focus();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
};
