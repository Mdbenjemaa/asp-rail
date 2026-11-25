/** Progression au quiz, partagée entre l'écran du quiz, la question du jour et l'accueil. */
import { useSyncExternalStore } from 'react';
import { loadPref, savePref } from '../lib/me';
import { QUESTIONS, type Question } from './quiz';

export const ERREURS = 'asp-quiz-erreurs';
const JUSTES = 'asp-quiz-justes';
const EVT = 'asp-quiz';

/** Une bonne réponse sort des erreurs et compte comme sue ; une mauvaise fait l'inverse. */
export function noterReponse(id: string, juste: boolean): string[] {
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

let cache: QuizStats | null = null;
function snapshot(): QuizStats {
  if (!cache) {
    const ids = new Set(QUESTIONS.map((q) => q.id));
    const n = (k: string) => loadPref<string[]>(k, []).filter((x) => ids.has(x)).length;
    cache = { justes: n(JUSTES), erreurs: n(ERREURS), total: QUESTIONS.length };
  }
  return cache;
}
function subscribe(cb: () => void) {
  const f = () => {
    cache = null;
    cb();
  };
  window.addEventListener(EVT, f);
  window.addEventListener('storage', f);
  return () => {
    window.removeEventListener(EVT, f);
    window.removeEventListener('storage', f);
  };
}

export function useQuizStats(): QuizStats {
  return useSyncExternalStore(subscribe, snapshot);
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
export function questionDuJour(jour: string): { q: Question; ordre: number[] } {
  const r = graine(`asp-${jour}`);
  const q = QUESTIONS[Math.floor(r() * QUESTIONS.length)];
  const ordre = q.choix.map((_, i) => i);
  for (let i = ordre.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  }
  return { q, ordre };
}
