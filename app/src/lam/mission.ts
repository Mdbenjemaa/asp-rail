/**
 * Missions AP LAM et AP S9, d'après le « Livret technique AP-LAM / AP-S9 » : étapes dans l'ordre, carnet de
 * dépêches (numéro reçu, numéro donné, heure), passages de train travaux et journal horodaté, gardés sur le téléphone.
 * La consigne LAM, la fiche de travail, la situation géographique et les textes en vigueur priment toujours.
 */
import { useMemo } from 'react';
import type { Cloture } from '../archive/cloture';
import { creerCollection, newId } from '../lib/collection';
import type { LinePoint } from '../lib/data';
import { fmtLine, fmtPk } from '../lib/format';
import { heure, heureDans, jourDe } from '../lib/temps';

export { heure };

export type TypeMissionLam = 'lam' | 's9';
export type OutilS9 = 'dsh' | 'sam' | 'cmb' | 'obs';
export type Interlocuteur = 'RPTx' | 'CCh' | 'ASP' | 'Autre';

export const TYPE_MISSION: Record<TypeMissionLam, string> = { lam: 'AP LAM', s9: 'AP S9' };
export const OUTIL_S9: Record<OutilS9, string> = {
  dsh: 'Dispositif de shuntage (DSh)',
  sam: 'SAM appuyé d’un pétard',
  cmb: 'Commutateur de blocage',
  obs: 'Observation (signal, voyant, libération de voie)',
};
export const OUTIL_COURT: Record<OutilS9, string> = { dsh: 'DSh', sam: 'SAM + pétard', cmb: 'commutateur', obs: 'observation' };
export const INTERLOCUTEURS: Interlocuteur[] = ['RPTx', 'CCh', 'ASP', 'Autre'];

export interface LieuLam {
  ligne: string | null;
  ligneNom: string | null;
  pk: number | null;
  voie: string;
  lieu: string;
}

export interface Depeche {
  id: string;
  t: number;
  avec: Interlocuteur;
  objet: string;
  /** Numéro reçu de l'interlocuteur. */
  recu: string;
  /** Numéro donné à l'interlocuteur. */
  donne: string;
  /** Étape de la mission validée par cette dépêche. */
  etape?: string;
  /** Étape décochée ensuite : la dépêche reste au carnet, marquée annulée (ses numéros restent pris). */
  annulee?: number;
}

export interface EvenementLam {
  id: string;
  t: number;
  texte: string;
  etape?: string;
  note?: string;
  type: 'etape' | 'depeche' | 'note' | 'passage' | 'urgence' | 'situation' | 'annulation';
  /** Étape décochée ensuite : l'heure d'origine reste au journal, marquée annulée. */
  annule?: number;
}

export interface MissionLam {
  id: string;
  created: number;
  updated: number;
  type: TypeMissionLam;
  lieu: LieuLam;
  date: string;
  horaire: 'jour' | 'nuit';
  cch: string;
  rptx: string;
  /** N° de la consigne LAM ou indice de la fiche de travail. */
  consigne: string;
  /** AP LAM : engins (type, n° d'agrément) et leur nombre (3 au plus). */
  engins: string;
  nbLam: 1 | 2 | 3;
  /** AP LAM : mise en voie ou traversée d'un PN. */
  pn: boolean;
  /** AP S9 : repère du bouclage sur la situation géographique (« A3 »). */
  bouclage: string;
  outils: OutilS9[];
  faits: Record<string, number>;
  depeches: Depeche[];
  journal: EvenementLam[];
  /** Passages de train travaux (retrait momentané). */
  ttx: number;
  enCours: { debut: number; faits: Record<string, number> } | null;
  fin: number | null;
  /** Créée par « Nouvelle mission » et pas encore remplie. */
  brouillon?: boolean;
  /** Clôture de fin de mission : archivée et verrouillée. */
  cloture?: Cloture | null;
}

export interface EtapeLam {
  id: string;
  texte: string;
  aide?: string;
  /** L'étape se valide par une dépêche (carnet). */
  depeche?: boolean;
  facultative?: boolean;
}

export interface PhaseLam {
  id: 'avant' | 'verif' | 'mev' | 'mhv' | 'pose' | 'retrait';
  titre: string;
  lieu?: string;
  etapes: EtapeLam[];
}

