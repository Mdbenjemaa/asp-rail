/**
 * Déroulé d'une intervention d'ASP, noté sur place d'un toucher : les grands moments (arrivée, dispositif en
 * place, début et fin des travaux, dispositif levé), les trains annoncés et les incidents ou observations.
 * Il sert au compte rendu de fin (PDF ou message).
 */
import { newId } from '../lib/collection';
import { duree, heureDans } from '../lib/temps';
import type { Chantier } from './chantier';
import type { Resultat } from './rules';

export type JalonId = 'arrivee' | 'enPlace' | 'debut' | 'fin' | 'leve';

export interface Jalon {
  id: JalonId;
  /** Dans le compte rendu : « Dispositif d'annonce en place ». */
  titre: string;
  /** Sur le bouton, au moment de le noter. */
  bouton: string;
  aide?: string;
}

export const JALONS: Jalon[] = [
  { id: 'arrivee', titre: 'Arrivée sur le chantier', bouton: 'Je suis arrivé sur le chantier' },
  { id: 'enPlace', titre: 'Dispositif d’annonce en place', bouton: 'Dispositif en place', aide: 'Essais faits, AAn remise : les voies peuvent être engagées.' },
  { id: 'debut', titre: 'Début des travaux', bouton: 'Les travaux commencent' },
  { id: 'fin', titre: 'Fin des travaux', bouton: 'Travaux finis, voies dégagées' },
  { id: 'leve', titre: 'Dispositif levé', bouton: 'Dispositif levé : fin de l’intervention', aide: 'Quand le dispositif est levé : le compte rendu sera prêt à envoyer.' },
];

interface TrainAnnonce {
  t: number;
  /** Voie et sens (« idVoie:croissant »), si l'annonce a été notée sur une voie. */
  cle: string | null;
}

export interface EvenementCr {
  id: string;
  t: number;
  type: 'incident' | 'observation';
  texte: string;
}

export interface Deroule {
  /** Heure de chaque moment noté. */
  jalons: Partial<Record<JalonId, number>>;
  trains: TrainAnnonce[];
  evenements: EvenementCr[];
}

export const derouleVide = (): Deroule => ({ jalons: {}, trains: [], evenements: [] });

/** Relit un déroulé gardé (champ absent d'un chantier plus ancien, valeurs abîmées). */
export function lireDeroule(d: unknown): Deroule {
  const o = d && typeof d === 'object' ? (d as Partial<Deroule>) : {};
  const jalons: Deroule['jalons'] = {};
  for (const j of JALONS) {
    const t = o.jalons?.[j.id];
    if (typeof t === 'number' && Number.isFinite(t)) jalons[j.id] = t;
  }
  return {
    jalons,
    trains: Array.isArray(o.trains) ? o.trains.filter((x) => typeof x?.t === 'number').map((x) => ({ t: x.t, cle: typeof x.cle === 'string' ? x.cle : null })) : [],
    evenements: Array.isArray(o.evenements)
      ? o.evenements.filter((e) => typeof e?.t === 'number' && typeof e.texte === 'string').map((e) => ({ id: e.id || newId(), t: e.t, type: e.type === 'incident' ? 'incident' : 'observation', texte: e.texte }))
      : [],
  };
}

/** Le prochain moment à noter, dans l'ordre (null quand le dispositif est levé). */
export function prochainJalon(d: Deroule): Jalon | null {
  if (d.jalons.leve) return null;
  const dernier = JALONS.reduce((n, j, i) => (d.jalons[j.id] ? i : n), -1);
  return JALONS[dernier + 1] ?? null;
}

export const finie = (d: Deroule) => !!d.jalons.leve;

export function noterJalon(d: Deroule, id: JalonId, t: number): Deroule {
  return { ...d, jalons: { ...d.jalons, [id]: t } };
}

export function effacerJalon(d: Deroule, id: JalonId): Deroule {
  const jalons = { ...d.jalons };
  delete jalons[id];
  return { ...d, jalons };
}

