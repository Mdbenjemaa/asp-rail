/**
 * Mission d'agent PN (TES F), d'après le support « Formation TES F – Intervenant PN » (ETF).
 * Les étapes reprennent l'ordre du support ; la fiche de travail, la consigne PN et le livret de service priment.
 * Chaque étape faite garde son heure : c'est le journal de la mission.
 */
import { useMemo } from 'react';
import type { Cloture } from '../archive/cloture';
import { creerCollection, newId } from '../lib/collection';
import type { LinePoint } from '../lib/data';
import { fmtLine, fmtPk } from '../lib/format';
import { heure, heureDans, jourDe } from '../lib/temps';

export { heure, newId };

export type RolePn = 'travaux' | 'franchissement';
export type TypePn = 'SAL2' | 'SAL2B' | 'SAL4' | 'SALFC' | 'SAL0';
/** Boîtier de commutateurs (CSR, FntA, blocage) ou commutateur Marche-Arrêt (et Normal-Secours). */
export type Commande = 'boitier' | 'ma';
export type Procedure = 'mobile' | 'lam';

export const ROLE_PN: Record<RolePn, string> = {
  travaux: 'Agent PN en travaux',
  franchissement: 'Agent franchissement mobile travaux',
};
export const TYPE_PN: Record<TypePn, string> = {
  SAL2: 'SAL 2',
  SAL2B: 'SAL 2B',
  SAL4: 'SAL 4',
  SALFC: 'SAL FC',
  SAL0: 'SAL 0',
};

export interface PnInfo {
  /** « 11 », « 26 bis »… */
  numero: string;
  ligne: string | null;
  ligneNom: string | null;
  pk: number | null;
  /** Route et commune (données ouvertes), pour se repérer. */
  lieu: string;
  type: TypePn | null;
  commande: Commande;
  /** Ligne équipée en BAL : commutateurs de blocage. */
  bal: boolean;
  voies: 'double' | 'unique';
}

export interface Evenement {
  id: string;
  t: number;
  texte: string;
  /** Étape cochée (pour pouvoir la décocher). */
  etape?: string;
  /** N° de dépêche, remarque… */
  note?: string;
  type: 'etape' | 'passage' | 'derangement' | 'note' | 'annulation';
  /** Étape décochée ensuite : l'heure d'origine reste au journal, marquée annulée. */
  annule?: number;
}

export interface Mission {
  id: string;
  created: number;
  updated: number;
  role: RolePn;
  pn: PnInfo;
  date: string;
  horaire: 'jour' | 'nuit';
  contrat: string;
  indice: string;
  cch: string;
  rptx: string;
  notes: string;
  /** Étape → heure à laquelle elle a été faite. */
  faits: Record<string, number>;
  /** Étape → n° de dépêche noté. */
  depeches: Record<string, string>;
  journal: Evenement[];
  /** Passages de mobiles travaux et mises en voie de LAM terminés. */
  passages: number;
  lam: number;
  /** Procédure en cours (mobile travaux ou LAM) : étapes cochées de ce passage. */
  enCours: { type: Procedure; debut: number; faits: Record<string, number> } | null;
  fin: number | null;
  /** Créée par « Nouvelle mission » et pas encore remplie. */
  brouillon?: boolean;
  /** Clôture de fin de mission : archivée et verrouillée. */
  cloture?: Cloture | null;
}

export interface Etape {
  id: string;
  texte: string;
  aide?: string;
  /** On peut y noter un n° de dépêche. */
  depeche?: boolean;
  /** Étape conditionnelle : on peut la passer. */
  facultative?: boolean;
}
export interface Phase {
  id: 'avant' | 'verif' | 'prise' | 'fin';
  titre: string;
  lieu?: string;
  etapes: Etape[];
}

const aujourdhui = () => jourDe(Date.now());

export function nouvelleMission(init: Partial<Mission> = {}): Mission {
  const now = Date.now();
  const h = new Date(now).getHours();
  return {
    id: newId(),
    created: now,
    updated: now,
    role: 'travaux',
    pn: { numero: '', ligne: null, ligneNom: null, pk: null, lieu: '', type: null, commande: 'boitier', bal: false, voies: 'double' },
    date: aujourdhui(),
    horaire: h >= 20 || h < 6 ? 'nuit' : 'jour',
    contrat: '',
    indice: '',
    cch: '',
    rptx: '',
    notes: '',
    faits: {},
    depeches: {},
    journal: [],
    passages: 0,
    lam: 0,
    enCours: null,
    fin: null,
    ...init,
  };
}

