/** Mode nuit : choisi dans le menu, ou en « Auto » selon le mode sombre du téléphone. Gardé sur le téléphone. */
import { useEffect, useState } from 'react';
import type { Theme } from '../components/state';
import { loadPref, savePref } from '../lib/me';

const darkQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; night: boolean } {
  const [theme, setTheme] = useState<Theme>(() => loadPref<Theme>('asp-theme', 'auto'));
  const [systemDark, setSystemDark] = useState(() => darkQuery()?.matches ?? false);
  useEffect(() => savePref('asp-theme', theme), [theme]);
  useEffect(() => {
    const mq = darkQuery();
    if (!mq) return;
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const night = theme === 'nuit' || (theme === 'auto' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('night', night);
  }, [night]);
  return { theme, setTheme, night };
}