const aujourdhui = () => jourDe(Date.now());

export function nouvelleMissionLam(init: Partial<MissionLam> = {}): MissionLam {
  const now = Date.now();
  const h = new Date(now).getHours();
  return {
    id: newId(),
    created: now,
    updated: now,
    type: 'lam',
    lieu: { ligne: null, ligneNom: null, pk: null, voie: '', lieu: '' },
    date: aujourdhui(),
    horaire: h >= 20 || h < 6 ? 'nuit' : 'jour',
    cch: '',
    rptx: '',
    consigne: '',
    engins: '',
    nbLam: 1,
    pn: false,
    bouclage: '',
    outils: ['dsh', 'sam'],
    faits: {},
    depeches: [],
    journal: [],
    ttx: 0,
    enCours: null,
    fin: null,
    ...init,
  };
}

const AGRES = '2 cales en bois dur, 1 boîte de six pétards (17 ans), 2 drapeaux rouges, 1 torche à flamme rouge (6 ans), 1 barre de court-circuit (1 an), 1 lanterne de bord à feu blanc et feu rouge.';

/** Les phases de la mission et leurs étapes, selon la mission (LAM ou S9), le PN et les outils de la fiche de travail. */
export function phasesLam(m: MissionLam): PhaseLam[] {
  if (m.type === 'lam') {
    return [
      {
        id: 'avant',
        titre: 'Avant',
        etapes: [
          { id: 'briefing', texte: 'Participer au briefing du chantier', aide: 'ZCh, voies contiguës, mise hors tension, points de mise en voie et hors voie, PN à franchir.' },
          {
            id: 'consigne',
            texte: 'Recevoir la consigne LAM du CCh',
            depeche: true,
            aide: 'Avec la situation géographique si la réglementation S9 l’impose. Le CCh t’informe des particularités de la partie chantier. Une seule consigne pour un groupe de LAM.',
          },
        ],
      },
      {
        id: 'verif',
        titre: 'Vérifications de l’engin',
        etapes: [
          { id: 'agrement', texte: `Vérifier l’agrément ${m.nbLam > 1 ? 'des LAM' : 'du LAM'} : numéro indiqué et date de validité`, aide: 'Agrément en défaut : utilisation interdite, aviser le CCh.' },
          { id: 'agres', texte: 'Se faire présenter les agrès et vérifier leur état', aide: `${AGRES} Agrès absents : utilisation interdite, aviser le CCh.` },
          {
            id: 'limiteurs',
            texte: 'Limiteurs en service et fiche quotidienne du conducteur',
            aide: 'Fiche du jour : organes de sécurité, essai du freinage, arrêt d’urgence (s’il existe), avertisseur sonore.',
          },
          { id: 'interdites', texte: 'Pas de bosse de triage ni de voie à freins de voie sur le parcours' },
        ],
      },
      {
        id: 'mev',
        titre: 'Mise en voie',
        etapes: [
          { id: 'mev-duree', texte: 'Mise en voie en moins de 5 minutes', aide: 'Sinon : appeler le CCh, lui donner la durée prévue et suivre ses instructions (mesures en plus vis-à-vis de la route).' },
          { id: 'mev-arf', texte: 'Consulter l’ARF : mise hors tension et zone de chantier en service', aide: 'Voie du LAM, voie(s) contiguë(s) et voies à traverser si nécessaire. L’ARF est présentée par le RCE.' },
          ...(m.pn
            ? [
                {
                  id: 'pn-route',
                  texte: 'Au PN : signalisation présentée, véhicules arrêtés, barrières relevées',
                  aide: 'CSR ou M/A pour présenter les feux, un agent avec K1 ou R24 en amont de l’engin, barrières relevées à la main ou à la manivelle. Selon l’agent PN dédié, la consigne LAM ou le CCh.',
                },
              ]
            : []),
          { id: 'mev-autorisation', texte: 'Lire sur la consigne LAM que la mise EN voie est accordée' },
          { id: 'renseigner', texte: 'Renseigner le conducteur', aide: 'Limites de la ZCh, balisage, arrêt au SAM, cales pour franchir les détecteurs d’annonce de PN.' },
          { id: 'mev', texte: 'Autoriser verbalement la mise en voie' },
          ...(m.pn
            ? [{ id: 'pn-ouvrir', texte: 'LAM dégagé du PN et de la zone courte : faire rouvrir le PN', aide: 'Avec le CSR ou le M/A. Jamais de fermeture par la zone courte avec un LAM.' }]
            : []),
        ],
      },
      {
        id: 'mhv',
        titre: 'Mise hors voie et fin',
        etapes: [
          { id: 'mhv-duree', texte: 'Mise hors voie en moins de 5 minutes', aide: 'Sinon : appeler le CCh, lui donner la durée prévue et suivre ses consignes.' },
          { id: 'mhv-arf', texte: 'Consulter l’ARF : mise hors tension et zone de chantier des voies contiguës', aide: 'Et des voies à traverser si nécessaire.' },
          { id: 'mhv-autorisation', texte: 'Recevoir du CCh l’autorisation de mise HORS voie', depeche: true },
          { id: 'mhv', texte: 'Autoriser le conducteur et lui indiquer le lieu de garage', aide: 'Lieu et conditions de garage.' },
          {
            id: 'stationnement',
            texte: 'Vérifier le stationnement',
            aide: 'À 0,70 m au moins de la ZD, sol stable, freiné et calé, pas sous un feeder ni en zone bleue, signalisation et visibilité des PN dégagées. Pollution laissée en voie : la signaler au CCh.',
          },
          { id: 'avis-mhv', texte: 'Aviser le CCh : LAM hors voie et stationné', depeche: true },
          { id: 'restituer', texte: 'Restituer la consigne LAM au CCh' },
        ],
      },
    ];
  }
  const o = new Set(m.outils);
  const nom = m.bouclage.trim() ? `le bouclage ${m.bouclage.trim()}` : 'le bouclage';
  return [
    {
      id: 'avant',
      titre: 'Avant',
      etapes: [
        { id: 'briefing', texte: 'Participer au briefing (obligatoire)', aide: 'Conditions du chantier, planches travaux, ZCh, circulation sur les contiguës, mise hors tension, annonce, moyens de communication. Au moindre doute, se le faire réexpliquer.' },
        { id: 'documents', texte: 'Recevoir la situation géographique et la fiche de travail', aide: 'Garde ta fiche sur toi. Tu fais tout ce qui y est écrit, et uniquement cela.' },
        ...(o.has('dsh') ? [{ id: 'epi', texte: 'EPI en place, avec les gants pour le DSh' }] : []),
      ],
    },
    {
      id: 'pose',
      titre: `Mise en place${m.bouclage.trim() ? ` · ${m.bouclage.trim()}` : ''}`,
      lieu: 'Sur ordre par dépêche',
      etapes: [
        { id: 'ordre-pose', texte: `Recevoir l’ordre de mettre en place ${nom}`, depeche: true, aide: 'Répète l’ordre en entier, note son numéro, donne le tien.' },
        ...(o.has('dsh')
          ? [
              {
                id: 'dsh-lieu',
                texte: 'Emplacement du DSh autorisé',
                aide: 'Pas dans les 30 m en aval d’un signal, ni en zone d’incertitude de shuntage, ni sur rail oxydé, ni sur LGV ; aucun effet sur un PN ou une TVP (schéma de ligne). Sur les rails en service seulement.',
              },
              { id: 'dsh-verif', texte: 'Vérifier le DSh : intégrité, date de validité, vis pointeau' },
              { id: 'dsh-pose', texte: 'Poser le DSh', aide: 'Brosser le patin, vis plus haute que les griffes, cé jusqu’à la butée, serrer jusqu’à la première application puis 3 tours, l’autre côté, puis les pinces.' },
            ]
          : []),
        ...(o.has('sam') ? [{ id: 'sam-pose', texte: 'Poser le SAM et le pétard', aide: 'À l’emplacement de la situation géographique. Pétard fixé avec les griffes de chaque côté du rail. Seulement les SAM de ta fiche.' }] : []),
        ...(o.has('cmb')
          ? [
              { id: 'cmb-ferme', texte: 'Fermer le commutateur de blocage à la clé de Berne (rouge)', aide: 'Autocontrôle d’abord : c’est le bon commutateur.' },
              { id: 'cmb-cadenas', texte: 'Poser le cadenas (garder la clé) et le fanion' },
            ]
          : []),
        ...(o.has('obs') ? [{ id: 'obs', texte: 'Observer ce que demande la fiche', aide: 'Signal, voyant (PN…) ou libération d’une voie ou d’une zone : absence de circulation.' }] : []),
        { id: 'autocontrole', texte: 'Autocontrôle de la pose' },
        { id: 'confirme-pose', texte: `Confirmer la mise en place de ${nom.replace(/^le /, '')}`, depeche: true },
      ],
    },
    {
      id: 'retrait',
      titre: 'Retrait et fin',
      lieu: 'Sur ordre par dépêche',
      etapes: [
        { id: 'ordre-retrait', texte: `Recevoir l’ordre de retirer ${nom}`, depeche: true },
        ...(o.has('dsh') ? [{ id: 'dsh-retrait', texte: 'Retirer le DSh' }] : []),
        ...(o.has('sam') ? [{ id: 'sam-retrait', texte: 'Retirer le SAM et le pétard', aide: 'Autocontrôle : aucun pétard oublié en voie.' }] : []),
        ...(o.has('cmb') ? [{ id: 'cmb-ouvre', texte: 'Rouvrir le commutateur de blocage (vert), retirer cadenas et fanion' }] : []),
        { id: 'autocontrole-retrait', texte: 'Autocontrôle : rien d’oublié en voie' },
        { id: 'confirme-retrait', texte: `Confirmer le retrait de ${nom.replace(/^le /, '')}`, depeche: true },
      ],
    },
  ];
}

