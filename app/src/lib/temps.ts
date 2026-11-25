/** Heures, dates et durées affichées dans les missions, les journaux et les PDF (heure du téléphone, en français). */

const deux = (n: number) => String(n).padStart(2, '0');

/** « 14:32 » */
export const heure = (t: number) => {
  const d = new Date(t);
  return `${deux(d.getHours())}:${deux(d.getMinutes())}`;
};

/** « 25/11/2026 » depuis une date ISO « 2026-11-25 ». */
export const dateFr = (iso: string) => iso.split('-').reverse().join('/');

/** « 25/11/2026 à 14:32 » */
export const dateHeure = (t: number) => {
  const d = new Date(t);
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} à ${heure(t)}`;
};

/** « 45 min », « 2 h 05 » */
export const duree = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${deux(min % 60)}`;
};

/** Jour local (AAAA-MM-JJ) d'un instant. */
export const jourDe = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
};

/**
 * Heure d'un fait dans une mission : « 23:50 », et « 00:10 (26/11) » quand le fait tombe un autre jour que celui
 * de la mission (mission de nuit qui passe minuit).
 */
export const heureDans = (t: number, jourMission: string) => {
  const j = jourDe(t);
  return j === jourMission ? heure(t) : `${heure(t)} (${j.slice(8, 10)}/${j.slice(5, 7)})`;
};