const AGRES =
  'Radios, dispositif de shuntage (DSh), signaux d’arrêt à main (SAM), pétards à griffes, clé de Berne, clé triangulaire (cadenas d’artillerie), cadenas, torche à flamme rouge, fanion, lanternes à feu rouge (assez pour toutes les voies), manivelle.';

/** Les phases de la mission et leurs étapes, selon le rôle et l'équipement du PN. */
export function phases(m: Mission): Phase[] {
  const bx = m.pn.commande === 'boitier';
  const fermer = bx ? 'Placer le CSR sur FERMETURE' : 'Placer le commutateur MARCHE-ARRÊT sur ARRÊT';
  const avant: Phase = {
    id: 'avant',
    titre: 'Avant',
    lieu: 'Hors emprises',
    etapes: [{ id: 'briefing', texte: 'Participer au briefing sécurité avec tous les acteurs du chantier', aide: 'Obligatoire : il fait partager le dispositif de sécurité et anticipe les aléas.' }],
  };
  if (m.role === 'franchissement') {
    return [
      avant,
      {
        id: 'verif',
        titre: 'Prise de surveillance',
        lieu: 'Dans les emprises',
        etapes: [
          { id: 'ordre-surv', texte: 'Recevoir l’ordre de prendre la surveillance du PN en travaux (CCh et/ou RPTx)', depeche: true },
          { id: 'bcm-repris', texte: bx ? 'Vérifier que le BCM est repris en travaux' : 'Vérifier que le PN est repris en travaux (commutateur M/A)' },
          { id: 'sam-places', texte: 'Vérifier que les SAM sont placés de part et d’autre du PN' },
          { id: 'debut-surv', texte: 'Si tout est bon : passer la dépêche de début de surveillance du PN', depeche: true },
        ],
      },
      {
        id: 'fin',
        titre: 'Fin de mission',
        etapes: [
          { id: 'fin-recue', texte: 'Recevoir la dépêche de fin de surveillance du CCh', depeche: true },
          { id: 'fin-passee', texte: 'Passer la dépêche de fin de surveillance au CCh et/ou RPTx', depeche: true },
          { id: 'photo-fin', texte: bx ? 'Prendre une photo du BCM fermé et cadenassé' : 'Prendre une photo du commutateur M/A cadenassé' },
          { id: 'derangement-fin', texte: 'S’il y a un dérangement : passer la dépêche au CCh et/ou RPTx', depeche: true, facultative: true },
          { id: 'arf', texte: 'Compléter le cadre C de l’ARF et le rendre au RSO ou au RSNCF' },
        ],
      },
    ];
  }
  const prise: Etape[] = bx
    ? [
        ...(m.pn.bal
          ? [
              {
                id: 'blocage',
                texte: 'Placer le commutateur de BLOCAGE sur FERMETURE (rouge), avec la clé de Berne',
                aide: 'Avant toute mise hors service d’une annonce : sinon, elle n’est pas effective. L’indication S est alors présentée sur le panneau qui précède le PN.',
              },
            ]
          : []),
        { id: 'dsh', texte: 'Placer le DSh en voie (si nécessaire selon le circuit de voie) et vérifier les voyants d’annonce' },
        { id: 'sam', texte: 'Placer les SAM de part et d’autre du PN' },
        { id: 'csr-fermeture', texte: fermer, aide: 'Il faut le CSR sur FERMETURE pour relever le couvercle du boîtier.' },
        {
          id: 'fnta',
          texte: 'Placer le commutateur FntA de la voie (ou du sens) sur HORS SERVICE',
          aide: 'Seulement celui de la voie concernée : l’annonce de l’autre voie reste automatique. Le CSR commande alors le PN pour cette voie.',
        },
        { id: 'voyants', texte: 'Vérifier les voyants d’annonce', aide: 'Le voyant de la voie mise hors service passe (ou reste) au rouge. Blanc : pas d’annonce.' },
        { id: 'csr-ouverture', texte: 'Placer le CSR sur OUVERTURE' },
        {
          id: 'photo',
          texte: 'Verrouiller le boîtier (patte de verrouillage cadenassée) et prendre une photo du BCM fermé et cadenassé',
          aide: 'La patte de verrouillage ne s’utilise que sous couvert d’une consigne remise à l’agent.',
        },
      ]
    : [
        { id: 'dsh', texte: 'Placer le DSh en voie (si nécessaire selon le circuit de voie) et vérifier les voyants d’annonce' },
        { id: 'sam', texte: 'Placer les SAM de part et d’autre du PN' },
        { id: 'ma-arret', texte: 'Placer le commutateur MARCHE-ARRÊT sur ARRÊT', aide: 'Le PN se ferme (ou reste fermé).' },
        {
          id: 'secours',
          texte: 'Placer le commutateur NORMAL-SECOURS de la voie (ou du sens) sur SECOURS',
          aide: 'L’annulation de l’annonce n’est effective que si le M/A est déjà sur ARRÊT. Une sonnerie faible tinte pendant l’annulation.',
        },
        { id: 'voyants', texte: 'Vérifier les voyants d’annonce' },
        {
          id: 'ma-marche',
          texte: 'Remettre le M/A sur MARCHE, après avoir vérifié qu’aucune annonce n’est déclenchée sur l’autre voie (ou l’autre sens)',
          aide: 'Avant la 1re remise sur MARCHE : regarder le voyant de l’autre voie ; s’il est au rouge, attendre qu’il passe au blanc.',
        },
        { id: 'photo', texte: 'Prendre une photo du commutateur M/A cadenassé' },
      ];
  return [
    avant,
    {
      id: 'verif',
      titre: 'Vérifications',
      lieu: 'Dans les emprises',
      etapes: [
        { id: 'identifier', texte: 'Identifier le PN', aide: 'Numéro sur la maison de garde ou les plaquettes. Étiquette blanche : voie 1 ou sens impair ; bleue : voie 2 ou sens pair.' },
        { id: 'agres', texte: 'Vérifier les agrès (armoire)', aide: AGRES },
        { id: 'etat', texte: 'Vérifier le bon état des installations (feux, barrières…)' },
        {
          id: 'fonctionnement',
          texte: 'S’assurer que le PN fonctionne normalement avant de le reprendre en travaux',
          aide: 'Sinon, signaler tout de suite le type de dérangement au CCh ou au RPTx.',
        },
        { id: 'presence', texte: 'Avertir le CCh de ta présence au PN' },
        { id: 'ordre', texte: 'Recevoir l’ordre de début d’intervention au PN en travaux (CCh et/ou RPTx)', depeche: true },
      ],
    },
    {
      id: 'prise',
      titre: 'Prise en travaux',
      lieu: 'Fiche de travail',
      etapes: [
        ...prise,
        { id: 'compte', texte: 'Rendre compte au CCh et/ou RPTx (verbal ou dépêche)', depeche: true },
        { id: 'carnet', texte: 'Compléter le carnet du PN, partie travaux', aide: 'Date et heure de reprise du PN, numéro du contrat de travaux et indice repris sur la fiche de travail.' },
      ],
    },
    {
      id: 'fin',
      titre: 'Fin de mission',
      etapes: [
        { id: 'fin-recue', texte: 'Recevoir la dépêche de fin d’intervention du CCh et/ou RPTx', depeche: true },
        {
          id: 'normal',
          texte: 'Remettre l’installation en situation normale',
          aide: bx
            ? 'Chaque FntA cadenassé sur EN SERVICE (sinon le boîtier ne se cadenasse pas), CSR sur OUVERTURE, blocage sur OUVERTURE (vert), matériel retiré de la voie, selon la fiche de travail.'
            : 'M/A cadenassé sur MARCHE, Normal-Secours cadenassé sur NORMAL, matériel retiré de la voie, selon la fiche de travail.',
        },
        { id: 'fin-passee', texte: 'Passer la dépêche de fin d’intervention au CCh et/ou RPTx', depeche: true },
        { id: 'photo-fin', texte: bx ? 'Prendre une photo du BCM fermé et cadenassé' : 'Prendre une photo du commutateur M/A cadenassé' },
        { id: 'carnet-fin', texte: 'Compléter le carnet du PN (fin d’intervention)' },
        { id: 'derangement-fin', texte: 'S’il y a un dérangement : passer la dépêche au CCh et/ou RPTx', depeche: true, facultative: true },
        { id: 'arf', texte: 'Compléter le cadre C de l’ARF et le rendre au RSO ou au RSNCF' },
      ],
    },
  ];
}

