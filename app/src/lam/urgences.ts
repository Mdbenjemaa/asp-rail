/** Fiches réflexes AP LAM / AP S9 : mesures d'urgence et gestion des aléas du livret technique. */

export interface FicheUrgence {
  id: string;
  titre: string;
  /** Urgence (protéger tout de suite) ou aléa (aviser et attendre les consignes). */
  genre: 'urgence' | 'alea';
  pour: 'lam' | 's9' | 'tous';
  etapes: string[];
  note?: string;
}

const S2B = 'Mesures S2B de protection des obstacles inopinés';

export const URGENCES: FicheUrgence[] = [
  {
    id: 'danger',
    titre: 'Conducteur défaillant ou danger grave et imminent',
    genre: 'urgence',
    pour: 'lam',
    etapes: [
      'Appuyer sur le bouton d’arrêt d’urgence du LAM si c’est possible',
      `Gabarit engagé ou risque de l’engager : ${S2B.toLowerCase()}, ou maintenir la zone de chantier de cette voie s’il y en a une`,
      'Appeler le CCh pour l’informer et obtenir ses consignes',
    ],
  },
  {
    id: 'sam',
    titre: 'Le LAM a franchi un SAM',
    genre: 'urgence',
    pour: 'lam',
    etapes: ['Arrêter et immobiliser d’urgence le mouvement', S2B, 'Appeler le CCh pour l’informer et obtenir ses consignes'],
  },
  {
    id: 'gabarit',
    titre: 'Gabarit d’une voie engagé',
    genre: 'urgence',
    pour: 'lam',
    etapes: [S2B, 'Appeler le CCh pour l’informer et obtenir ses consignes'],
  },
  {
    id: 'point-protege',
    titre: 'Point protégé engagé',
    genre: 'urgence',
    pour: 'lam',
    etapes: [S2B, 'Appeler le CCh pour l’informer et obtenir ses consignes'],
  },
  {
    id: 'derive',
    titre: 'Le LAM part en dérive',
    genre: 'urgence',
    pour: 'lam',
    etapes: [S2B, 'Prévenir d’urgence tout le personnel qui peut travailler dans la zone vers laquelle le lorry dérive', 'Appeler le CCh pour l’informer et obtenir ses consignes'],
  },
  {
    id: 'vitesse',
    titre: 'Vitesse excessive, mode chantier non respecté',
    genre: 'urgence',
    pour: 'lam',
    etapes: ['Faire arrêter d’urgence le LAM par le conducteur', 'Appeler le CCh pour l’informer et obtenir ses consignes'],
    note: 'Mode chantier : 30 km/h au plus, vitesse adaptée à la voie aperçue, klaxon à chaque démarrage.',
  },
  {
    id: 'electrique',
    titre: 'Conducteur électrique tombé ou affaissé',
    genre: 'urgence',
    pour: 'tous',
    etapes: [
      'S’écarter sans précipitation : il est sous tension sauf assurance du contraire',
      'Gabarit ferroviaire ou routier engagé : prendre les mesures vis-à-vis des circulations',
      'Empêcher toute personne d’approcher le conducteur ou les pièces métalliques qui le touchent',
      'Faire aviser vite le responsable de l’installation pour couper d’urgence',
    ],
  },
  {
    id: 'consignes',
    titre: 'Le conducteur ne respecte pas mes consignes',
    genre: 'alea',
    pour: 'lam',
    etapes: [
      'Commander l’arrêt du LAM',
      'Vérifier qu’aucun gabarit ni point protégé n’est engagé (sinon, mesure d’urgence correspondante)',
      'Appeler le CCh : LAM arrêté, consignes non respectées',
      'Appeler le RSNCF ou le RSO pour qu’il fasse intervenir le RCE',
      'Attendre les consignes du CCh : seul le CCh autorise la reprise',
    ],
  },
  {
    id: 'panne',
    titre: 'Panne du LAM',
    genre: 'alea',
    pour: 'lam',
    etapes: [
      'Aviser le CCh pour organiser le secours',
      `Gabarit engagé : ${S2B.toLowerCase()}, ou maintenir la zone de chantier de cette voie`,
      'Pas de train de lorrys pour le secours, sauf si l’agrément le permet',
    ],
    note: 'Une manœuvre de secours replie l’engin dans le gabarit de la voie de chantier en moins de 15 minutes si le moteur principal tombe en panne.',
  },
  {
    id: 'cable',
    titre: 'Le LAM a endommagé une installation ou un câble',
    genre: 'alea',
    pour: 'lam',
    etapes: ['Aviser tout de suite l’agent d’activité ou le CCh', 'Empêcher quiconque d’approcher un câble arraché en attendant le CCh ou son représentant'],
  },
  {
    id: 'point-mev',
    titre: 'Changer le point de mise en voie ou hors voie, ou la zone d’action',
    genre: 'alea',
    pour: 'lam',
    etapes: ['Ne rien changer de soi-même', 'Aviser le CCh, qui étudie les conséquences (ZCh, PN, TTx, autres activités)', 'Assister au nouveau briefing', 'Attendre l’autorisation écrite ou par dépêche du CCh'],
  },
  {
    id: 'organisation',
    titre: 'Le CCh change l’organisation des travaux',
    genre: 'alea',
    pour: 'lam',
    etapes: [
      'Le CCh présente la nouvelle organisation et ce qui déroge à la mission',
      'Faire ses demandes (accompagnement, relève…)',
      'Recevoir la nouvelle consigne LAM, en remplacement',
      'Recevoir la confirmation écrite ou par dépêche du CCh',
    ],
  },
  {
    id: 's9-aleas',
    titre: 'Aléa ou doute pendant une mission S9',
    genre: 'alea',
    pour: 's9',
    etapes: [
      'Aviser tout de suite le CCh, ou à défaut le RPTx',
      'Ne jamais modifier de soi-même la nature ou la façon de faire la prestation',
      'Obtenir l’autorisation écrite du CCh ou du RPTx',
      'Participer au nouveau briefing s’il y en a un',
    ],
  },
];

/** Moyens d'arrêter les trains, puis couverture (S2B). */
export const S2B_MOYENS = ['Alerte radio', 'Torche à flamme rouge', 'Coupure d’urgence (caténaire)', 'Barre de court-circuit', 'Commutateurs', 'Couverture : se porter au-devant du premier train attendu'];
