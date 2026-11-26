/**
 * Mes semaines de planning ETF, gardées sur le téléphone : seulement ma ligne (le PDF, qui contient tous les agents
 * et leurs numéros, n'est jamais gardé). Un définitif n'est jamais remplacé par un provisoire de la même semaine.
 */
import { creerCollection, type Element } from '../lib/collection';
import { loadPref, savePref } from '../lib/me';
import { interpreter, type JourPlanning } from './jour';

export type Statut = 'definitif' | 'provisoire' | 'inconnu';

export interface SemainePlanning extends Element {
  /** « 2026-S48 ». */
  id: string;
  updated: number;
  semaine: number;
  annee: number;
  /** Lundi, AAAA-MM-JJ. */
  lundi: string;
  statut: Statut;
  /** Nom du fichier importé (on y lit « provisoire » ou « définitif »). */
  fichier: string;
  /** Mon nom tel qu'écrit dans le planning. */
  nom: string;
  /** Lignes de chaque case, du lundi au dimanche. */
  jours: string[][];
}

/** Au-delà, les semaines les plus anciennes sont oubliées. */
const MAX = 60;

const semaines = creerCollection<SemainePlanning>('asp-planning-v1', (s) => ({
  ...s,
  statut: s.statut ?? 'inconnu',
  fichier: s.fichier ?? '',
  nom: s.nom ?? '',
  jours: Array.from({ length: 7 }, (_, i) => (Array.isArray(s.jours?.[i]) ? s.jours[i].filter((x) => typeof x === 'string') : [])),
}));

export const useSemaines = () => semaines.useListe();
export const lireSemaines = () => semaines.lire();
export const oublierSemaine = (id: string) => semaines.supprimer(id);

export const idSemaine = (annee: number, semaine: number) => `${annee}-S${String(semaine).padStart(2, '0')}`;

export function statutDuFichier(nom: string): Statut {
  const n = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/provisoire/.test(n)) return 'provisoire';
  if (/definitif|definitive/.test(n)) return 'definitif';
  return 'inconnu';
}

export type Garde = 'nouvelle' | 'remplacee' | 'gardee-definitive' | 'refusee';

/** Garde une semaine. Le définitif déjà là reste si on importe ensuite le provisoire de la même semaine. */
export function garderSemaine(s: Omit<SemainePlanning, 'id' | 'updated'>): Garde {
  const id = idSemaine(s.annee, s.semaine);
  const avant = semaines.parId(id);
  if (avant && avant.statut === 'definitif' && s.statut === 'provisoire') return 'gardee-definitive';
  if (!semaines.enregistrer({ ...s, id, updated: Date.now() })) return 'refusee';
  const trop = [...semaines.lire()].sort((a, b) => b.lundi.localeCompare(a.lundi)).slice(MAX);
  for (const x of trop) semaines.supprimer(x.id);
  return avant ? 'remplacee' : 'nouvelle';
}

const decalage = (lundi: string, date: string) => {
  const [a, m, d] = lundi.split('-').map(Number);
  const [b, n, e] = date.split('-').map(Number);
  return Math.round((new Date(b, n - 1, e).getTime() - new Date(a, m - 1, d).getTime()) / 86400000);
};

/** La case d'un jour, dans les semaines données (la plus récemment importée si deux se recouvrent). */
export function jourDans(list: SemainePlanning[], date: string): JourPlanning | null {
  let trouve: SemainePlanning | null = null;
  for (const s of list) {
    const k = decalage(s.lundi, date);
    if (k >= 0 && k < 7 && (!trouve || s.updated > trouve.updated)) trouve = s;
  }
  if (!trouve) return null;
  return interpreter(trouve.jours[decalage(trouve.lundi, date)], date);
}

/** Les 7 jours d'une semaine importée. */
export function joursDe(s: SemainePlanning): JourPlanning[] {
  const [a, m, d] = s.lundi.split('-').map(Number);
  return s.jours.map((l, i) => {
    const t = new Date(a, m - 1, d + i);
    const date = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return interpreter(l, date);
  });
}

const NOM = 'asp-planning-nom';
/** Mon nom tel qu'il est écrit dans le planning (retenu au premier import). */
export const nomPlanning = () => loadPref<string>(NOM, '');
export const garderNomPlanning = (nom: string) => savePref(NOM, nom);