/** Arrivée d'un mobile travaux, ou mise en voie d'un LAM : la suite d'actions du support. */
export function procedure(m: Mission, type: Procedure): Etape[] {
  const bx = m.pn.commande === 'boitier';
  const fermer: Etape = { id: 'fermer', texte: `Si rien ne s’y oppose (véhicules routiers) : ${bx ? 'CSR sur FERMETURE' : 'M/A sur ARRÊT'}` };
  const ouvrir: Etape = { id: 'ouvrir', texte: bx ? 'Placer le CSR sur OUVERTURE' : 'Remettre le M/A sur MARCHE' };
  const verrou: Etape = { id: 'verrou', texte: bx ? 'Fermer le BCM (patte de verrouillage)' : 'Fermer et cadenasser le commutateur M/A' };
  if (type === 'lam') {
    return [
      { id: 'fiche', texte: 'Vérifier que c’est prévu à la fiche de travail' },
      fermer,
      { id: 'sam-amont', texte: 'Te placer avec un SAM en amont du lieu de stationnement du LAM, pour arrêter les circulations routières' },
      {
        id: 'barriere',
        texte: 'Relever la barrière à la main pour le passage et la mise en voie',
        aide: 'Dispositif Main/Moteur : levier ou commutateur sur MAIN, manivelle tournée dans le sens des aiguilles d’une montre. Ne pas revenir sur OUVERTURE avant la fermeture complète ; à la fin, ramener et cadenasser sur MOTEUR.',
      },
      { id: 'sam-retrait', texte: 'Retirer le SAM, en accord avec l’agent LAM, pour le départ du LAM en voie' },
      { id: 'sam-remis', texte: 'Repositionner le SAM' },
      ouvrir,
      verrou,
    ];
  }
  const travaux = m.role === 'travaux';
  return [
    ...(travaux ? [{ id: 'compte', texte: 'Rendre compte au CCh et/ou RPTx' }] : []),
    { id: 'consigne', texte: travaux ? 'Regarder si c’est prévu dans la consigne PN' : 'Regarder si c’est prévu à la fiche de travail' },
    { id: 'position', texte: 'Vérifier la position du mobile travaux sur la situation géographique' },
    fermer,
    ...(travaux ? [{ id: 'dsh-haut', texte: 'Déposer la partie haute du DSh (s’il y en a un)', facultative: true }] : []),
    { id: 'sam-loin', texte: 'Retirer le SAM le plus éloigné du mobile travaux' },
    { id: 'sam-pres', texte: 'Retirer le SAM près du mobile travaux' },
    { id: 'traversee', texte: 'Autoriser la traversée du PN' },
    { id: 'sam-remis', texte: 'Repositionner les SAM, en commençant par le plus proche du mobile travaux' },
    ...(travaux ? [{ id: 'dsh-remis', texte: 'Reposer la partie haute du DSh (s’il y en a un)', facultative: true }] : []),
    ouvrir,
    verrou,
  ];
}