/** Retrait momentané pour le passage d'un train travaux (AP S9), selon les outils posés. */
export function passageTtx(m: MissionLam): EtapeLam[] {
  const dsh = m.outils.includes('dsh');
  const sam = m.outils.includes('sam');
  return [
    { id: 'accord', texte: 'Recevoir l’accord du RPTx ou du CCh', depeche: true },
    ...(dsh ? [{ id: 'pinces', texte: 'Enlever les pinces du DSh' }] : []),
    ...(sam ? [{ id: 'petard', texte: 'Retirer le pétard' }, { id: 'sam', texte: 'Retirer le SAM' }] : []),
    { id: 'cr-retrait', texte: 'Rendre compte du retrait', depeche: true },
    { id: 'passe', texte: 'Le train travaux est passé' },
    ...(sam ? [{ id: 'sam-remis', texte: 'Remettre le SAM' }, { id: 'petard-remis', texte: 'Remettre le pétard' }] : []),
    ...(dsh ? [{ id: 'pinces-remises', texte: 'Remettre les pinces du DSh' }] : []),
    { id: 'cr-remise', texte: 'Rendre compte de la remise', depeche: true },
  ];
}

/** Le passage d'un TTx n'a de sens que si un DSh ou un SAM est posé. */
export const ttxPossible = (m: MissionLam) => m.type === 's9' && (m.outils.includes('dsh') || m.outils.includes('sam'));