/**
 * Heure tapée à la main (« 23:40 ») : le jour le plus proche de la référence (l'heure déjà notée, sinon le dernier
 * moment noté, sinon maintenant). Une nuit qui passe minuit tombe ainsi au bon jour.
 */
export function aHeure(hhmm: string, reference: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  const d = new Date(reference);
  d.setHours(+m[1], +m[2], 0, 0);
  const jour = 24 * 3600 * 1000;
  // Changement d'heure : à une heure près, sans importance ici.
  return [d.getTime() - jour, d.getTime(), d.getTime() + jour].reduce((a, b) => (Math.abs(b - reference) < Math.abs(a - reference) ? b : a));
}

/** Référence pour une heure tapée : l'heure du moment, sinon le dernier moment noté, sinon maintenant. */
export function referenceHeure(d: Deroule, id: JalonId | null, maintenant: number): number {
  const deja = id ? d.jalons[id] : undefined;
  if (deja) return deja;
  const notes = Object.values(d.jalons).filter((t): t is number => typeof t === 'number');
  return notes.length ? Math.max(...notes) : maintenant;
}

export function ajouterTrain(d: Deroule, cle: string | null, t: number): Deroule {
  return { ...d, trains: [...d.trains, { t, cle }] };
}

export function retirerDernierTrain(d: Deroule): Deroule {
  return { ...d, trains: d.trains.slice(0, -1) };
}

export function ajouterEvenementCr(d: Deroule, type: EvenementCr['type'], texte: string, t: number): Deroule {
  const e: EvenementCr = { id: newId(), t, type, texte: texte.trim() };
  return { ...d, evenements: [...d.evenements, e].sort((a, b) => a.t - b.t) };
}

export function retirerEvenementCr(d: Deroule, id: string): Deroule {
  return { ...d, evenements: d.evenements.filter((e) => e.id !== id) };
}

/** Durées de l'intervention, quand les deux bouts sont notés. */
export function durees(d: Deroule): { titre: string; ms: number }[] {
  const j = d.jalons;
  const out: { titre: string; ms: number }[] = [];
  const debutInter = j.arrivee ?? j.enPlace;
  if (debutInter && j.leve) out.push({ titre: 'Intervention', ms: j.leve - debutInter });
  if (j.enPlace && j.leve) out.push({ titre: 'Sous annonce', ms: j.leve - j.enPlace });
  if (j.debut && j.fin) out.push({ titre: 'Travaux', ms: j.fin - j.debut });
  return out.filter((x) => x.ms >= 0);
}

/** Nom d'une voie et d'un sens : « V1 ▲ ». */
export function nomSens(c: Chantier, cle: string | null): string {
  if (!cle) return 'Voie non précisée';
  const [id, sens] = cle.split(':');
  const v = c.voies.find((x) => x.id === id);
  return `${v?.nom || 'Voie'} ${sens === 'croissant' ? '▲' : '▼'}`;
}

/** Trains annoncés, par voie et sens (dans l'ordre des voies du chantier), avec leurs heures. */
export function trainsParSens(c: Chantier, r: Resultat, d: Deroule): { cle: string | null; nom: string; heures: number[] }[] {
  const cles: (string | null)[] = r.voies.map((v) => `${v.voieId}:${v.sens}`);
  for (const t of d.trains) if (!cles.includes(t.cle)) cles.push(t.cle);
  return cles
    .map((cle) => ({ cle, nom: nomSens(c, cle), heures: d.trains.filter((t) => t.cle === cle).map((t) => t.t) }))
    .filter((x) => x.heures.length);
}

/** État en quelques mots : « Pas commencée », « En cours depuis 2 h 05 », « Finie à 05:12 ». */
export function etatIntervention(c: Chantier, maintenant: number): string {
  const d = c.deroule;
  if (d.jalons.leve) return `Finie à ${heureDans(d.jalons.leve, c.date)}`;
  const debut = Math.min(...Object.values(d.jalons).filter((t): t is number => typeof t === 'number'));
  return Number.isFinite(debut) ? `En cours depuis ${duree(maintenant - debut)}` : 'Pas commencée';
}