export const PROCEDURE_TITRE: Record<Procedure, string> = { mobile: 'Arrivée d’un mobile travaux', lam: 'Mise en voie d’un LAM' };

/** Toutes les étapes de la mission, dans l'ordre. */
export const toutesEtapes = (m: Mission) => phases(m).flatMap((p) => p.etapes.map((e) => ({ ...e, phase: p })));

/** Où en est la mission : prochaine étape à faire, et compte des étapes faites. */
export function avancement(m: Mission): { prochaine: (Etape & { phase: Phase }) | null; faites: number; total: number; pendant: boolean } {
  const all = toutesEtapes(m);
  const obligatoires = all.filter((e) => !e.facultative);
  const faites = obligatoires.filter((e) => m.faits[e.id]).length;
  const prochaine = all.find((e) => !m.faits[e.id] && !e.facultative) ?? null;
  // « Pendant » : la prise en travaux (ou de surveillance) est faite, la fin pas commencée.
  const fin = phases(m).find((p) => p.id === 'fin')!;
  const avantFin = all.filter((e) => e.phase.id !== 'fin' && !e.facultative);
  const pendant = avantFin.every((e) => m.faits[e.id]) && !fin.etapes.some((e) => m.faits[e.id]) && !m.fin;
  return { prochaine, faites, total: obligatoires.length, pendant };
}