export const toutesEtapesLam = (m: MissionLam) => phasesLam(m).flatMap((p) => p.etapes.map((e) => ({ ...e, phase: p })));

/** Phase « pendant » : après la mise en voie (LAM) ou la mise en place (S9), avant la fin. */
const phaseFin = (m: MissionLam) => (m.type === 'lam' ? 'mhv' : 'retrait');

export function avancementLam(m: MissionLam): { prochaine: (EtapeLam & { phase: PhaseLam }) | null; faites: number; total: number; pendant: boolean } {
  const all = toutesEtapesLam(m);
  const obligatoires = all.filter((e) => !e.facultative);
  const faites = obligatoires.filter((e) => m.faits[e.id]).length;
  const prochaine = all.find((e) => !m.faits[e.id] && !e.facultative) ?? null;
  const fin = phaseFin(m);
  const avantFin = all.filter((e) => e.phase.id !== fin && !e.facultative);
  const pendant = avantFin.every((e) => m.faits[e.id]) && !all.some((e) => e.phase.id === fin && m.faits[e.id]) && !m.fin;
  return { prochaine, faites, total: obligatoires.length, pendant };
}

export function titreMissionLam(m: MissionLam): string {
  const ou = m.lieu.ligne ? ` · ligne ${fmtLine(m.lieu.ligne)}` : m.lieu.lieu.trim() ? ` · ${m.lieu.lieu.trim()}` : '';
  if (m.type === 's9') return `AP S9${m.bouclage.trim() ? ` · ${m.bouclage.trim()}` : ''}${ou}`;
  return `AP LAM${ou}`;
}

