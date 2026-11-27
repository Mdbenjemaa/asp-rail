/**
 * Poste d'un agent de la chaîne d'annonce : annonceur, répétiteur ou sentinelle. Où il est (ligne, PK), ce qu'il
 * surveille et jusqu'où il doit voir arriver les trains, qui est son ASP, et son service (prise et fin de poste,
 * trains annoncés, incidents et observations). Gardé sur le téléphone ; relié, si l'agent le choisit, à la chaîne
 * que l'ASP partage sur un chantier partagé.
 */
import { creerCollection, newId } from '../lib/collection';
import { duree, heureDans } from '../lib/temps';

/** Date du jour (AAAA-MM-JJ), à l'heure du téléphone. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type RoleChaine = 'annonceur' | 'repetiteur' | 'sentinelle';

export const ROLE_CHAINE: Record<RoleChaine, string> = { annonceur: 'Annonceur', repetiteur: 'Répétiteur', sentinelle: 'Sentinelle' };
/** Lettre du code dans la chaîne : A1, R1, S1. */
const LETTRE_ROLE: Record<RoleChaine, string> = { annonceur: 'A', repetiteur: 'R', sentinelle: 'S' };

/** Un point d'annonce que l'agent doit voir. */
export interface PaPoste {
  /** « PA V1 ▲ ». */
  titre: string;
  pk: number;
}

interface TrainPoste {
  t: number;
  /** Point d'annonce (voie et sens) de l'annonce, s'il y en a plusieurs. */
  pa: string | null;
}

export interface EvenementPoste {
  id: string;
  t: number;
  type: 'incident' | 'observation';
  texte: string;
}

export interface Poste {
  id: string;
  created: number;
  updated: number;
  brouillon?: boolean;
  date: string;
  horaire: 'jour' | 'nuit';
  role: RoleChaine;
  /** Code dans la chaîne : « A1 ». */
  code: string;
  chantier: string;
  ligne: string | null;
  ligneNom: string | null;
  /** Mon PK. */
  pk: number | null;
  /** Ce que je surveille, en clair : « V1 ▲ ». */
  surveille: string;
  /** Points d'annonce à voir (depuis la chaîne de l'ASP, ou saisis). */
  pas: PaPoste[];
  asp: string;
  aspTel: string;
  /** Relié à la chaîne qu'un ASP partage : son téléphone (appareil) et le chantier partagé. */
  lien: { asp: string; session: string } | null;
  prise: number | null;
  fin: number | null;
  trains: TrainPoste[];
  evenements: EvenementPoste[];
  notes: string;
}

export function nouveauPoste(init: Partial<Poste> = {}): Poste {
  const t = Date.now();
  return {
    id: newId(),
    created: t,
    updated: t,
    date: today(),
    horaire: new Date().getHours() >= 18 || new Date().getHours() < 5 ? 'nuit' : 'jour',
    role: 'annonceur',
    code: 'A1',
    chantier: '',
    ligne: null,
    ligneNom: null,
    pk: null,
    surveille: '',
    pas: [],
    asp: '',
    aspTel: '',
    lien: null,
    prise: null,
    fin: null,
    trains: [],
    evenements: [],
    notes: '',
    ...init,
  };
}

const postes = creerCollection<Poste>('asp-postes-v1', (p) => ({ ...nouveauPoste(), ...p }));
export const enregistrerPoste = (p: Poste) => postes.enregistrer({ ...p, updated: Date.now() });
export const supprimerPoste = postes.supprimer;
export const posteParId = postes.parId;
export const usePostes = postes.useListe;

/** Le poste à mettre en avant : celui pas encore fini, le plus récent. */
export function posteDuJour(list: Poste[]): Poste | null {
  return list.filter((p) => !p.fin && !p.brouillon).sort((a, b) => b.updated - a.updated)[0] ?? null;
}

/** Titre : « Annonceur A1 · Traverses ». */
export const titrePoste = (p: Poste) => `${ROLE_CHAINE[p.role]} ${p.code}${p.chantier.trim() ? ` · ${p.chantier.trim()}` : ''}`;

/** « En place depuis 22:05 », « Fin de poste à 05:10 », « Pas encore en place ». */
export function etatPoste(p: Poste, maintenant = Date.now()): { texte: string; niveau: 'en-place' | 'attente' | 'fini' } {
  const h = (t: number) => heureDans(t, p.date);
  if (p.fin) return { texte: `Fin de poste à ${h(p.fin)}`, niveau: 'fini' };
  if (p.prise) return { texte: `En place depuis ${h(p.prise)} (${duree(maintenant - p.prise)})`, niveau: 'en-place' };
  return { texte: 'Pas encore en place', niveau: 'attente' };
}

/** Écart entre l'agent et un point d'annonce le long de la ligne (m). */
export const ecartPa = (p: Poste, pa: PaPoste) => (p.pk === null ? null : Math.round(Math.abs(p.pk - pa.pk) * 1000));

export function ajouterTrainPoste(p: Poste, pa: string | null, t = Date.now()): Poste {
  return { ...p, trains: [...p.trains, { t, pa }] };
}
export const retirerDernierTrainPoste = (p: Poste): Poste => ({ ...p, trains: p.trains.slice(0, -1) });

export function ajouterEvenementPoste(p: Poste, type: EvenementPoste['type'], texte: string, t = Date.now()): Poste {
  return { ...p, evenements: [...p.evenements, { id: newId(), t, type, texte: texte.trim() }].sort((a, b) => a.t - b.t) };
}
export const retirerEvenementPoste = (p: Poste, id: string): Poste => ({ ...p, evenements: p.evenements.filter((e) => e.id !== id) });

/** Trains annoncés par point d'annonce, avec leurs heures. */
export function trainsParPa(p: Poste): { nom: string; heures: number[] }[] {
  const noms = [...new Set(p.trains.map((t) => t.pa ?? 'Sans précision'))];
  return noms.map((nom) => ({ nom, heures: p.trains.filter((t) => (t.pa ?? 'Sans précision') === nom).map((t) => t.t) }));
}

/** Code suivant libre pour un rôle : A1, A2… */
export function codeLibre(role: RoleChaine, pris: string[]): string {
  const l = LETTRE_ROLE[role];
  for (let i = 1; i < 100; i++) if (!pris.includes(`${l}${i}`)) return `${l}${i}`;
  return `${l}1`;
}
