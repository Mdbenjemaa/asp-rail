import { useEffect, useState } from 'react';

/** L'heure qu'il est, rafraîchie toutes les 15 s (pour « Fait à 21:42 », « en cours depuis 35 min »). */
export function useHorloge(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