/**
 * Numéro de dépêche proposé : deux chiffres pris au hasard, jamais déjà utilisé dans la mission, et sans suite avec
 * les numéros déjà échangés ni avec celui qu'on vient de recevoir (au moins 3 d'écart).
 */
/** Le numéro n'a pas de suite (écart de 3 au moins) avec ceux déjà échangés. */
export function numeroLibre(n: string | number, utilises: string[]): boolean {
  const v = typeof n === 'number' ? n : parseInt(n, 10);
  if (!Number.isFinite(v)) return true;
  return utilises.map((x) => parseInt(x, 10)).every((x) => !Number.isFinite(x) || Math.abs(x - v) > 2);
}

export function proposerNumero(utilises: string[], rand: () => number = Math.random): string {
  const ok = (n: number) => numeroLibre(n, utilises);
  for (let k = 0; k < 200; k++) {
    const n = 10 + Math.floor(rand() * 90);
    if (ok(n)) return String(n);
  }
  for (let n = 10; n < 100; n++) if (ok(n)) return String(n);
  return String(10 + Math.floor(rand() * 90));
}

/** Numéros déjà échangés dans la mission (reçus et donnés). */
export const numerosUtilises = (m: MissionLam) => m.depeches.flatMap((d) => [d.recu, d.donne]).filter(Boolean);

const ligneDepeche = (d: Depeche) => `${d.avec}${d.recu ? ` · reçu ${d.recu}` : ''}${d.donne ? ` · donné ${d.donne}` : ''}`;

/** Terminée quand toutes les étapes obligatoires sont faites (et seulement alors), à l'heure de la dernière faite. */
function avecFinLam(m: MissionLam): MissionLam {
  const obligatoires = toutesEtapesLam(m).filter((e) => !e.facultative);
  const toutes = obligatoires.length > 0 && obligatoires.every((e) => m.faits[e.id]);
  const fin = toutes ? (m.fin ?? Math.max(...obligatoires.map((e) => m.faits[e.id]))) : null;
  return fin === m.fin ? m : { ...m, fin };
}

/** Note une dépêche au carnet et au journal ; si elle valide une étape, l'étape est cochée à la même heure. */
export function noterDepeche(m: MissionLam, d: Omit<Depeche, 'id' | 't'>, etape?: EtapeLam): MissionLam {
  const t = Date.now();
  const dep: Depeche = { ...d, id: newId(), t, etape: etape?.id };
  const ev: EvenementLam = { id: newId(), t, texte: d.objet, etape: etape?.id, note: ligneDepeche(dep), type: 'depeche' };
  const next: MissionLam = { ...m, depeches: [...m.depeches, dep], journal: [...m.journal, ev] };
  return avecFinLam(etape ? { ...next, faits: { ...next.faits, [etape.id]: t } } : next);
}

/**
 * Coche ou décoche une étape. Décocher ne supprime rien : la ligne du journal et la dépêche qui la validait
 * restent, marquées annulées, et une ligne « Annulé » est ajoutée.
 */
export function cocherLam(m: MissionLam, e: EtapeLam, fait: boolean): MissionLam {
  const now = Date.now();
  const faits = { ...m.faits };
  let journal = m.journal;
  let depeches = m.depeches;
  if (fait) {
    faits[e.id] = now;
    journal = [...journal, { id: newId(), t: now, texte: e.texte, etape: e.id, type: 'etape' }];
  } else {
    const avant = m.faits[e.id];
    delete faits[e.id];
    const i = journal.map((x) => x.etape === e.id && (x.type === 'etape' || x.type === 'depeche') && !x.annule).lastIndexOf(true);
    journal = journal.map((x, k) => (k === i ? { ...x, annule: now } : x));
    depeches = depeches.map((d) => (d.etape === e.id && !d.annulee ? { ...d, annulee: now } : d));
    if (avant) journal = [...journal, { id: newId(), t: now, texte: `Annulé : ${e.texte}`, note: `faite à ${heureDans(avant, m.date)}`, type: 'annulation' }];
  }
  return avecFinLam({ ...m, faits, journal, depeches });
}

