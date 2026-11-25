/**
 * Mémo de l'agent PN, reformulé d'après le support « Formation TES F – Intervenant PN » (ETF).
 * La fiche de travail, la consigne PN, le livret de service et les textes SNCF Réseau en vigueur priment toujours.
 */
import type { MemoSection } from '../asp/memo';

export const MEMO_PN: MemoSection[] = [
  {
    id: 'pn-role',
    titre: 'Habilitation et rôle',
    resume: 'TES F, TES M en plus pour certaines missions',
    blocs: [
      {
        t: 'p',
        text: 'Assurer la protection des circulations ferroviaires vis-à-vis des circulations routières (et l’inverse) aux passages à niveau est une tâche essentielle de sécurité (arrêté du 7 mai 2015) : la TES F.',
      },
      {
        t: 'list',
        items: [
          'Connaître la manœuvre des installations de PN.',
          'Reconnaître les dispositifs qui restreignent ou interdisent la manœuvre d’un PN, et ne pas manœuvrer ces installations.',
          'Identifier un dérangement, prendre les mesures de sécurité et appliquer les procédures.',
          'Appliquer les procédures en cas d’accident, d’incident ou de risque grave ou imminent.',
          'Appliquer les mesures nécessaires pour participer au retour à la situation normale.',
        ],
      },
      { t: 'p', text: 'Pour certaines missions, l’agent PN doit aussi être habilité à la TES M : assurer l’annonce des trains en l’absence de dispositif automatique.' },
      {
        t: 'kv',
        rows: [
          ['Agent PN en travaux', 'Utilise les dispositifs du PN à SAL pendant des travaux, pour écouler la circulation routière ; gère aussi le franchissement par un mobile travaux. Pas d’autre mission en même temps.'],
          ['Agent franchissement mobile travaux', 'Gère le franchissement du PN à SAL par les mobiles travaux, en assurant la sécurité des circulations routières.'],
          ['Garde de PN', 'Assure le service d’un PN gardé, ou le gardiennage provisoire d’un PN à SAL après un dérangement.'],
        ],
      },
    ],
  },
  {
    id: 'pn-securite',
    titre: 'Sécurité du personnel',
    resume: 'EPI, briefing, risques, zone dangereuse',
    blocs: [
      { t: 'p', text: 'EPI obligatoires : casque, lunettes de sécurité, vêtement orange à bandes réfléchissantes, chaussures de sécurité. Ils protègent, mais n’empêchent pas les accidents.' },
      { t: 'p', text: 'Le briefing sécurité est obligatoire : un réflexe métier incontournable. Il fait partager le dispositif de sécurité à tous les intervenants et anticipe les aléas et les changements de phase. Il ne remplace pas les procédures.' },
      {
        t: 'kv',
        rows: [
          ['Risque ferroviaire', 'Heurt par une circulation, effet de souffle, installations de traction électrique.'],
          ['Risque électrique', 'Contact direct ou indirect (outillage) ou amorçage avec une installation sous tension.'],
          ['Risque routier', 'Celui auquel l’agent PN s’expose pendant sa mission, au milieu des usagers de la route.'],
          ['Zone dangereuse', 'Là où l’agent, son outillage ou son matériel peut être heurté par une circulation ou mis en danger par l’effet de souffle.'],
        ],
      },
    ],
  },
  {
    id: 'pn-identification',
    titre: 'Identifier le PN',
    resume: 'Numéro, pancarte, étiquettes blanches et bleues',
    blocs: [
      { t: 'p', text: 'Les PN sont en principe numérotés à la suite, dans le sens croissant du kilométrage de la ligne depuis son origine.' },
      { t: 'p', text: 'Le numéro est écrit en blanc sur fond bleu, sur la maison de garde ou sur deux plaquettes dos à dos fixées à un poteau au droit du PN.' },
      {
        t: 'table',
        head: ['Voie ou sens', 'Étiquette'],
        rows: [
          ['Voie 1 ou sens impair', 'Blanche'],
          ['Voie 2 ou sens pair', 'Bleue'],
        ],
      },
      { t: 'p', text: 'Ces étiquettes repèrent le voyant et chaque commutateur de la même voie (ou du même sens), jusque sur les mécanismes du PN à SAL.' },
    ],
  },
  {
    id: 'pn-types',
    titre: 'Types de PN à SAL',
    resume: 'SAL 4, SAL 2, SAL 2B, SAL FC, SAL 0',
    blocs: [
      { t: 'p', text: 'PN à SAL : passage à niveau équipé d’une signalisation automatique lumineuse et sonore.' },
      {
        t: 'kv',
        rows: [
          ['SAL 4', 'Quatre demi-barrières (deux de chaque côté, toute la chaussée). Près d’une gare où beaucoup de trains s’arrêtent, PN à fermeture régulière et prolongée, ou près d’un établissement scolaire.'],
          ['SAL 2', 'Deux demi-barrières, une de chaque côté, chacune sur une partie de la chaussée.'],
          ['SAL 2B', 'Deux grandes barrières couvrant toute la chaussée. Fermetures fréquentes et longues (5 min au moins) sans train, barrières à 100 m au plus l’une de l’autre, 100 à 500 véhicules par jour.'],
          ['SAL FC', 'Franchissement conditionnel : le train ne franchit qu’après un contrôle de fermeture des barrières (deux feux verts). Lignes à trafic lent et faible (VUTR). Annonce par pédale ou radio.'],
          ['SAL 0', 'Sans barrières : feux rouges clignotants et sonneries, sur VUTR.'],
        ],
      },
    ],
  },
  {
    id: 'pn-categories',
    titre: 'Catégories de PN',
    resume: 'De la 1re (barrières) à la 4e (privés)',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['1re catégorie', 'Publics, avec barrières ou demi-barrières, automatiques ou gardés. Lignes à 160 km/h au plus.'],
          ['2e catégorie', 'Publics, sans barrières ni gardiennage. En principe sur des lignes à moins de 140 km/h.'],
          ['3e catégorie', 'Publics pour piétons, avec portillons non fermés à clé (à leurs risques et périls).'],
          ['4e catégorie', 'Privés (véhicules et/ou piétons), sous la responsabilité du bénéficiaire d’une convention ; barrières et portillons cadenassés.'],
        ],
      },
    ],
  },
  {
    id: 'pn-signalisation',
    titre: 'Signalisation routière et téléphone',
    resume: 'Feu rouge clignotant, croix de Saint-André',
    blocs: [
      { t: 'warn', text: 'Le feu rouge clignotant est un signal d’arrêt absolu pour tous les usagers de la route, piétons compris.' },
      {
        t: 'list',
        items: [
          'Le PN est annoncé par un panneau « passage à niveau avec barrières » ou « sans barrières », à environ 150 m en campagne et 50 m en ville.',
          'Puis il est signalé par les feux rouges clignotants (barrières automatiques) ou par une croix de Saint-André (avec stop ou feu rouge clignotant).',
          'Plusieurs voies : « Un train peut en cacher un autre ».',
        ],
      },
      { t: 'p', text: 'Sauf sur certaines VUTR, chaque PN à SAL a un téléphone repéré, pour le public et les agents : il appelle l’agent circulation d’une des gares qui encadrent le PN. Parfois, il permet aussi à l’agent au PN de recevoir un appel.' },
    ],
  },
  {
    id: 'pn-boitier',
    titre: 'Boîtier de commutateurs',
    resume: 'Voyants, CSR, FntA, blocage, patte de verrouillage',
    blocs: [
      { t: 'p', text: 'Il permet de commander à pied d’œuvre les signaux routiers et de mettre hors service l’annonce automatique, voie par voie (ou sens par sens).' },
      {
        t: 'kv',
        rows: [
          ['Voyants d’annonce', 'Un par voie en double voie (ANNONCE VOIE…), un par sens en voie unique (ANNONCE SENS…). Blanc : pas d’annonce. Rouge : annonce déclenchée ou zone courte occupée (en voie unique, les deux au rouge).'],
          ['CSR', 'Commande des signaux routiers, sous la bride cadenassée. Normalement sur OUVERTURE. Sur FERMETURE : le PN se ferme ou reste fermé. Il doit être sur FERMETURE pour relever le couvercle du boîtier.'],
          ['FntA', 'Un par voie (ou sens), cadenassé sur EN SERVICE. Sur HORS SERVICE : l’annonce de cette voie est coupée, le CSR commande le PN pour elle ; l’autre voie reste automatique.'],
          ['Blocage', 'Sur ligne BAL. Clé de Berne. Sur FERMETURE (rouge) : indication S au panneau qui précède le PN. À placer sur FERMETURE avant toute mise hors service d’une annonce, sinon elle n’est pas effective.'],
          ['Patte de verrouillage', 'Garde le couvercle en position intermédiaire, un FntA sur HORS SERVICE et le CSR sur OUVERTURE ; tout est cadenassé. Seulement sous couvert d’une consigne remise à l’agent.'],
        ],
      },
      {
        t: 'list',
        items: [
          'Le voyant de la voie mise hors service passe (ou reste) au rouge.',
          'Double voie : la zone courte est annulée sur la voie dont l’annonce est coupée. Voie unique : seulement quand les deux annonces sont hors service.',
          'Le boîtier ne se cadenasse pas en situation normale tant qu’un FntA n’est pas remis sur EN SERVICE.',
        ],
      },
    ],
  },
  {
    id: 'pn-ma',
    titre: 'PN sans boîtier : Marche-Arrêt',
    resume: 'M/A, Normal-Secours, SAL FC, SAL 0',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Marche-Arrêt', 'Normalement cadenassé sur MARCHE. Sur ARRÊT : le PN se ferme ou reste fermé.'],
          ['Normal-Secours', 'Sur la guérite, à levier ou à manette. Normalement cadenassé sur NORMAL. Sur SECOURS : l’annonce de la voie (ou du sens) est annulée, le M/A commande le PN ; l’autre voie reste automatique.'],
        ],
      },
      {
        t: 'list',
        items: [
          'L’annulation n’est effective que si le M/A est déjà sur ARRÊT.',
          'Avant de remettre le M/A sur MARCHE pour la 1re fois : vérifier qu’aucune annonce n’est déclenchée sur l’autre voie (voyant blanc), sinon attendre.',
          'Une sonnerie faible tinte pendant toute l’annulation de l’annonce.',
          'SAL FC à mécanismes légers : commutateur EN SERVICE / HORS SERVICE, puis clé spéciale et levier de manœuvre pour chaque barrière.',
          'SAL 0 (VUTR) : M/A et parfois Normal-Secours ; sur SECOURS, l’annonce des deux sens est annulée.',
        ],
      },
    ],
  },
  {
    id: 'pn-main-moteur',
    titre: 'Dispositif Main/Moteur',
    resume: 'Relever une barrière à la manivelle',
    blocs: [
      { t: 'p', text: 'Quand le PN est fermé et ne se commande plus au CSR ou au M/A, on relève chaque barrière à la main. Sur les SAL 4 et certains SAL 2, le dispositif Main/Moteur le permet avec une manivelle. Il est cadenassé sur MOTEUR.' },
      { t: 'warn', text: 'Ne s’utilise qu’après avoir placé le CSR sur FERMETURE (ou le M/A sur ARRÊT).' },
      {
        t: 'list',
        items: [
          'Décadenasser le levier (ou le commutateur à trois positions) et le mettre sur MAIN. Au SAL 4, la barrière de sortie correspondante s’ouvre seule.',
          'Manette à boule : la mettre sur OUVERTURE pour dégager l’orifice.',
          'Pousser la manivelle à fond, tourner dans le sens des aiguilles d’une montre, puis la retirer. La sonnerie de la barrière tinte normalement.',
          'Pour refermer : manette (ou commutateur) sur FERMETURE. Ne pas revenir sur OUVERTURE avant la fermeture complète.',
          'À la fin : sur FERMETURE, et après fermeture complète, ramener et cadenasser sur MOTEUR.',
        ],
      },
    ],
  },
  {
    id: 'pn-documents',
    titre: 'Documents et agrès',
    resume: 'Consigne PN, carnet, livret de service, matériel',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Document métier', 'Agent PN (TES F).'],
          ['Consigne PN', 'Annexée au contrat de travaux.'],
          ['Programme du jour', 'Avec la situation géographique.'],
          ['Carnet du PN', 'Interventions des agents sur l’installation et dépêches, en travaux comme en dérangement.'],
          ['Livret de service', 'Mesures que l’agent voie applique quand l’installation est en dérangement.'],
          ['Mode opératoire', 'Fonctionnement des PN dont l’agent a la charge.'],
        ],
      },
      {
        t: 'p',
        text: 'Agrès : radios, dispositif de shuntage (DSh), signaux d’arrêt à main (SAM), pétards à griffes, clé de Berne, clé triangulaire pour cadenas d’artillerie, cadenas du commerce, torche à flamme rouge, fanion réflectorisé, lanternes à feu rouge, manivelle.',
      },
      { t: 'list', items: ['Plusieurs voies concernées : assez de lanternes pour toutes les protéger.', 'Pattes de verrouillage et banderoles restent au PN (sauf avis contraire de SNCF Réseau).'] },
    ],
  },
  {
    id: 'pn-cycle',
    titre: 'Cycle de fonctionnement',
    resume: 'Annonce, préavis, barrières, réouverture',
    blocs: [
      {
        t: 'list',
        items: [
          'PN ouvert : barrières hautes, feux éteints.',
          'Annonce d’un train → commande de fermeture : feux clignotants et sonneries.',
          'Temps de préavis → les demi-barrières s’abaissent.',
          'PN fermé : barrières basses, feux clignotants, sonneries arrêtées.',
          'Passage du train → commande de réouverture : feux éteints, barrières relevées.',
        ],
      },
      { t: 'p', text: 'SAL 4 : les demi-barrières d’entrée descendent d’abord ; quand elles sont basses, les sonneries s’arrêtent et les demi-barrières de sortie descendent.' },
    ],
  },
  {
    id: 'pn-derangement',
    titre: 'Dérangements',
    resume: 'Raté d’ouverture, raté de fermeture, bris de barrière',
    blocs: [
      { t: 'p', text: 'Un PN à SAL est en dérangement quand ses signaux routiers sont présentés de façon incomplète ou contraire à leur principe. Il faut y remédier au plus vite.' },
      {
        t: 'kv',
        rows: [
          ['Raté d’ouverture', 'Sans aucun train en approche : feux rouges allumés, ou une ou plusieurs barrières fermées.'],
          ['Raté de fermeture', 'À l’approche ou au passage d’un train : feux éteints, une barrière d’un SAL 2 (ou d’entrée d’un SAL 4) ouverte, ou un feu éteint et une barrière cassée.'],
          ['Bris de barrière', 'Une barrière cassée qui ne s’oppose plus au passage. Tous les feux marchent : raté d’ouverture. Des feux éteints à l’approche d’un train : raté de fermeture.'],
        ],
      },
      {
        t: 'list',
        items: [
          'Tout agent qui constate une anomalie alerte un agent d’une des gares ou d’un des postes qui encadrent le PN, avec tous les renseignements.',
          'L’Exploitation prend des mesures immédiates ; l’agent SE relève le dérangement ; l’agent voie rétablit une circulation aussi normale que possible, en sécurité.',
          'En attendant l’astreinte SE (CCh prévenu) : gérer le flux avec les banderoles (selon la situation) et, si besoin, un SAM de nuit type R34 ; envoyer les usagers vers l’itinéraire de détournement ; expliquer les informations du téléphone ou du QR code.',
          'S’il faut intervenir et que l’agent au PN le peut : suivre les directives de la 1re page du livret de service.',
        ],
      },
    ],
  },
  {
    id: 'pn-mission-travaux',
    titre: 'Mission : agent PN en travaux',
    resume: 'Vérifications, prise en travaux, mobiles, fin',
    blocs: [
      {
        t: 'list',
        items: [
          'Hors emprises : briefing sécurité avec tous les acteurs.',
          'Vérifier : identifier le PN, les agrès, l’état des installations, le bon fonctionnement (sinon signaler le dérangement au CCh/RPTx).',
          'Avertir le CCh de sa présence, puis recevoir l’ordre de début d’intervention (dépêche).',
          'Fiche de travail : blocage sur FERMETURE (ligne BAL), DSh en voie si nécessaire et voyants, SAM de part et d’autre, CSR sur FERMETURE, FntA sur HORS SERVICE, voyants, CSR sur OUVERTURE, photo du BCM fermé et cadenassé, compte rendu au CCh/RPTx.',
          'Carnet du PN, partie travaux : date et heure de reprise, n° du contrat de travaux, indice.',
          'Fin : dépêche de fin reçue puis passée, photo du BCM, carnet (fin d’intervention), dépêche s’il y a un dérangement, cadre C de l’ARF rendu au RSO ou au RSNCF.',
        ],
      },
    ],
  },
  {
    id: 'pn-mobile',
    titre: 'Franchissement par un mobile travaux',
    resume: 'SAM, CSR, ordre des gestes',
    blocs: [
      {
        t: 'list',
        items: [
          'Rendre compte au CCh/RPTx, vérifier que c’est prévu (consigne PN ou fiche de travail) et la position du mobile sur la situation géographique.',
          'Si rien ne s’y oppose (véhicules routiers) : CSR sur FERMETURE (ou M/A sur ARRÊT).',
          'Déposer la partie haute du DSh s’il y en a un.',
          'Retirer le SAM le plus éloigné du mobile, puis celui près du mobile.',
          'Autoriser la traversée du PN.',
          'Repositionner les SAM en commençant par le plus proche du mobile ; reposer la partie haute du DSh.',
          'CSR sur OUVERTURE, puis fermer le BCM (patte de verrouillage).',
        ],
      },
      { t: 'p', text: 'Mettre en voie un LAM : vérifier la fiche de travail, CSR sur FERMETURE si rien ne s’y oppose, se placer avec un SAM en amont du lieu de stationnement du LAM, relever la barrière à la main, retirer le SAM en accord avec l’agent LAM, le repositionner, CSR sur OUVERTURE, fermer le BCM.' },
    ],
  },
  {
    id: 'pn-textes',
    titre: 'Textes de référence',
    resume: 'Ceux qui priment sur ce mémo',
    blocs: [
      {
        t: 'list',
        items: [
          'OP 461 : protection des voies principales, fermeture de voie.',
          'OP 484 à 486, 489, 491, 492 : sécurité du personnel (risques ferroviaires et électriques, lignes à plus de 160 km/h).',
          'MT 08143 : missions connexes de sécurité. MT 04343 : missions de sécurité au PN.',
          'MT 08029 : autorisation d’engagement en zone à risques ferroviaires. MT 01703 : PN et traversées, mesures en cas de travaux.',
          'RFN-IG-SE 02 B-00-n° 004 : arrêt des trains en cas de risque grave ou imminent.',
        ],
      },
    ],
  },
  {
    id: 'pn-sigles',
    titre: 'Sigles',
    resume: 'CSR, FntA, BCM, DSh, SAM, ARF…',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['ARF', 'Autorisation d’engagement en zone à risques ferroviaires'],
          ['BAL / BAPR', 'Block automatique lumineux / à permissivité restreinte'],
          ['BCM', 'Boîtier de commutateurs'],
          ['CCh', 'Chef de chantier'],
          ['CCTT', 'Consigne commune temporaire travaux'],
          ['CmB', 'Commutateur de blocage'],
          ['CSR', 'Commande des signaux routiers'],
          ['CTx', 'Contrat de travaux'],
          ['DFV', 'Demande de fermeture de voie'],
          ['DSh', 'Dispositif de shuntage'],
          ['FntA', 'Fonctionnement automatique'],
          ['LAM / WA', 'Lorry automoteur / wagon automoteur'],
          ['M/A', 'Marche-Arrêt'],
          ['RPTx', 'Responsable de planche travaux'],
          ['RSO', 'Représentant de la sécurité opérationnelle'],
          ['SAL', 'Signalisation automatique lumineuse et sonore'],
          ['SAM', 'Signal d’arrêt à main'],
          ['VUTR', 'Voie unique à trafic restreint'],
          ['ZEP', 'Zone élémentaire de protection'],
        ],
      },
    ],
  },
];

/** Règles clés qui défilent sur l'accueil. */
export const REGLES_PN = [
  'Feu rouge clignotant : arrêt absolu pour tous',
  'Étiquette blanche : voie 1 ou sens impair ; bleue : voie 2 ou sens pair',
  'Voyant blanc : pas d’annonce ; rouge : annonce ou zone courte occupée',
  'Ligne BAL : blocage sur FERMETURE avant de couper une annonce',
  'CSR sur FERMETURE pour ouvrir le boîtier',
  'Mobile travaux : retirer d’abord le SAM le plus éloigné',
  'Repositionner d’abord le SAM le plus proche du mobile',
  'Normal-Secours : M/A sur ARRÊT d’abord',
  'Raté d’ouverture : feux ou barrières fermés sans train',
  'Fin de mission : photo du BCM fermé et cadenassé',
];
