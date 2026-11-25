/** Cas pratiques de l'agent PN : remettre dans l'ordre les gestes d'une procédure du support TES F. */

export interface ExerciceOrdre {
  id: string;
  titre: string;
  contexte: string;
  /** Étapes dans le bon ordre. */
  etapes: string[];
  explication: string;
}

export const EXERCICES_ORDRE: ExerciceOrdre[] = [
  {
    id: 'prise-bal',
    titre: 'Prise en travaux d’un PN à boîtier sur ligne BAL',
    contexte: 'Tu as reçu l’ordre de début d’intervention. Applique la fiche de travail.',
    etapes: [
      'Blocage sur FERMETURE (rouge), clé de Berne',
      'DSh en voie si nécessaire, vérifier les voyants',
      'SAM de part et d’autre du PN',
      'CSR sur FERMETURE',
      'FntA de la voie sur HORS SERVICE',
      'Vérifier les voyants d’annonce',
      'CSR sur OUVERTURE',
      'Photo du BCM fermé et cadenassé',
      'Rendre compte au CCh et/ou RPTx',
    ],
    explication: 'Le blocage d’abord (sinon la mise hors service n’est pas effective), le CSR sur FERMETURE avant d’ouvrir le boîtier, et la photo une fois le BCM verrouillé.',
  },
  {
    id: 'mobile',
    titre: 'Passage d’un mobile travaux',
    contexte: 'Tu es agent PN en travaux, PN à boîtier avec DSh. Un mobile travaux arrive.',
    etapes: [
      'Rendre compte au CCh et/ou RPTx',
      'Regarder si c’est prévu dans la consigne PN',
      'Vérifier la position du mobile sur la situation géographique',
      'Si rien ne s’y oppose : CSR sur FERMETURE',
      'Déposer la partie haute du DSh',
      'Retirer le SAM le plus éloigné du mobile',
      'Retirer le SAM près du mobile',
      'Autoriser la traversée du PN',
      'Repositionner les SAM, le plus proche du mobile d’abord',
      'Reposer la partie haute du DSh',
      'CSR sur OUVERTURE',
      'Fermer le BCM (patte de verrouillage)',
    ],
    explication: 'On retire d’abord le SAM le plus éloigné, et on repositionne d’abord le plus proche du mobile.',
  },
  {
    id: 'lam',
    titre: 'Mise en voie d’un LAM',
    contexte: 'Un LAM doit être mis en voie au PN.',
    etapes: [
      'Vérifier que c’est prévu à la fiche de travail',
      'Si rien ne s’y oppose : CSR sur FERMETURE',
      'Se placer avec un SAM en amont du lieu de stationnement du LAM',
      'Relever la barrière à la main',
      'Retirer le SAM, en accord avec l’agent LAM',
      'Repositionner le SAM',
      'CSR sur OUVERTURE',
      'Fermer le BCM (patte de verrouillage)',
    ],
    explication: 'Le SAM arrête les usagers de la route pendant que la barrière est relevée à la main ; il n’est retiré qu’en accord avec l’agent LAM.',
  },
  {
    id: 'fin',
    titre: 'Fin de mission de l’agent PN en travaux',
    contexte: 'Les travaux sont terminés.',
    etapes: [
      'Recevoir la dépêche de fin d’intervention',
      'Passer la dépêche de fin d’intervention',
      'Photo du BCM fermé et cadenassé',
      'Compléter le carnet du PN (fin d’intervention)',
      'Compléter le cadre C de l’ARF et le rendre',
    ],
    explication: 'Le cadre C de l’ARF, rendu au RSO ou au RSNCF, clôt la mission.',
  },
  {
    id: 'cycle-sal4',
    titre: 'Cycle de fonctionnement d’un PN à SAL 4',
    contexte: 'Un train est annoncé à un PN à SAL 4 ouvert.',
    etapes: [
      'Feux clignotants et sonneries',
      'Temps de préavis',
      'Abaissement des demi-barrières d’entrée',
      'Arrêt des sonneries, abaissement des demi-barrières de sortie',
      'Passage du train',
      'Extinction des feux, remontée des 4 demi-barrières',
    ],
    explication: 'Au SAL 4, la sortie ne descend qu’une fois l’entrée basse.',
  },
  {
    id: 'main-moteur',
    titre: 'Relever une barrière avec la manette à boule',
    contexte: 'Le PN est fermé et ne se commande plus au CSR.',
    etapes: [
      'CSR sur FERMETURE',
      'Décadenasser le levier et le mettre sur MAIN',
      'Manette à boule sur OUVERTURE',
      'Manivelle à fond, tourner dans le sens des aiguilles d’une montre',
      'Retirer la manivelle',
      'Pour finir : manette sur FERMETURE',
      'Après fermeture complète : levier cadenassé sur MOTEUR',
    ],
    explication: 'Jamais de retour sur OUVERTURE avant la fermeture complète de la demi-barrière.',
  },
];
