/** Progression au quiz, partagée entre l'écran du quiz, la question du jour et l'accueil. */
import { useSyncExternalStore } from 'react';
import { loadPref, savePref } from '../lib/me';
import { QUESTIONS_LAM } from '../lam/quiz';
import { QUESTIONS_PN } from '../pn/quiz';
import { QUESTIONS, type Question } from './quiz';

/** Banque de questions : annonce (TES M), passage à niveau (TES F) ou AP LAM / AP S9. */
export type Banque = 'asp' | 'pn' | 'lam';
const QS: Record<Banque, Question[]> = { asp: QUESTIONS, pn: QUESTIONS_PN, lam: QUESTIONS_LAM };
export const questionsDe = (b: Banque) => QS[b];
export const cleErreurs = (b: Banque) => (b === 'asp' ? 'asp-quiz-erreurs' : `asp-${b}-quiz-erreurs`);
const cleJustes = (b: Banque) => (b === 'asp' ? 'asp-quiz-justes' : `asp-${b}-quiz-justes`);
const EVT = 'asp-quiz';

/** Une bonne réponse sort des erreurs et compte comme sue ; une mauvaise fait l'inverse. */
export function noterReponse(b: Banque, id: string, juste: boolean): string[] {
  const ERREURS = cleErreurs(b);
  const JUSTES = cleJustes(b);
  const e = new Set(loadPref<string[]>(ERREURS, []));
  const j = new Set(loadPref<string[]>(JUSTES, []));
  if (juste) {
    e.delete(id);
    j.add(id);
  } else {
    e.add(id);
    j.delete(id);
  }
  savePref(ERREURS, [...e]);
  savePref(JUSTES, [...j]);
  window.dispatchEvent(new Event(EVT));
  return [...e];
}

export interface QuizStats {
  /** Questions dont la dernière réponse était juste. */
  justes: number;
  erreurs: number;
  total: number;
}

const cache: Partial<Record<Banque, QuizStats>> = {};
function snapshot(b: Banque): QuizStats {
  let s = cache[b];
  if (!s) {
    const ids = new Set(QS[b].map((q) => q.id));
    const n = (k: string) => loadPref<string[]>(k, []).filter((x) => ids.has(x)).length;
    s = { justes: n(cleJustes(b)), erreurs: n(cleErreurs(b)), total: QS[b].length };
    cache[b] = s;
  }
  return s;
}
function subscribe(cb: () => void) {
  const f = () => {
    delete cache.asp;
    delete cache.pn;
    delete cache.lam;
    cb();
  };
  window.addEventListener(EVT, f);
  window.addEventListener('storage', f);
  return () => {
    window.removeEventListener(EVT, f);
    window.removeEventListener('storage', f);
  };
}

export function useQuizStats(b: Banque): QuizStats {
  return useSyncExternalStore(subscribe, () => snapshot(b));
}

/** Petit générateur pseudo-aléatoire, stable pour une même graine (la question du jour ne change pas dans la journée). */
function graine(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** La question du jour, et l'ordre de ses réponses, tirés de la date. */
export function questionDuJour(b: Banque, jour: string): { q: Question; ordre: number[] } {
  const r = graine(`${b}-${jour}`);
  const q = QS[b][Math.floor(r() * QS[b].length)];
  const ordre = q.choix.map((_, i) => i);
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  return { q, ordre };
}