/** La dépêche encore valable qui a validé une étape. */
export const depecheDe = (m: MissionLam, etape: string) => m.depeches.find((d) => d.etape === etape && !d.annulee) ?? null;

/** Commence (ou reprend) un passage de train travaux. */
export function demarrerTtx(m: MissionLam): MissionLam {
  return m.enCours ? m : { ...m, enCours: { debut: Date.now(), faits: {} } };
}

export function cocherGesteTtx(m: MissionLam, id: string, fait: boolean): MissionLam {
  const ec = m.enCours ?? { debut: Date.now(), faits: {} as Record<string, number> };
  const faits = { ...ec.faits };
  if (fait) faits[id] = Date.now();
  else delete faits[id];
  return { ...m, enCours: { ...ec, faits } };
}

/** Dépêche notée pendant un passage de TTx : au carnet, et le geste coché. */
export function depecheTtx(m: MissionLam, d: Omit<Depeche, 'id' | 't'>, geste: string): MissionLam {
  const next = noterDepeche(m, d);
  return cocherGesteTtx(next, geste, true);
}

export function terminerTtx(m: MissionLam): { m: MissionLam; texte: string } {
  const now = Date.now();
  const debut = m.enCours?.debut ?? now;
  const texte = `Passage du train travaux n° ${m.ttx + 1} (de ${heure(debut)} à ${heure(now)})`;
  return { texte, m: { ...m, enCours: null, ttx: m.ttx + 1, journal: [...m.journal, { id: newId(), t: now, texte, type: 'passage' }] } };
}

/** Ajoute un fait au journal (note libre, situation rencontrée, urgence). */
export function ajouterEvenement(m: MissionLam, texte: string, type: EvenementLam['type'] = 'note', note?: string): MissionLam {
  return { ...m, journal: [...m.journal, { id: newId(), t: Date.now(), texte, type, note }] };
}

/** Journal à envoyer par message : la mission, le carnet de dépêches, puis tout ce qui s'est passé, dans l'ordre. */
export function journalTexteLam(m: MissionLam): string {
  const l: string[] = [`${titreMissionLam(m)}`];
  const ou = [m.lieu.ligne ? `Ligne ${fmtLine(m.lieu.ligne)}${m.lieu.ligneNom ? ` (${m.lieu.ligneNom})` : ''}` : '', m.lieu.pk != null ? `PK ${fmtPk(m.lieu.pk)}` : '', m.lieu.voie ? `voie ${m.lieu.voie}` : '', m.lieu.lieu].filter(Boolean);
  if (ou.length) l.push(ou.join(' · '));
  l.push(`${m.date.split('-').reverse().join('/')} · ${m.horaire === 'nuit' ? 'de nuit' : 'de jour'}`);
  if (m.type === 'lam' && m.engins.trim()) l.push(`Engins (${m.nbLam}) : ${m.engins.trim()}`);
  if (m.type === 's9') l.push(`Outils : ${m.outils.map((o) => OUTIL_S9[o]).join(', ')}`);
  if (m.consigne.trim()) l.push(`${m.type === 'lam' ? 'Consigne LAM' : 'Fiche de travail'} : ${m.consigne.trim()}`);
  if (m.cch.trim()) l.push(`CCh : ${m.cch.trim()}`);
  if (m.rptx.trim()) l.push(`RPTx : ${m.rptx.trim()}`);
  if (m.depeches.length) {
    l.push('', 'Dépêches');
    for (const d of [...m.depeches].sort((a, b) => a.t - b.t))
      l.push(`${heureDans(d.t, m.date)} · ${d.objet} · ${ligneDepeche(d)}${d.annulee ? ` [annulée à ${heureDans(d.annulee, m.date)}]` : ''}`);
  }
  l.push('', 'Journal');
  for (const e of [...m.journal].sort((a, b) => a.t - b.t))
    l.push(`${heureDans(e.t, m.date)} · ${e.texte}${e.note ? ` (${e.note})` : ''}${e.annule ? ` [annulée à ${heureDans(e.annule, m.date)}]` : ''}`);
  if (m.fin) l.push('', `Fin de mission à ${heureDans(m.fin, m.date)}`);
  return l.join('\n');
}

