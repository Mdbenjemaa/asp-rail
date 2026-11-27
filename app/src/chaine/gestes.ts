/**
 * Fiche réflexe des agents de la chaîne d'annonce, reprise des règles du mémo de l'appli (« Principes de
 * l'annonce », « Placer le dispositif », « Bruit et EPICB », « Annonce en complément », « Signalisation »).
 * Les consignes de l'ASP, la fiche CADA et les consignes locales priment.
 */
import type { RoleChaine } from './poste';

export interface BlocGestes {
  titre: string;
  points: string[];
  /** Rappel mis en avant (bandeau). */
  important?: boolean;
}

/** Pour tous les agents de la chaîne. */
export const GESTES_COMMUNS: BlocGestes[] = [
  {
    titre: 'Avant de prendre mon poste',
    points: [
      'L’ASP me donne mon poste, ce que j’annonce (voies et sens) et les consignes utiles : environnement, dangers, vitesse, sens de circulation.',
      'Je fais l’essai du dispositif avec l’ASP : je dois percevoir le signal (son, vue) et être perçu.',
      'Je ne change pas de place sans l’accord de l’ASP : il ne modifie pas le dispositif sans aviser les agents.',
    ],
  },
  {
    titre: 'Ce que j’annonce',
    points: [
      'Toute circulation, de tout sens, sur la voie de travail, sur les voies contiguës et sur les voies que les agents franchissent pour rejoindre le garage.',
      'Aussi toute circulation qui peut gêner la visibilité sur une voie annoncée.',
      'Une circulation dont je ne peux pas dire tout de suite et sûrement sur quelle voie elle arrive : je l’annonce.',
      'Le signal d’annonce peut être sonore, lumineux, ou les deux, comme l’a fixé l’ASP.',
    ],
  },
  {
    titre: 'Si je ne peux plus assurer mon poste',
    important: true,
    points: [
      'Je ne vois plus jusqu’à mon point d’annonce (brouillard, pluie, obstacle) ou je n’entends plus le signal : je préviens l’ASP tout de suite.',
      'Un annonceur ou une sentinelle défaillant : l’ASP fait dégager la zone dangereuse.',
      'Si l’ASP est défaillant, les agents se rassemblent hors ZD et préviennent leur hiérarchie.',
    ],
  },
  {
    titre: 'Arrêt d’urgence',
    points: [
      'Signal d’arrêt à main pour commander l’arrêt immédiat en urgence ; à défaut : un objet ou une lumière vivement agités, ou les deux bras levés.',
      'Pétards : la détonation commande l’arrêt d’urgence.',
    ],
  },
];

/** Propre à chaque rôle. */
export const GESTES_ROLE: Record<RoleChaine, BlocGestes[]> = {
  annonceur: [
    {
      titre: 'Mon poste d’annonceur',
      points: [
        'Hors zone dangereuse, de préférence côté garage, visible de l’ASP.',
        'Je vois arriver les trains jusqu’au point d’annonce de chaque voie et sens que je surveille : c’est la distance de visibilité calculée par l’ASP.',
        'Le signal d’annonce doit être perçu par les agents (essai d’audibilité refait si le chantier ou l’environnement change : vent, bruit).',
      ],
    },
    {
      titre: 'Chantier ou outillage bruyant',
      points: [
        'Chantier bruyant : le coup de trompe est appuyé d’un drapeau blanc déployé non agité de jour, ou d’un bâton lumineux la nuit.',
        'Outillage bruyant : annonce avec un avertisseur à grande puissance (type Gérard ou Saint-Dizier), à moins de 5 m des agents et orienté vers eux ; tout autre avertisseur est interdit.',
      ],
    },
  ],
  repetiteur: [
    {
      titre: 'Mon poste de répétiteur',
      points: [
        'Dans une chaîne d’annonceurs, je répercute l’annonce que je reçois, au droit du chantier (chantiers étendus ou bruyants).',
        'Je perçois à tout moment le signal de l’annonceur précédent.',
        'Si je perds le son ou la vue du signal de l’annonceur précédent : j’émets le signal d’annonce, je préviens l’ASP et je maintiens l’annonce jusqu’à ce que l’ASP m’ait replacé et m’informe de la reprise.',
      ],
    },
    {
      titre: 'Chantier bruyant',
      points: ['Le coup de trompe est appuyé d’un drapeau blanc déployé non agité de jour, ou d’un bâton lumineux la nuit.'],
    },
  ],
  sentinelle: [
    {
      titre: 'Mon poste de sentinelle',
      points: [
        'L’ASP me place pour que deux sentinelles qui se suivent, et la plus proche du chantier avec l’annonceur, s’aperçoivent et perçoivent le signal à tout moment.',
        'Comme l’annonceur, je déclenche l’annonce : je dois voir arriver les trains jusqu’au point d’annonce de ce que je surveille (distance de visibilité calculée par l’ASP).',
        'Si je ne vois plus la sentinelle ou l’annonceur voisin, ou si je ne perçois plus son signal : je préviens l’ASP tout de suite.',
      ],
    },
    {
      titre: 'Chantier bruyant',
      points: ['Le coup de trompe est appuyé d’un drapeau blanc déployé non agité de jour, ou d’un bâton lumineux la nuit.'],
    },
  ],
};