/** Titre court : « PN 11 · ligne 830 000 ». */
export function titreMission(m: Mission): string {
  const n = m.pn.numero.trim();
  return `${n ? `PN ${n.replace(/^PN\s*/i, '')}` : 'PN sans numéro'}${m.pn.ligne ? ` · ligne ${fmtLine(m.pn.ligne)}` : ''}`;
}

/** Journal de la mission, à envoyer par message ou à recopier dans le carnet du PN. */
export function journalTexte(m: Mission): string {
  const lignes = [
    `Mission PN · ${titreMission(m)}`,
    [
      ROLE_PN[m.role],
      m.pn.type ? TYPE_PN[m.pn.type] : null,
      m.pn.pk !== null ? `PK ${fmtPk(m.pn.pk)}` : null,
      m.pn.lieu || null,
      `${m.date.split('-').reverse().join('/')}${m.horaire === 'nuit' ? ' (nuit)' : ''}`,
    ]
      .filter(Boolean)
      .join(' · '),
    [m.contrat && `Contrat travaux ${m.contrat}`, m.indice && `indice ${m.indice}`, m.cch && `CCh ${m.cch}`, m.rptx && `RPTx ${m.rptx}`].filter(Boolean).join(' · '),
    '',
    ...[...m.journal]
      .sort((a, b) => a.t - b.t)
      .map((e) => `${heureDans(e.t, m.date)}  ${e.texte}${e.note ? ` (${e.note})` : ''}${e.annule ? ` [annulée à ${heureDans(e.annule, m.date)}]` : ''}`),
  ];
  if (m.passages || m.lam) lignes.push('', `Mobiles travaux passés : ${m.passages} · LAM mis en voie : ${m.lam}`);
  lignes.push('', 'Aide-mémoire ASP Rail : le carnet du PN et les dépêches officielles font foi.');
  return lignes.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

/**
 * La mission est terminée quand toutes ses étapes obligatoires sont faites (et seulement alors) : à l'heure de la
 * dernière faite. Recalculé à chaque enregistrement, y compris après une modification du PN ou du rôle.
 */
function avecFin(m: Mission): Mission {
  const obligatoires = toutesEtapes(m).filter((e) => !e.facultative);
  const toutes = obligatoires.length > 0 && obligatoires.every((e) => m.faits[e.id]);
  const fin = toutes ? (m.fin ?? Math.max(...obligatoires.map((e) => m.faits[e.id]))) : null;
  return fin === m.fin ? m : { ...m, fin };
}

/**
 * Coche ou décoche une étape ; le journal suit. Décocher ne supprime rien : la ligne d'origine reste au journal,
 * marquée annulée, et une ligne « Annulé » est ajoutée. Recocher ajoute une nouvelle ligne à l'heure du moment.
 */
export function cocher(m: Mission, e: Etape, fait: boolean, note?: string): Mission {
  const now = Date.now();
  const faits = { ...m.faits };
  const depeches = { ...m.depeches };
  let journal = m.journal;
  if (fait) {
    faits[e.id] = now;
    if (note) depeches[e.id] = note;
    else delete depeches[e.id];
    journal = [...journal, { id: newId(), t: now, texte: e.texte, etape: e.id, note: note || undefined, type: 'etape' }];
  } else {
    const avant = m.faits[e.id];
    delete faits[e.id];
    delete depeches[e.id];
    // La ligne de l'étape encore valable (la plus récente non annulée) est marquée annulée.
    const i = journal.map((x) => x.etape === e.id && x.type === 'etape' && !x.annule).lastIndexOf(true);
    journal = journal.map((x, k) => (k === i ? { ...x, annule: now } : x));
    if (avant) journal = [...journal, { id: newId(), t: now, texte: `Annulé : ${e.texte}`, note: `faite à ${heureDans(avant, m.date)}`, type: 'annulation' }];
  }
  return avecFin({ ...m, faits, depeches, journal });
}

/* ---------- Stockage sur le téléphone ---------- */

const missions = creerCollection<Mission>('asp-missions-pn-v1', (m) => ({ ...nouvelleMission(), ...m, pn: { ...nouvelleMission().pn, ...m.pn } }));
/** Enregistre la mission (fin recalculée) ; false si le téléphone a refusé, l'alerte est déjà partie. */
export const enregistrerMission = (m: Mission) => missions.enregistrer(avecFin(m));
export const supprimerMission = missions.supprimer;
export const missionParId = missions.parId;
/** Missions en cours ou à clôturer (les archivées sont dans « Mes archives »). */
export function useMissions(): Mission[] {
  const l = missions.useListe();
  return useMemo(() => l.filter((m) => !m.cloture), [l]);
}
/** Toutes les missions, archivées comprises. */
export const useToutesMissions = missions.useListe;

/** Mission à montrer en grand : la dernière en cours, sinon la plus récente. */
export function missionDuJour(list: Mission[]): Mission | null {
  const recentes = [...list].sort((a, b) => b.updated - a.updated);
  return recentes.find((m) => !m.fin) ?? recentes[0] ?? null;
}


/* ---------- PN des données ouvertes ---------- */

/** « Classe 17 · VC · Bois-le-Roi (77037) » → « VC · Bois-le-Roi » (la classe et le code commune n'aident pas sur le terrain). */
export function lieuPn(detail: string): string {
  return detail
    .split(' · ')
    .filter((x) => !/^Classe\b/i.test(x.trim()))
    .map((x) => x.replace(/\s*\(\d{5}\)\s*$/, '').trim())
    .filter(Boolean)
    .join(' · ');
}

export interface PnProche {
  /** « PN 26 » */
  nom: string;
  numero: string;
  pk: number;
  lieu: string;
  /** Distance le long de la ligne (m). */
  distance: number;
  /** Vers les PK croissants depuis l'agent. */
  devant: boolean;
}

/** Les PN de la ligne les plus proches d'un PK, du plus proche au plus loin. */
export function pnsProches(points: LinePoint[] | undefined, pk: number, n = 3): PnProche[] {
  return (points ?? [])
    .filter((p) => p[1] === 'pn')
    .map((p) => ({
      nom: p[2],
      numero: p[2].replace(/^PN\s*/i, ''),
      pk: p[0],
      lieu: lieuPn(p[3] ?? ''),
      distance: Math.round(Math.abs(p[0] - pk) * 1000),
      devant: p[0] >= pk,
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, n);
}

/** Commence (ou reprend) un passage de mobile travaux ou une mise en voie de LAM. */
export function demarrerProcedure(m: Mission, type: Procedure): Mission {
  return m.enCours?.type === type ? m : { ...m, enCours: { type, debut: Date.now(), faits: {} } };
}

/** Termine le passage en cours : compteur, et une ligne au journal avec ses heures de début et de fin. */
export function terminerProcedure(m: Mission, type: Procedure): { m: Mission; texte: string } {
  const now = Date.now();
  const debut = m.enCours?.type === type ? m.enCours.debut : now;
  const n = (type === 'mobile' ? m.passages : m.lam) + 1;
  const texte = `${type === 'mobile' ? 'Passage du mobile travaux' : 'Mise en voie du LAM'} n° ${n} (de ${heure(debut)} à ${heure(now)})`;
  return {
    texte,
    m: {
      ...m,
      enCours: null,
      passages: m.passages + (type === 'mobile' ? 1 : 0),
      lam: m.lam + (type === 'lam' ? 1 : 0),
      journal: [...m.journal, { id: newId(), t: now, texte, type: 'passage' }],
    },
  };
}

/** Coche ou décoche un geste du passage en cours. */
export function cocherGeste(m: Mission, type: Procedure, id: string, fait: boolean): Mission {
  const ec = m.enCours?.type === type ? m.enCours : { type, debut: Date.now(), faits: {} as Record<string, number> };
  const faits = { ...ec.faits };
  if (fait) faits[id] = Date.now();
  else delete faits[id];
  return { ...m, enCours: { ...ec, faits } };
}

/** Ajoute une note libre au journal. */
export function ajouterNote(m: Mission, texte: string): Mission {
  return { ...m, journal: [...m.journal, { id: newId(), t: Date.now(), texte, type: 'note' }] };
}
