/** Libellés des particularités du chantier, rangés comme dans l'écran « Annonce ». */
import type { Outillage, Particularites, RoleVoie } from './rules';

export interface ParticulariteDef {
  key: keyof Particularites;
  label: string;
  hint?: string;
  group: 'marge' | 'conditions' | 'bruit' | 'exemption' | 'seul';
}

export const PARTICULARITES: ParticulariteDef[] = [
  { key: 'soudageMeulage', label: 'Soudage à l’arc, meulage de rail ou perceuse type bicyclette', hint: 'Marge de 15 s sur voie circulée ; DD d’au moins 5 s.', group: 'marge' },
  { key: 'obstacleMasquant', label: 'Un obstacle peut masquer l’approche d’une circulation courte', group: 'marge' },
  { key: 'annonceur2Sens', label: 'Un annonceur surveille les 2 sens', group: 'marge' },
  { key: 'aspAnnonceLuiMeme', label: 'L’ASP surveille lui-même l’approche des circulations', hint: 'Seulement de jour, hors zone bruyante, tunnel, voie banalisée…', group: 'marge' },
  { key: 'voiesInterieures', label: 'Agents sur les voies intérieures d’une plateforme de plus de 2 voies', hint: 'Séparés du garage par une ou plusieurs voies.', group: 'marge' },
  { key: 'clotureLimitative', label: 'Clôture (barrière d’entrevoie) à caractère limitatif', hint: 'Le DD peut être nul ; marge de 5 s hors voie circulée.', group: 'marge' },
  { key: 'banaliseVutTct', label: 'Voie banalisée, VUT organisée ou TCT', group: 'conditions' },
  { key: 'icsSansDpcs', label: 'IPCS sans DPCS obtenue', group: 'conditions' },
  { key: 'garageDifficile', label: 'Garage difficile', hint: 'Tunnel, viaduc ou pont-rail sans accotement, quai haut ou mi-haut, garage non contigu à la voie de travail.', group: 'conditions' },
  { key: 'tunnel', label: 'Travail en tunnel', group: 'conditions' },
  { key: 'lgv', label: 'Ligne à grande vitesse (LGV)', group: 'conditions' },
  { key: 'visibiliteInsuffisante', label: 'Distance de visibilité minimale non obtenue', hint: 'L’interdiction de circulation devient obligatoire.', group: 'conditions' },
  { key: 'dfvPrevue', label: 'Interdiction prévue à la préparation ou par consigne locale', group: 'conditions' },
  { key: 'zoneBruyante', label: 'Zone bruyante', hint: 'Routes très fréquentées, usines, aérodromes, cours d’eau… (consigne d’établissement).', group: 'bruit' },
  { key: 'chantierBruyant', label: 'Chantier bruyant', hint: 'Outillage ou engins : 80 dB(A) par jour ou plus, ou crête de 135 dB(A) ou plus.', group: 'bruit' },
  { key: 'engagementInadvertance', label: 'La ZD n’est engagée que par inadvertance', hint: 'Le DD peut être nul (sauf soudage ou meulage).', group: 'exemption' },
  { key: 'enginParois', label: 'Travail à bord d’un engin à parois ou écrans (confinement)', group: 'exemption' },
  { key: 'clotureDefensive', label: 'Clôture à caractère défensif (confinement)', group: 'exemption' },
  { key: 'analyseSansRisque', label: 'L’analyse des risques montre qu’on ne peut pas engager la ZD', hint: 'Dispense de l’annonce seulement avec une clôture limitative.', group: 'exemption' },
  { key: 'agentSeul', label: 'Agent seul', hint: 'Il surveille lui-même : marge de 15 s sur voie circulée, 10 s sur voie interdite. Interdit sur LGV.', group: 'seul' },
];

export const GROUPES: { id: ParticulariteDef['group']; title: string }[] = [
  { id: 'marge', title: 'Ce qui change la marge de sécurité' },
  { id: 'conditions', title: 'Conditions de la ligne' },
  { id: 'bruit', title: 'Bruit' },
  { id: 'exemption', title: 'Confinement et engagement de la ZD' },
  { id: 'seul', title: 'Agent seul' },
];

export const OUTILLAGES: { id: Outillage; label: string; court: string; hint: string }[] = [
  { id: 'aucun', label: 'Sans outillage', court: 'Aucun', hint: 'Pas d’outil à dégager.' },
  { id: 'cat1', label: '1re catégorie : portatif', court: '1re', hint: '35 kg au plus, non solidaire de la voie, mis hors ZD par un seul agent (perceuse, bac à gravillons, moules de soudage…).' },
  { id: 'cat2', label: '2e catégorie : facilement déraillable', court: '2e', hint: '100 kg au plus, non solidaire, mis hors ZD en une fois par 2 agents (échelles et ECPL de 4 m au plus). 4 outils au plus jusqu’à 120 km/h, 2 au-delà.' },
  { id: 'cat3', label: '3e catégorie : fait obstacle', court: '3e', hint: 'Plus de 100 kg, solidaire de la voie, ou plus de 2 agents (crics à manivelle, échelles de plus de 4 m, EMIC). Interdiction de circulation obligatoire.' },
];

export const ROLES_VOIE: [RoleVoie, string][] = [
  ['travail', 'Voie de travail'],
  ['contigue', 'Contiguë'],
  ['traversee', 'À traverser'],
  ['hors', 'Hors annonce'],
];
