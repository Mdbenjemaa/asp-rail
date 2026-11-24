/**
 * Un chantier préparé par l'ASP : identification, zone de travail, plateforme, travaux, dispositif d'annonce et
 * check-lists. Gardé uniquement sur le téléphone (voir store.ts).
 */
import { fmtLine, fmtPk } from '../lib/format';
import {
  AUCUNE_PARTICULARITE,
  calculer,
  type Entree,
  type Outillage,
  type Particularites,
  type TypeChantier,
  type Voie,
} from './rules';

export type RoleAgent = 'asp' | 'annonceur' | 'repetiteur' | 'sentinelle';

export const ROLE_LABEL: Record<RoleAgent, string> = {
  asp: 'ASP',
  annonceur: 'Annonceur',
  repetiteur: 'Répétiteur',
  sentinelle: 'Sentinelle',
};

/** Initiale sur la carte : A1, R1, S1… */
export const ROLE_COURT: Record<RoleAgent, string> = { asp: 'ASP', annonceur: 'A', repetiteur: 'R', sentinelle: 'S' };

export interface Agent {
  id: string;
  role: RoleAgent;
  nom: string;
  /** Entreprise : une chaîne d'annonce ne mélange pas les entreprises. */
  entreprise: string;
  /** Position le long de la ligne (PK, km). */
  pk: number | null;
  /** Ce qu'il surveille : « idVoie:croissant », « idVoie:decroissant ». */
  surveille: string[];
}

export interface Chantier {
  id: string;
  created: number;
  updated: number;
  nom: string;
  /** Date du chantier (AAAA-MM-JJ). */
  date: string;
  horaire: 'jour' | 'nuit';
  type: TypeChantier;
  ligne: string | null;
  ligneNom: string | null;
  pkDebut: number | null;
  pkFin: number | null;
  /** Chantier mobile : longueur de la zone sous annonce (m) et PK actuel de l'équipe. */
  longueurAnnonce: number | null;
  pkEquipe: number | null;
  entreprise: string;
  asp: string;
  responsable: string;
  effectif: number | null;
  outillage: Outillage;
  dd: number | null;
  p: Particularites;
  voies: Voie[];
  agents: Agent[];
  /** Cases cochées des check-lists. */
  checks: Record<string, boolean>;
  notes: string;
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Nouvelle voie avec les réglages les plus courants. */
export function nouvelleVoie(nom: string, sens: Voie['sens'], role: Voie['role'] = 'contigue', vitesse: number | null = null): Voie {
  return { id: newId(), nom, sens, vitesse, role, interdite: false };
}

/** Chantier vide : double voie (V1 vers les PK croissants, V2 vers les PK décroissants, comme sur les lignes au départ de Paris). */
export function nouveauChantier(init: Partial<Chantier> = {}): Chantier {
  const now = Date.now();
  return {
    id: newId(),
    created: now,
    updated: now,
    nom: '',
    date: today(),
    horaire: 'jour',
    type: 'fixe',
    ligne: null,
    ligneNom: null,
    pkDebut: null,
    pkFin: null,
    longueurAnnonce: null,
    pkEquipe: null,
    entreprise: '',
    asp: '',
    responsable: '',
    effectif: null,
    outillage: 'cat1',
    dd: 5,
    p: { ...AUCUNE_PARTICULARITE },
    voies: [nouvelleVoie('V1', 'croissant', 'travail'), nouvelleVoie('V2', 'decroissant', 'contigue')],
    agents: [{ id: newId(), role: 'asp', nom: init.asp ?? '', entreprise: init.entreprise ?? '', pk: null, surveille: [] }],
    checks: {},
    notes: '',
    ...init,
  };
}

/** Relit un chantier gardé par une version plus ancienne de l'appli (champs ajoutés depuis). */
export function normaliser(c: Partial<Chantier> & { id: string }): Chantier {
  const base = nouveauChantier();
  return {
    ...base,
    ...c,
    p: { ...AUCUNE_PARTICULARITE, ...(c.p ?? {}) },
    voies: (c.voies ?? base.voies).map((v) => ({ ...nouvelleVoie('', 'croissant'), ...v })),
    agents: (c.agents ?? []).map((a: Partial<Agent>) => ({
      id: a.id ?? newId(),
      role: a.role ?? 'annonceur',
      nom: a.nom ?? '',
      entreprise: a.entreprise ?? '',
      pk: a.pk ?? null,
      surveille: a.surveille ?? [],
    })),
    checks: c.checks ?? {},
  };
}

/** Zone sous annonce : la zone de travail, ou pour un chantier mobile la portion où se trouve l'équipe. */
export function zoneAnnonce(c: Chantier): { debut: number | null; fin: number | null } {
  if (c.type === 'mobile' && c.longueurAnnonce && c.longueurAnnonce > 0) {
    const start = c.pkEquipe ?? (c.pkDebut !== null && c.pkFin !== null ? Math.min(c.pkDebut, c.pkFin) : c.pkDebut);
    if (start === null) return { debut: null, fin: null };
    return { debut: start, fin: Math.round((start + c.longueurAnnonce / 1000) * 1000) / 1000 };
  }
  return { debut: c.pkDebut, fin: c.pkFin };
}

export function entreeDe(c: Chantier): Entree {
  const z = zoneAnnonce(c);
  return {
    outillage: c.outillage,
    dd: c.dd,
    p: { ...c.p, nuit: c.horaire === 'nuit' },
    voies: c.voies,
    pkDebut: z.debut,
    pkFin: z.fin,
    type: c.type,
  };
}

export const calculChantier = (c: Chantier) => calculer(entreeDe(c));

/** Titre lisible : le nom donné, sinon la ligne et les PK. */
export function titreChantier(c: Chantier): string {
  if (c.nom.trim()) return c.nom.trim();
  if (c.pkDebut !== null) return `Chantier au PK ${fmtPk(c.pkDebut)}`;
  if (c.ligne) return `Chantier ligne ${fmtLine(c.ligne)}`;
  return 'Chantier sans nom';
}

export function zoneTexte(c: Chantier): string {
  if (c.pkDebut === null && c.pkFin === null) return 'Zone à préciser';
  if (c.pkFin === null || c.pkDebut === c.pkFin) return `PK ${fmtPk(c.pkDebut)}`;
  return `PK ${fmtPk(c.pkDebut)} → ${fmtPk(c.pkFin)}`;
}

export const SENS_LABEL = { croissant: 'PK croissants', decroissant: 'PK décroissants', deux: 'Les deux sens' } as const;
export const SENS_FLECHE = { croissant: '▲', decroissant: '▼', deux: '▲▼' } as const;
/** Sens en toutes lettres, au milieu d'une phrase. */
export const SENS_TEXTE = { croissant: 'vers les PK croissants', decroissant: 'vers les PK décroissants', deux: 'dans les deux sens' } as const;

/** Clé d'une voie dans un sens (surveillance des annonceurs). */
export const cleSens = (voieId: string, sens: 'croissant' | 'decroissant') => `${voieId}:${sens}`;

/** Effectif du dispositif : « 1 + 2 » (l'ASP, plus annonceurs, répétiteurs et sentinelles). */
export function effectifAnnonce(c: Chantier): string {
  const autres = c.agents.filter((a) => a.role !== 'asp').length;
  return `1 + ${autres}`;
}
