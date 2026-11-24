/**
 * Les 7 exercices du support (« Terrain et CADA »), avec leur correction. Les valeurs attendues sont calculées par
 * le même moteur que les chantiers (rules.ts), et vérifiées par les tests.
 */
import { cleSens, nouveauChantier, nouvelleVoie, type Chantier } from './chantier';
import { AUCUNE_PARTICULARITE, type Particularites, type Voie } from './rules';

export interface Cas {
  id: string;
  titre: string;
  /** Données de l'énoncé. */
  enonce: string[];
  /** Ce qu'il faut répondre sur le délai de dégagement donné. */
  ddCorrect: boolean;
  /** Le chantier tel que l'ASP doit l'organiser (base de la correction et des réponses attendues). */
  chantier: () => Chantier;
  correction: string[];
}

const LIGNE = { ligne: '830000', ligneNom: 'Ligne de Paris-Lyon à Marseille-St-Charles' };
const v = (nom: string, sens: Voie['sens'], vitesse: number, role: Voie['role'], interdite = false): Voie => ({ ...nouvelleVoie(nom, sens, role, vitesse), interdite });
const p = (x: Partial<Particularites>): Particularites => ({ ...AUCUNE_PARTICULARITE, ...x });

export const CAS: Cas[] = [
  {
    id: 'ex1',
    titre: 'Exercice 1 · V1 circulée, portatif',
    enonce: [
      'Ligne Paris – Lyon, double voie. V1 = 160 km/h, V2 = 170 km/h.',
      'Chantier du PK 4+200 au PK 4+250 sur V1.',
      'Effectif travaux : 6. Effectif annonce : 1 + 2. Délai de dégagement : 5 s.',
      'Outillage portatif.',
    ],
    ddCorrect: true,
    chantier: () =>
      nouveauChantier({
        ...LIGNE,
        nom: 'Cas pratique 1',
        pkDebut: 4.2,
        pkFin: 4.25,
        effectif: 6,
        outillage: 'cat1',
        dd: 5,
        voies: [v('V1', 'croissant', 160, 'travail'), v('V2', 'decroissant', 170, 'contigue')],
      }),
    correction: [
      'Plateforme : V1, voie de travail circulée (trains vers les PK croissants, ils arrivent du PK 4) ; V2 contiguë (trains vers les PK décroissants, ils arrivent du PK 5).',
      'Pas d’interdiction obligatoire : outillage portatif. V2 dépasse 160 km/h : délai d’annonce d’au moins 10 s et outillage portatif seulement, c’est le cas.',
      'DD de 5 s : correct (minimum quand il n’est pas nul). MS de 5 s : voie circulée, 1re catégorie, un annonceur par sens.',
      'DA = 5 + 5 = 10 s. V1 : 450 m, point d’annonce au PK 3+750. V2 : 480 m (472 m exacts), point d’annonce au PK 4+730.',
      'Dispositif 1 + 2 : un annonceur côté Paris pour V1, un côté province pour V2, hors ZD côté garage, visibles de l’ASP.',
    ],
  },
  {
    id: 'ex2',
    titre: 'Exercice 2 · 2e catégorie sur V2 à 170 km/h',
    enonce: [
      'Ligne Paris – Lyon, régime banalisé. V1 = 160 km/h, V2 = 170 km/h.',
      'Chantier du PK 4+200 au PK 4+250 sur V2. Garage interdit sur la piste côté V2 du PK 4+050 au PK 4+400.',
      'Effectif travaux : 6. Effectif annonce : 1 + 2. Délai de dégagement : 5 s.',
      'Outillage facilement déraillable (2e catégorie).',
    ],
    ddCorrect: true,
    chantier: () =>
      nouveauChantier({
        ...LIGNE,
        nom: 'Cas pratique 2',
        pkDebut: 4.2,
        pkFin: 4.25,
        effectif: 6,
        outillage: 'cat2',
        dd: 5,
        p: p({ banaliseVutTct: true, garageDifficile: true }),
        voies: [v('V1', 'deux', 160, 'contigue'), v('V2', 'deux', 170, 'travail', true)],
      }),
    correction: [
      'Le piège : 2e catégorie + voies banalisées + V2 à plus de 160 km/h + garage non contigu (interdit côté V2). Chacun de ces cas rend l’interdiction de circulation obligatoire sur V2 : impossible sous annonce seule.',
      'V2 est donc interdite (avis de voie interdite, cases S9) et sort du dispositif. On annonce V1, banalisée : 2 sens.',
      'DD de 5 s : correct (15 s au plus en 2e catégorie). MS de 5 s : voie interdite, un annonceur par sens.',
      'DA = 10 s, V1 à 160 km/h : 450 m. Point d’annonce sens PK croissants au PK 3+750, sens PK décroissants au PK 4+700.',
      'Les agents se garent sur l’emprise de V2 interdite, hors ZD de V1, sans traverser V1.',
    ],
  },
  {
    id: 'ex3',
    titre: 'Exercice 3 · topographie sur 4 voies',
    enonce: [
      'Ligne Paris – Lyon, double voie, voies bis à l’extérieur. V1 = V2 = 140 km/h, V1bis = V2bis = 120 km/h.',
      'Chantier mobile de topographie du PK 12+000 au PK 14+500 sur la plateforme ; longueur sous annonce : 50 m.',
      'Effectif travaux : 2. Effectif annonce : 1 + 4. Délai de dégagement : 5 s.',
      'Outillage portatif. Question bonus : comment réduire la distance d’annonce ?',
    ],
    ddCorrect: true,
    chantier: () =>
      nouveauChantier({
        ...LIGNE,
        nom: 'Cas pratique 3',
        type: 'mobile',
        pkDebut: 12,
        pkFin: 14.5,
        longueurAnnonce: 50,
        pkEquipe: 12,
        effectif: 2,
        outillage: 'cat1',
        dd: 5,
        p: p({ voiesInterieures: true }),
        voies: [v('V1bis', 'croissant', 120, 'travail'), v('V1', 'croissant', 140, 'travail'), v('V2', 'decroissant', 140, 'travail'), v('V2bis', 'decroissant', 120, 'travail')],
      }),
    correction: [
      'Plateforme de 4 voies : V1bis | V1 | V2 | V2bis. Les agents vont sur les voies intérieures (V1, V2), séparées du garage par une ou plusieurs voies.',
      'DD de 5 s : acceptable, mais à tester (traverser des voies pour se garer est un facteur défavorable). MS de 15 s : cas des voies intérieures d’une plateforme de plus de 2 voies.',
      'DA = 5 + 15 = 20 s. V1 et V2 (140 km/h) : 780 m. V1bis et V2bis (120 km/h) : 670 m.',
      'Au départ (zone sous annonce du PK 12+000 au 12+050) : V1 au PK 11+220, V1bis au PK 11+330, V2 au PK 12+830, V2bis au PK 12+720. Les points avancent avec l’équipe.',
      'Chantier mobile : les annonceurs suivent l’équipe sans interrompre l’annonce ; l’ASP ne peut pas être annonceur.',
      'Pour réduire la distance : interdire V1 et V2 ou travailler par l’extérieur (MS 5 s : 390 m et 340 m), limiter la vitesse avec un commutateur de vitesse, ou un garage intermédiaire si l’entrevoie est large.',
    ],
  },
  {
    id: 'ex4',
    titre: 'Exercice 4 · V1 interdite, 2e catégorie',
    enonce: [
      'Ligne Paris – Lyon, double voie. V1 = 170 km/h, V2 = 140 km/h.',
      'Chantier du PK 12+300 au PK 12+350 sur V1 interdite à la circulation.',
      'Effectif travaux : 6. Effectif annonce : 1 + 1. Délai de dégagement : 5 s.',
      'Outillage facilement déraillable (2e catégorie).',
    ],
    ddCorrect: true,
    chantier: () =>
      nouveauChantier({
        ...LIGNE,
        nom: 'Cas pratique 4',
        pkDebut: 12.3,
        pkFin: 12.35,
        effectif: 6,
        outillage: 'cat2',
        dd: 5,
        voies: [v('V1', 'croissant', 170, 'travail', true), v('V2', 'decroissant', 140, 'contigue')],
      }),
    correction: [
      'Les 170 km/h de V1 ne comptent pas : la voie est interdite. La 2e catégorie est permise sur voie interdite.',
      'On n’annonce que V2, contiguë, dans un seul sens (trains qui arrivent du PK 13) : un annonceur suffit.',
      'DD de 5 s : correct. MS de 5 s : voie interdite, sans clôture, sans cas particulier.',
      'DA = 10 s, V2 à 140 km/h : 390 m, point d’annonce au PK 12+740.',
      'Garage côté V1 (piste ou emprise de la voie interdite, hors ZD de V2). À l’annonce : engins au ralenti, EMIC immobilisés.',
    ],
  },
  {
    id: 'ex5',
    titre: 'Exercice 5 · un annonceur pour deux sens',
    enonce: [
      'Ligne Paris – Lyon, double voie. V1 = V2 = 140 km/h.',
      'Chantier du PK 12+300 au PK 12+350 sur V1.',
      'Effectif travaux : 6. Effectif annonce : 1 + 1. Délai de dégagement : 5 s.',
      'Outillage portatif.',
    ],
    ddCorrect: true,
    chantier: () =>
      nouveauChantier({
        ...LIGNE,
        nom: 'Cas pratique 5',
        pkDebut: 12.3,
        pkFin: 12.35,
        effectif: 6,
        outillage: 'cat1',
        dd: 5,
        p: p({ annonceur2Sens: true }),
        voies: [v('V1', 'croissant', 140, 'travail'), v('V2', 'decroissant', 140, 'contigue')],
      }),
    correction: [
      'Deux sens à surveiller (V1 et V2) avec un seul annonceur : il surveille les 2 sens.',
      'DD de 5 s : correct. MS de 15 s : un seul annonceur pour les 2 sens, sur voie circulée.',
      'DA = 20 s, 140 km/h : 780 m. Points d’annonce : V1 au PK 11+520, V2 au PK 13+130.',
      'L’annonceur se place au droit du chantier, hors ZD, et doit voir les deux points d’annonce (780 m de chaque côté : ligne bien dégagée). Sinon, un 2e annonceur : MS de 5 s, 390 m (PK 11+910 et 12+740).',
    ],
  },
  {
    id: 'ex6',
    titre: 'Exercice 6 · clôture limitative dans l’entrevoie',
    enonce: [
      'Ligne Paris – Lyon. V1 = 170 km/h, V2 = 140 km/h.',
      'Chantier de maintenance du PK 12+300 au PK 12+350 sur V1 interdite, avec une clôture limitative dans l’entrevoie.',
      'Effectif travaux : 3. Effectif annonce : 1 + 1. Délai de dégagement : 5 s.',
      'Outillage facilement déraillable (2e catégorie).',
    ],
    ddCorrect: false,
    chantier: () =>
      nouveauChantier({
        ...LIGNE,
        nom: 'Cas pratique 6',
        pkDebut: 12.3,
        pkFin: 12.35,
        effectif: 3,
        outillage: 'cat2',
        dd: 0,
        p: p({ clotureLimitative: true }),
        voies: [v('V1', 'croissant', 170, 'travail', true), v('V2', 'decroissant', 140, 'contigue')],
      }),
    correction: [
      'Même plateforme que l’exercice 4, avec une barrière d’entrevoie limitative.',
      'Le DD de 5 s n’est pas le bon : avec une barrière limitative, le délai de dégagement est nul (sauf soudage ou meulage : 5 s).',
      'MS de 5 s (clôture limitative). DA = 0 + 5 = 5 s, V2 à 140 km/h : 200 m, point d’annonce au PK 12+550. Avec le DD de 5 s gardé : 390 m (PK 12+740).',
      'Si l’analyse de risques montre qu’on ne peut pas engager la ZD, la clôture limitative dispense même de l’annonce (3e cas).',
      'Avec 3 agents groupés sur un chantier fixe, l’ASP pourrait tenir lui-même la fonction d’annonceur, s’il est autorisé nominativement et dégagé de tout autre travail.',
    ],
  },
  {
    id: 'ex7',
    titre: 'Exercice 7 · hors ZD, l’ASP seul annonce',
    enonce: [
      'Ligne Paris – Lyon. V1 = V2 = 140 km/h.',
      'Chantier du PK 55+300 au PK 55+330, hors ZD (1,50 m du rail), derrière une clôture limitative, le long de V1.',
      'Effectif travaux : 2. Effectif annonce : 1 (l’ASP). Délai de dégagement : 5 s.',
      'Outillage portatif.',
    ],
    ddCorrect: false,
    chantier: () => {
      const v1 = v('V1', 'croissant', 140, 'contigue');
      const c = nouveauChantier({
        ...LIGNE,
        nom: 'Cas pratique 7',
        pkDebut: 55.3,
        pkFin: 55.33,
        effectif: 2,
        outillage: 'cat1',
        dd: 0,
        p: p({ clotureLimitative: true, aspAnnonceLuiMeme: true }),
        voies: [v1, v('V2', 'decroissant', 140, 'hors')],
      });
      // L'ASP surveille lui-même V1.
      return { ...c, agents: c.agents.map((a) => (a.role === 'asp' ? { ...a, surveille: [cleSens(v1.id, 'croissant')] } : a)) };
    },
    correction: [
      'Travail hors ZD, à proximité de la ZD de V1 (1,50 m : la ligne est à 160 km/h au plus), avec une clôture limitative.',
      'DD : nul (ZD engagée seulement par inadvertance, clôture limitative) ; les 5 s donnés sont trop prudents.',
      'MS de 5 s : proximité de la ZD avec clôture limitative, même si l’ASP annonce lui-même.',
      'DA = 5 s, 140 km/h : 200 m, point d’annonce de V1 au PK 55+100.',
      'L’ASP annonce lui-même : de jour, hors zone bruyante, trompe ceinture et essai d’audibilité. Avec une analyse sans risque d’engager la ZD, l’annonce n’est même plus obligatoire.',
    ],
  },
];
