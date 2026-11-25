/**
 * Mise en page autour de la carte : hauteur du bas de l'écran (pour placer l'échelle et le bandeau d'installation
 * au-dessus), et boutons de la carte en ronds sans texte quand ils passeraient sous la fiche du bas.
 */
import { useEffect, useRef, useState } from 'react';

export function useMiseEnPage() {
  const bottomZone = useRef<HTMLDivElement>(null);
  const topZone = useRef<HTMLDivElement>(null);
  const [toolsCompact, setToolsCompact] = useState(false);

  useEffect(() => {
    const el = bottomZone.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--bz', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Boutons de la carte (Couches, Accès, Signaler) : s'ils passaient sous la fiche du bas (bandeau du suivi plus
  // haut, fiche ouverte), ils deviennent des ronds sans texte ; ils reprennent leur texte dès qu'il y a la place.
  useEffect(() => {
    const tz = topZone.current;
    const bz = bottomZone.current;
    if (!tz || !bz || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const tools = tz.querySelector<HTMLElement>('.map-tools');
        if (!tools) return;
        const btns = Array.from(tools.children);
        // Hauteur en grand (64 px, le menu rond 52 px), quel que soit le mode affiché : pas de va-et-vient.
        const big = btns.reduce((h, b) => h + (b.classList.contains('round') ? 52 : 64), 0) + 10 * Math.max(0, btns.length - 1);
        // Limite : le haut de la fiche du bas, ou des boutons de la carte en bas à droite (crédits « i »).
        const ctrl = tz.parentElement?.querySelector<HTMLElement>('.maplibregl-ctrl-bottom-right');
        const ctrlTop = ctrl && ctrl.offsetHeight > 0 ? ctrl.getBoundingClientRect().top : Infinity;
        const room = Math.min(bz.getBoundingClientRect().top, ctrlTop) - tools.getBoundingClientRect().top - 8;
        setToolsCompact(big > room);
      });
    };
    const ro = new ResizeObserver(check);
    ro.observe(tz);
    ro.observe(bz);
    window.addEventListener('resize', check);
    check();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  return { bottomZone, topZone, toolsCompact };
}