/* ---------- Stockage sur le téléphone ---------- */

const missions = creerCollection<MissionLam>('asp-missions-lam-v1', (m) => ({ ...nouvelleMissionLam(), ...m, lieu: { ...nouvelleMissionLam().lieu, ...m.lieu } }));
/** Enregistre la mission (fin recalculée) ; false si le téléphone a refusé, l'alerte est déjà partie. */
export const enregistrerMissionLam = (m: MissionLam) => missions.enregistrer(avecFinLam(m));
export const supprimerMissionLam = missions.supprimer;
export const missionLamParId = missions.parId;
/** Missions en cours ou à clôturer (les archivées sont dans « Mes archives »). */
export function useMissionsLam(): MissionLam[] {
  const l = missions.useListe();
  return useMemo(() => l.filter((m) => !m.cloture), [l]);
}
/** Toutes les missions, archivées comprises. */
export const useToutesMissionsLam = missions.useListe;

/** La mission à mettre en avant : celle du jour en cours, sinon la plus récente non terminée. */
export function missionLamDuJour(list: MissionLam[]): MissionLam | null {
  const ouvertes = list.filter((m) => !m.fin).sort((a, b) => b.updated - a.updated);
  return ouvertes[0] ?? null;
}

/* ---------- Contrôle de pose d'un DSh, d'après les données ouvertes ---------- */

export interface SignalProche {
  nom: string;
  pk: number;
  /** Distance le long de la ligne (m). */
  distance: number;
  devant: boolean;
}

/** Le signal (carré, sémaphore, manœuvre…) le plus proche d'un PK. */
export function signalProche(points: LinePoint[] | undefined, pk: number): SignalProche | null {
  let best: SignalProche | null = null;
  for (const p of points ?? []) {
    if (p[1] !== 'sig_carre' && p[1] !== 'sig_autre') continue;
    const distance = Math.round(Math.abs(p[0] - pk) * 1000);
    if (!best || distance < best.distance) best = { nom: p[2], pk: p[0], distance, devant: p[0] >= pk };
  }
  return best;
}

export type NiveauDsh = 'interdit' | 'verifier' | 'ok';
export interface ControleDsh {
  niveau: NiveauDsh;
  /** Ce que la position laisse voir, du plus grave au moins grave. */
  points: { niveau: NiveauDsh; titre: string; texte: string }[];
}

/** Seuil au-delà duquel un PN n'est plus signalé (zone d'annonce, à vérifier au schéma de ligne). */
const PN_ZONE = 3000;

/**
 * Indications de la position sur la pose d'un DSh : LGV (interdit), signal à moins de 30 m (le sens n'est pas connu :
 * à vérifier), PN à moins de 3 km (zone d'annonce possible). Le schéma de ligne et la situation géographique priment.
 */
export function controleDsh(c: { lgv: boolean; signal: SignalProche | null; pn: { nom: string; distance: number } | null }): ControleDsh {
  const points: ControleDsh['points'] = [];
  if (c.lgv) points.push({ niveau: 'interdit', titre: 'Ligne à grande vitesse', texte: 'La pose d’un DSh est interdite sur LGV.' });
  if (c.signal && c.signal.distance <= 30)
    points.push({ niveau: 'verifier', titre: `${c.signal.nom} à ${c.signal.distance} m`, texte: 'DSh interdit dans les 30 m en aval d’un signal : vérifie le sens de la voie.' });
  if (c.pn && c.pn.distance <= PN_ZONE)
    points.push({
      niveau: 'verifier',
      titre: `${c.pn.nom} à ${c.pn.distance < 1000 ? `${c.pn.distance} m` : `${(c.pn.distance / 1000).toFixed(1).replace('.', ',')} km`}`,
      texte: 'Zone d’annonce du PN possible : regarde au schéma de ligne si l’annonce est par CdV seuls (DSh interdit) ou pédales + CdV.',
    });
  const niveau: NiveauDsh = points.some((p) => p.niveau === 'interdit') ? 'interdit' : points.length ? 'verifier' : 'ok';
  return { niveau, points };
}
