/**
 * Mémo de l'ASP, reformulé d'après le support de formation « TES M – compétence ASP » (S2MIH, version 1.3 du
 * 30/05/2023). Les textes SNCF Réseau en vigueur et les consignes locales priment toujours.
 */
import { distanceAnnonce } from './rules';

export type MemoBloc =
  | { t: 'p'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'kv'; rows: [string, string][] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'warn'; text: string }
  | { t: 'sig'; items: { ic: string; nom: string; texte: string }[] }
  | { t: 'chaine' };

export interface MemoSection {
  id: string;
  titre: string;
  resume: string;
  blocs: MemoBloc[];
}

const dmvc = (v: number) => [String(v), ...[10, 15, 20].map((t) => `${distanceAnnonce(v, t)} m`)];

export const MEMO: MemoSection[] = [
  {
    id: 'asp',
    titre: 'Le rôle de l’ASP',
    resume: 'Mission, repérage, remplacement',
    blocs: [
      { t: 'p', text: 'Toute intervention sur le réseau (une « activité ») a un agent d’activité responsable. Avant le travail, il désigne ou on lui assigne un agent sécurité du personnel (ASP). Il faut un ASP pour chaque équipe, même de deux agents.' },
      {
        t: 'list',
        items: [
          'Reconnu apte à la sécurité, il connaît le parcours et les consignes locales.',
          'Il est clairement identifié : gilet orange marqué « Agent sécurité du personnel », ou gilet orange avec brassard jaune.',
          'S’il s’absente ou forme une sous-équipe, il désigne devant l’équipe un agent habilité pour le remplacer.',
          'Si l’ASP est défaillant, les agents se rassemblent hors ZD et préviennent tout de suite leur hiérarchie.',
        ],
      },
      { t: 'p', text: 'Sa mission : mettre en œuvre les règles de sécurité du personnel vis-à-vis des risques ferroviaires prévues à l’organisation des travaux, et veiller à ce que chaque agent sous sa surveillance les respecte.' },
      {
        t: 'list',
        items: [
          'Il détermine le délai d’annonce et en déduit les distances d’annonce et de visibilité.',
          'Il met en place le dispositif d’annonce, vérifie qu’il marche et l’adapte si besoin.',
          'Il donne aux annonceurs les consignes et informations utiles : environnement, dangers, vitesse, sens de circulation…',
          'Il informe les agents des mesures à respecter, surtout les limites du chantier et les emplacements de garage.',
          'Il donne l’ordre de début du travail et de reprise après chaque interruption, quand c’est sans danger.',
          'Il repère les situations dangereuses et contrôle que les mesures sont appliquées.',
        ],
      },
      { t: 'p', text: 'Pour construire son dispositif, il dialogue avec le chef de chantier et s’appuie sur les documents de prévention et de sécurité ferroviaire, les caractéristiques du chantier (délai de dégagement, travaux, outillage, effectif), celles de la ligne (vitesse, garages, ouvrages), ses connaissances (marges, CADA) et la vigilance de ses agents.' },
    ],
  },
  {
    id: 'documents',
    titre: 'Documents et préparation',
    resume: 'Plan de prévention, particularités locales, carnets',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Plan de prévention', 'Rédigé par l’entreprise utilisatrice (SNCF) après une visite du chantier.'],
          ['Coordination SPS', 'PGC fait par le coordonnateur SPS, inspection commune, puis un PPSPS par entreprise et sous-traitant.'],
          ['Sécurité ferroviaire', 'CSF (consigne de sécurité ferroviaire) et ISF, qui la précise pour la mise en œuvre.'],
          ['Particularités locales', 'Remises contre émargement, valables pour un chantier, déclinées aux agents.'],
        ],
      },
      { t: 'p', text: 'L’ASP a sur lui et commente aux agents les documents de prévention. Il porte aussi :' },
      { t: 'list', items: ['Le carnet d’attestations de mise en place du dispositif d’annonce (AAn).', 'Le carnet CADA.', 'Sa carte d’habilitation et l’attestation d’accès aux emprises.'] },
      { t: 'p', text: 'Ce qu’il doit savoir de la ligne :' },
      {
        t: 'list',
        items: [
          'Nom et vitesses de la ligne.',
          'Régime d’exploitation (double voie, IPCS, banalisée…).',
          'Plateforme : nom des voies et sens des circulations.',
          'Pistes et itinéraires, emplacements de garage réduits ou interdits, entrevoies larges.',
          'Alimentation (1500 V, 25 000 V), ouvrages d’art, zones bruyantes, DCO.',
        ],
      },
      { t: 'warn', text: 'Carte des vitesses : il peut y avoir une rupture de vitesse. Si le point d’annonce est dans une portion à vitesse différente de celle du chantier, prends la vitesse la plus importante.' },
      { t: 'p', text: 'Le chef de chantier donne les caractéristiques du chantier : type et lieu des travaux, nombre d’agents habilités, outillage, période de travail (vigilance des annonceurs la nuit) et délai de dégagement (testé par un essai).' },
    ],
  },
  {
    id: 'principes',
    titre: 'Principes de l’annonce',
    resume: 'Quoi annoncer, à qui, les 3 cas sans annonce',
    blocs: [
      { t: 'p', text: 'La sécurité des agents sur la voie est assurée par une fermeture de voie (DFV) si l’activité fait obstacle, par un dispositif d’annonce (annonceurs, sentinelles) mis en place par l’ASP, ou par une annonce automatique. Ces mesures se prennent pour chaque sens de circulation, sur la voie de travail et si besoin sur les voies contiguës.' },
      { t: 'p', text: 'Le signal d’annonce peut être sonore, lumineux, ou les deux. Doivent être annoncées les circulations de tout sens :' },
      { t: 'list', items: ['sur la voie de travail ;', 'sur la ou les voies contiguës ;', 'sur les voies que les agents doivent franchir pour rejoindre le garage.'] },
      { t: 'p', text: 'L’annonce est faite pour tous les agents sur la voie de travail, et à proximité de la ZD quand il y a un risque de l’engager. On annonce aussi toute circulation qui peut gêner la visibilité sur une voie annoncée, ou dont l’annonceur ne peut pas dire tout de suite et sûrement sur quelle voie elle arrive.' },
      { t: 'p', text: 'À l’annonce, les agents interrompent le travail quelle que soit leur voie. S’ils sont dans la ZD, ils débarrassent la voie des outils et matériaux qui pourraient être heurtés ou déplacés par le souffle, et se garent hors de toute ZD à l’emplacement prévu.' },
      { t: 'p', text: 'Voie interdite ou proximité de la ZD : à l’annonce, les engins passent au ralenti et les EMIC sont immobilisés. Les travaux qu’on ne peut pas interrompre (soudure aluminothermique, JIC, libération de LRS…) continuent avec prudence, sans aucun risque d’engager la ZD ; l’ASP l’autorise après avoir consulté l’agent d’activité.' },
      { t: 'warn', text: 'L’annonce est toujours donnée, sauf dans 3 cas : travail à bord d’un engin à parois ou écrans (on ne peut pas sortir du gabarit de l’engin côté entrevoie) ; clôture à caractère défensif ; analyse a priori sans aucun risque d’engager la ZD ET clôture limitative qui matérialise la limite de la ZD.' },
      { t: 'p', text: 'Les mesures près de la ZD tiennent compte de la distance à la ZD et du risque de l’engager : interdiction sur les voies contiguës, barrières défensives (type Heras), arrêt de certains travaux au passage, grillage orange alvéolé, limitation de la course des engins…' },
    ],
  },
  {
    id: 'outillage',
    titre: 'Catégories d’outillage',
    resume: '1re portatif, 2e déraillable, 3e obstacle',
    blocs: [
      {
        t: 'table',
        head: ['Catégorie', 'Définition', 'Exemples'],
        rows: [
          ['1re · portatif', '35 kg au plus, non solidaire de la voie, mis hors ZD par un seul agent', 'Perceuse, bac à gravillons, moules de soudage, petits engins portatifs, outils reliés à un groupe hors ZD'],
          ['2e · facilement déraillable', '100 kg au plus (chariot de 35 kg au plus non compté), non solidaire, mis hors ZD en une fois par 2 agents', 'Échelles et ECPL de 4 m au plus'],
          ['3e · fait obstacle', 'Plus de 100 kg, ou solidaire de la voie, ou plus de 2 agents pour le sortir', 'Échelles et ECPL de plus de 4 m, crics à manivelle, EMIC'],
        ],
      },
      { t: 'p', text: 'Prends la masse en situation de travail : plein de carburant, chargement, phares… Les agents qui dégagent un outil de 2e catégorie restent en permanence tout près de lui.' },
      { t: 'p', text: 'Outillage de 2e catégorie : 4 outils au plus jusqu’à 120 km/h, 2 au-delà (4 bourroirs légers). Au garage, arrêter les moteurs ou les mettre au ralenti.' },
      { t: 'warn', text: '3e catégorie : interdiction de circulation obligatoire. 2e catégorie : interdiction obligatoire de nuit, sur voies banalisées, VUT organisée ou TCT, en IPCS sans DPCS, là où le garage est difficile (tunnel, viaduc ou pont-rail sans accotement, quai haut ou mi-haut, garage non contigu), si le DD dépasse 15 s, au-delà de 160 km/h et sur LGV.' },
      { t: 'p', text: 'Sur une ligne à une seule voie banalisée, un document d’application local peut permettre de travailler sans interdiction avec de l’outillage de 2e catégorie.' },
    ],
  },
  {
    id: 'dfv',
    titre: 'Interdiction de circulation (DFV)',
    resume: 'Quand elle est obligatoire',
    blocs: [
      { t: 'p', text: 'L’interdiction de circulation est obligatoire :' },
      {
        t: 'list',
        items: [
          'quand des raisons techniques l’imposent ;',
          'avec de l’outillage qui fait obstacle (3e catégorie) ;',
          'si la distance de visibilité minimale n’est pas obtenue ;',
          'si l’emploi de l’outillage de 2e catégorie l’impose ;',
          'si elle est prévue à la préparation du chantier ou par consigne locale.',
        ],
      },
      { t: 'p', text: 'Lignes parcourues à plus de 160 km/h (jusqu’à 200 km/h, 220 km/h pour les TGV) : avec de l’outillage portatif ou sans outillage, les travaux peuvent se faire sans interdiction sur la voie de travail, avec un délai d’annonce d’au moins 10 s.' },
      { t: 'p', text: 'Quand l’interdiction est obtenue, le « réalisateur » délivre l’avis de voie interdite (puis restituée) à la circulation. Le RSO ou R SNCF/Ch indique les voies interdites dans les cases S9 de la demande d’AAn : l’ASP doit le savoir pour sortir ces voies de son dispositif.' },
      { t: 'p', text: 'Si besoin, l’agent caténaire coupe l’alimentation et délivre une attestation de mise hors tension.' },
    ],
  },
  {
    id: 'dd',
    titre: 'Délai de dégagement',
    resume: 'Au moins 5 s, 15 s au plus en 2e catégorie',
    blocs: [
      { t: 'p', text: 'Choisi par le chef de chantier avec l’ASP, il est testé par le « test du délai de dégagement », ou vérifié avant l’engagement par une simulation hors ZD. C’est le temps, en secondes, pour prendre les mesures techniques avant le passage, débarrasser la voie et garer le personnel à l’emplacement prévu.' },
      {
        t: 'kv',
        rows: [
          ['Facteurs défavorables', 'Voies à traverser, niches ou refuges à rejoindre, obstacles…'],
          ['2e catégorie', '15 s au plus (au-delà : interdiction obligatoire)'],
          ['DD nul', 'Si la ZD n’est engagée que par inadvertance, ou avec une barrière d’entrevoie limitative'],
          ['Soudage, meulage', 'Au moins 5 s, même avec une barrière limitative'],
          ['DD non nul', 'Au moins 5 s'],
        ],
      },
    ],
  },
  {
    id: 'ms',
    titre: 'Marge de sécurité',
    resume: '5, 10 ou 15 s selon le cas',
    blocs: [
      { t: 'p', text: 'Choisie par l’ASP : 5, 10 ou 15 s. Trois cas : travaux sur voie circulée (5 ou 15 s), sur voie interdite à la circulation (5 ou 10 s), à proximité de la ZD (5 ou 10 s).' },
      {
        t: 'table',
        head: ['Sur voie circulée', 'Marge'],
        rows: [
          ['Sans outillage', '5 s'],
          ['1re catégorie (hors soudage, meulage, perceuse bicyclette)', '5 s'],
          ['Soudage à l’arc, meulage de rail, perceuse type bicyclette', '15 s'],
          ['2e catégorie', '15 s'],
          ['Obstacle qui peut masquer une circulation courte', '15 s'],
          ['Un seul annonceur pour les 2 sens', '15 s'],
          ['L’ASP surveille lui-même', '15 s'],
          ['Voies intérieures d’une plateforme de plus de 2 voies, séparées du garage', '15 s'],
        ],
      },
      {
        t: 'table',
        head: ['Voie interdite (DFV) ou proximité de la ZD', 'Marge'],
        rows: [
          ['Avec une clôture à caractère limitatif', '5 s'],
          ['Sans clôture limitative', '5 s'],
          ['Sans clôture, et obstacle masquant, un seul annonceur pour les 2 sens, ou ASP qui surveille lui-même', '10 s'],
        ],
      },
      { t: 'p', text: 'Agent seul : 15 s sur voie circulée, 10 s sur voie interdite.' },
    ],
  },
  {
    id: 'da',
    titre: 'Délai et distance d’annonce',
    resume: 'DA = DD + MS, distance au tableau',
    blocs: [
      { t: 'warn', text: 'Délai d’annonce = délai de dégagement + marge de sécurité. C’est le temps entre le déclenchement de l’annonce et l’arrivée de la circulation au point du chantier le plus proche (limite amont de la zone de travail).' },
      { t: 'p', text: 'Au-delà de 160 km/h (sans dépasser 200 km/h, 220 km/h pour les TGV), le délai d’annonce est d’au moins 10 s, et seul l’outillage portatif est autorisé.' },
      { t: 'p', text: 'Le délai est converti en distance d’annonce : la distance de visibilité minimale dont l’annonceur (ou la sentinelle) a besoin pour déclencher l’annonce. Elle se lit dans un tableau selon le délai et la vitesse maximale de la voie : vitesse ÷ 3,6 × délai, arrondie à la dizaine de mètres supérieure.' },
      {
        t: 'table',
        head: ['km/h', '5 s', '10 s', '15 s', '20 s', '25 s', '30 s'],
        rows: [60, 80, 100, 120, 140, 160, 200, 220].map((v) => [String(v), ...[5, 10, 15, 20, 25, 30].map((t) => String(distanceAnnonce(v, t)))]),
      },
      { t: 'p', text: 'Exemple : 160 km/h et 20 s → 160 ÷ 3,6 × 20 = 888,9 m → 890 m. Le tableau complet est dans « Calcul rapide ».' },
      { t: 'warn', text: 'Dans le tableau du support, la ligne 170 km/h donne 470 m pour 10 s ; le calcul exact donne 472 m, soit 480 m arrondis au-dessus, comme le tableau DMVC du même support. Retiens 480 m.' },
    ],
  },
  {
    id: 'placer',
    titre: 'Placer le dispositif',
    resume: 'Annonceur, chaîne, sentinelles, point d’annonce',
    blocs: [
      { t: 'p', text: 'L’ASP place l’annonceur en fonction :' },
      {
        t: 'list',
        items: [
          'de la distance de visibilité nécessaire pour chaque voie et chaque sens ;',
          'de l’audibilité du signal d’annonce ;',
          'de sa propre position : l’annonceur doit être visible de l’ASP ;',
          'de la ZD : l’annonceur est hors ZD, de préférence côté garage.',
        ],
      },
      { t: 'p', text: 'Chaîne d’annonceurs : des annonceurs et des annonceurs « répétiteurs » au droit du chantier délivrent et répercutent l’annonce. Elle sert sur les chantiers étendus ou bruyants. Chaque annonceur perçoit le signal de l’annonceur précédent.' },
      { t: 'chaine' },
      { t: 'p', text: 'Sentinelles : l’ASP les place de sorte que deux sentinelles qui se suivent, et la plus proche du chantier avec l’annonceur, s’aperçoivent et perçoivent à tout moment le signal. Chantier bruyant : le coup de trompe est appuyé d’un drapeau blanc déployé non agité de jour, ou d’un bâton lumineux la nuit.' },
      { t: 'p', text: 'Point origine d’annonce : repère-le avec les poteaux kilométriques et hectométriques, les points singuliers (ponts, PN, bâtiments) ou une roue d’arpenteur.' },
      { t: 'warn', text: 'Ne compte pas les poteaux caténaires : leur écartement varie de 30 à 60 m.' },
      { t: 'p', text: 'Obligations de l’ASP : essai préalable du dispositif ; vérifier aussi souvent que nécessaire le DD et la distance de visibilité ; nouvel essai d’audibilité si le chantier ou l’environnement change (vent, bruit) ; faire dégager la ZD si la sécurité n’est plus réglementaire ou si un annonceur ou une sentinelle est défaillant ; par brouillard sans la distance de visibilité, arrêter le travail sur les voies ouvertes ; ne pas modifier le dispositif sans aviser les agents.' },
    ],
  },
  {
    id: 'bruit',
    titre: 'Bruit et EPICB',
    resume: 'Zone bruyante, chantier bruyant, avertisseurs',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Zone bruyante', 'Près de routes très fréquentées, d’usines, d’aérodromes, de cours d’eau… Reprise dans une consigne d’établissement.'],
          ['Chantier bruyant', 'Outillage ou engins qui exposent à 80 dB(A) par jour ou plus, ou à une crête de 135 dB(A) ou plus.'],
          ['EPICB actif homologué', 'Porté par l’annonceur seul (pas la sentinelle), sauf avec un dispositif d’alerte (PN, sentinelle automatique…).'],
        ],
      },
      { t: 'warn', text: 'Outillage bruyant : l’annonce se fait avec un avertisseur à grande puissance type Gérard ou Saint-Dizier, à moins de 5 m des agents et orienté vers eux. Tout autre avertisseur est interdit (type Brive…).' },
      { t: 'p', text: 'Ordre des mesures : d’abord supprimer le risque (interdiction sur la voie dont la ZD peut être engagée) ; sinon le confiner (clôture défensive, écran ou paroi de l’engin, garde-corps) ; sinon trois mesures ensemble : voie de travail interdite, dispositif limitatif, annonce de la voie contiguë à l’avertisseur à grande puissance.' },
      { t: 'p', text: 'Les agents qui portent des bouchons d’oreilles moulés portent un brassard violet, pour être reconnus de toute l’équipe.' },
    ],
  },
  {
    id: 'cumul',
    titre: 'L’ASP qui annonce, cumul de tâches',
    resume: 'Conditions, 2 principes fondamentaux',
    blocs: [
      { t: 'p', text: 'L’ASP peut annoncer lui-même les circulations si :' },
      {
        t: 'list',
        items: [
          'la distance de visibilité est suffisante ;',
          'hors zone bruyante et sans engins bruyants ;',
          'hors voie banalisée, TCT, VUT organisée ;',
          'hors IPCS quand la DPCS n’est pas accordée ;',
          'hors tunnel ;',
          'de jour ;',
          'hors voies principales intérieures des plateformes de plus de deux voies contiguës ;',
          'si son travail et les conditions locales le permettent (consigne, entreprise).',
        ],
      },
      { t: 'p', text: 'Il n’est pas « annonceur » au sens réglementaire : il revêt son gilet blanc, met le passant jaune, annonce avec une trompe ceinture et fait un essai d’audibilité. Marge : 15 s sur voie circulée.' },
      { t: 'p', text: 'L’ASP peut tenir la fonction d’annonceur s’il est dégagé de tout autre travail, autorisé nominativement par le dirigeant local, pour une petite équipe de 3 agents au plus travaillant groupés sur un chantier fixe (ex. soudeurs). Jamais sur un chantier mobile.' },
      { t: 'warn', text: 'Cumul de tâches : à éviter. S’il a lieu, l’ASP doit à tout moment VOIR tous les agents sous sa surveillance qui engagent ou peuvent engager la ZD, et les annonceurs ; et POUVOIR adapter son dispositif et réagir, surtout à l’annonce.' },
      {
        t: 'table',
        head: ['L’ASP peut aussi être', 'Si'],
        rows: [
          ['RPTx ou CCh', 'Une seule zone de chantier, dans son champ visuel, sans TTx ni LAM, mono-activité'],
          ['Agent lorry automoteur', 'Un seul LAM, qui reste dans son périmètre de surveillance'],
          ['Mainteneur, agent d’activité, opérateur de maintenance', 'Dans le respect des 2 principes ; sollicitations ponctuelles'],
          ['Agent de consignation caténaire ou de protection électrique', 'Opération simple, aux abords du chantier'],
        ],
      },
    ],
  },
  {
    id: 'seul',
    titre: 'Agent seul',
    resume: 'Quand il faut un annonceur, marges 15 et 10 s',
    blocs: [
      { t: 'p', text: 'On distingue l’agent seul qui se déplace (et peut engager la ZD pendant son déplacement) et celui qui réalise seul un travail dans ou près de la ZD, hors de vue ou de voix du collectif. Il est habilité TES M, compétence ASP. Consulte toujours la consigne d’établissement. L’agent seul est interdit sur LGV.' },
      { t: 'p', text: 'Interdiction de circulation obligatoire : travaux qui font obstacle, cas prévu par un document local, distance de visibilité minimale non obtenue, règles de l’outillage de 2e catégorie, outillage de 3e catégorie.' },
      { t: 'p', text: 'Dispositif d’annonce (annonceur) obligatoire : cas prévu par un document local, distance d’annonce non obtenue, zone bruyante, IPCS sans DPCS, voie banalisée, VUT, TCT, chantier de nuit, voies intérieures d’une plateforme de plus de 2 voies, zone à plus de 160 km/h (jusqu’à 200, 220 pour les TGV).' },
      { t: 'warn', text: 'Sinon, s’il est autorisé par un document local, il surveille lui-même : marge de 15 s sur voie circulée, 10 s sur voie interdite ou près de la ZD ; délai d’annonce = DD + MS ; il garde la trace du calcul (carnet CADA).' },
    ],
  },
  {
    id: 'mobile',
    titre: 'Chantier mobile ou itinérant',
    resume: 'Annonce continue ou interrompue',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Mobile', 'Étendue constante, se déplace sans interrompre l’annonce (ex. débroussaillage). Annonceurs et sentinelles suivent l’équipe en gardant la distance de visibilité. L’ASP ne peut pas être annonceur.'],
          ['Itinérant', 'Petits chantiers d’étendue variable : l’ASP interrompt l’annonce à la fin de chaque intervention et fait acheminer les agents sous sa responsabilité (ex. prospection d’attaches).'],
        ],
      },
      { t: 'p', text: 'Dans les deux cas, la trompe ceinture peut servir (si la consigne d’établissement le prévoit, hors chantier et zone bruyants), et une seule fiche CADA suffit tant que les conditions ne changent pas (travaux, outillage, vitesse, sens, visibilité).' },
    ],
  },
  {
    id: 'pn',
    titre: 'Annonces d’un PN comme alerte',
    resume: 'Conditions et dérangement',
    blocs: [
      { t: 'p', text: 'L’ASP ou l’annonceur peut se servir des annonces d’un PN à SAL comme moyen d’alerte à condition :' },
      {
        t: 'list',
        items: [
          'd’avoir le document d’application local ;',
          'que le délai d’annonce du chantier soit inférieur au délai des annonces du PN ;',
          'que le PN ne soit pas en dérangement ;',
          'de faire un essai avec le commutateur M/A ou CSR avant la séance de travail ;',
          'que l’annonceur (ou la sentinelle) entende les sonneries et voie les voyants (ou au moins un feu rouge clignotant du PN) ;',
          'de ne reprendre le travail qu’après la réouverture complète du PN.',
        ],
      },
      { t: 'warn', text: 'Pas d’annonces du PN si : PN en dérangement, fanal d’alimentation secteur éteint en début de chantier, intervention d’un agent PN. Dérangement constaté : arrêter le chantier et aviser la gare ou le poste ouvert le plus proche.' },
      { t: 'p', text: 'Si le PN a des boîtiers de commutateurs et que le dispositif de la voie interdite est mis hors service, celui de la voie contiguë peut servir pour les trains de cette voie (fonctionnement automatique maintenu).' },
    ],
  },
  {
    id: 'complement',
    titre: 'Dispositions complémentaires',
    resume: 'DPCS, commutateur de vitesse, répétition d’annonce',
    blocs: [
      { t: 'p', text: 'Elles sont mises en œuvre par un agent SNCF autorisé, parfois appelé responsable disposition complémentaire (RDC).' },
      {
        t: 'kv',
        rows: [
          ['Protection à contre-sens (IPCS)', 'Demande verbale à un agent SNCF autorisé (TES C, « réalisateur ») ; il atteste par dépêche ou écrit la mise en place ; l’ASP l’avise de la fin par dépêche ou écrit.'],
          ['Commutateur de vitesse', 'Demande verbale ; l’agent atteste par dépêche l’activation et le taux de limitation ; l’ASP l’avise de la fin par dépêche.'],
          ['DFV pour protéger le personnel', 'Pour des travaux qui ne font pas obstacle : demande verbale au RPTx titulaire, qui autorise sur ZEP libre par dépêche ; fin par dépêche. Doit être prévu par consigne d’établissement.'],
        ],
      },
      { t: 'warn', text: 'Une chaîne d’annonce ne comporte que du personnel de la même entreprise : pas de mixité d’entreprises.' },
      { t: 'p', text: 'Répétition d’annonce (un premier dispositif alerte un second) : seulement si le signal du premier est sonore ET visuel ; si le second est en annonce manuelle ou DAPR en mode manuel côté premier ; si les points d’annonce sont compatibles ; si l’annonceur qui répète voit ET entend en permanence un avertisseur du premier ; si l’organisation est décrite dans un document local et autorisée par SNCF Réseau.' },
      { t: 'p', text: 'S’il perd le son ou la vue de l’avertisseur, l’annonceur émet le signal d’annonce, informe l’ASP et maintient l’annonce jusqu’à ce que l’ASP l’ait replacé en perception permanente et l’informe de la reprise.' },
    ],
  },
  {
    id: 'aan',
    titre: 'AAn : attestation d’annonce',
    resume: 'Cas 1 et 2, cadres A à D',
    blocs: [
      { t: 'p', text: 'L’ASP formalise la mise en place du dispositif par l’attestation d’annonce (AAn). Il en reçoit la demande :' },
      {
        t: 'kv',
        rows: [
          ['Cas 1', 'L’annonce suffit : demande du représentant chantier entreprise (RCE). L’AAn vaut alors autorisation d’engagement en zone à risques ferroviaires.'],
          ['Cas 2', 'Il faut au moins une interdiction ou une mise hors tension : demande du R SNCF/Ch ou du RSO, qui donne ensuite l’ARF au RCE. L’AAn ne vaut pas ARF.'],
        ],
      },
      {
        t: 'table',
        head: ['Cadre', 'Qui', 'Quoi'],
        rows: [
          ['A', 'RCE (cas 1) ou R SNCF/Ch, RSO (cas 2)', 'Demande : opération, délai de dégagement, zone (fixe, mobile, itinérant), horaires ; cases S9 pour les voies interdites'],
          ['B', 'ASP', 'Attestation de mise en place, après les garages et l’essai d’audibilité ; 1er feuillet remis au demandeur, souche gardée'],
          ['C', 'Demandeur', 'Cessation, quand les conditions changent ou à la fin ; remise à l’ASP qui la colle au recto du feuillet de son carnet'],
          ['D', 'RCE', 'Fin de présence dans les emprises, si l’ASP accompagne l’entreprise jusqu’à la sortie'],
        ],
      },
      { t: 'p', text: 'Les échanges formalisés ne sont pas obligatoires (sauf texte ou document d’organisation) si l’ASP cumule avec R SNCF/Ch ou RSO, ou entre deux acteurs de la même entreprise.' },
      { t: 'p', text: 'Avant l’IN 08029, l’interdiction se faisait par l’AITC (attestation d’interdiction temporaire des circulations), en 3 cadres : A donné par le R SNCF, B reçu par l’ASP, C rendu par l’ASP.' },
    ],
  },
  {
    id: 'briefing',
    titre: 'Briefing',
    resume: 'Ce qu’il faut dire à l’équipe',
    blocs: [
      {
        t: 'list',
        items: [
          'Les acteurs sécurité et leur repérage : ASP, R SNCF/Ch ou RSO, annonceurs, sentinelles, agents d’activité, Infralog…',
          'Les caractéristiques du chantier : fixe, mobile, itinérant, bruyant…',
          'Les changements de phase et d’activité prévus.',
          'Les conditions de circulation sur la voie de chantier et les voies contiguës : S9, VUT, IPCS, vitesses, LTV.',
          'Les limites de la zone de travail : PK, repères fixes, banderoles.',
          'Le dispositif d’annonce : voies et sens annoncés, rôle de chacun.',
          'Les protections collectives : chaînette, clôture, barrière.',
          'Les emplacements de garage à rejoindre.',
          'Les vêtements et EPI.',
        ],
      },
    ],
  },
  {
    id: 'dmvc',
    titre: 'Traverser les voies (DMVC)',
    resume: '10, 15, 20 s ; voie de service 90 m',
    blocs: [
      { t: 'p', text: 'Pistes et itinéraires garantissent la visibilité pour traverser. Ailleurs, sans dispositif qui autorise ou interdit l’accès, un engagement momentané de la ZD n’est possible qu’avec une visibilité compatible avec sa durée. Sinon on va plus loin là où on a cette distance ; en cas de nécessité absolue, il faut une interdiction ou un dispositif d’annonce.' },
      {
        t: 'kv',
        rows: [
          ['Traversée, 1 ou 2 voies', '10 s de visibilité, pour chaque sens'],
          ['Traversée, 3 ou 4 voies', '15 s'],
          ['Traversée, 5 ou 6 voies', '20 s'],
          ['Plus de 6 voies', 'Garage intermédiaire après 6 voies au plus'],
          ['Voie de service libre', '10 s, soit au moins 90 m'],
          ['Contournement d’obstacle jusqu’à 5 m', '10 s (les 2 sens en voie unique, IPCS, voie banalisée)'],
          ['Obstacle de 5 à 10 m', '15 s'],
          ['Obstacle de 10 à 15 m', '20 s ; au-delà, consigne des particularités locales'],
        ],
      },
      { t: 'p', text: 'Au-delà de 160 km/h (jusqu’à 220 km/h), la consigne des particularités locales donne les zones où la visibilité suffit pour traverser.' },
      { t: 'table', head: ['km/h', '10 s', '15 s', '20 s'], rows: [30, 60, 80, 100, 120, 140, 160, 170, 200, 220].map(dmvc) },
    ],
  },
  {
    id: 'zd',
    titre: 'Zone dangereuse',
    resume: 'Largeur selon la vitesse',
    blocs: [
      { t: 'p', text: 'La zone dangereuse est l’espace autour de chaque voie où un agent, son outillage ou son matériel peut être heurté. Elle se mesure depuis le bord extérieur du rail.' },
      {
        t: 'kv',
        rows: [
          ['Jusqu’à 160 km/h', '1,50 m'],
          ['De 160 à 220 km/h', '2,00 m'],
        ],
      },
      { t: 'warn', text: 'Valeurs usuelles, reprises dans le projet d’arrêté d’application du décret 2017-694 : le support de formation ne les donne pas. Vérifie la valeur dans les textes et consignes en vigueur.' },
    ],
  },
  {
    id: 'signaux',
    titre: 'Signalisation',
    resume: 'Arrêt, annonce, vitesse, divers, électrique',
    blocs: [
      { t: 'p', text: 'Les signaux protègent contre le rattrapage (même sens), le nez à nez (sens inverses) et la prise en écharpe (circulations qui convergent). Tout agent doit une obéissance passive et immédiate aux signaux qui le concernent.' },
      { t: 'p', text: 'Ils sont implantés à gauche de la voie ou au-dessus (à droite : prévu au règlement ou indiqué par une flèche). Plaque de repérage : numéro (C ou Cv pour carrés et carrés violets, GA pour les guidons), km arrondi à l’hm en pleine voie. Un signal à visibilité réduite est précédé de mirlitons ; un signal annulé porte une croix de Saint-André.' },
      {
        t: 'sig',
        items: [
          { ic: 'carre', nom: 'Carré', texte: 'Deux feux rouges : arrêt absolu avant le signal.' },
          { ic: 'cv', nom: 'Carré violet', texte: 'Un feu violet : arrêt absolu avant le signal.' },
          { ic: 's', nom: 'Sémaphore', texte: 'Un feu rouge : arrêt avant le signal.' },
          { ic: 'd', nom: 'Disque', texte: 'Feu rouge et feu jaune : marche à vue immédiate.' },
          { ic: 'a', nom: 'Avertissement', texte: 'Un feu jaune : être en mesure de s’arrêter avant le signal d’arrêt annoncé (carré, sémaphore, feu rouge clignotant, heurtoir).' },
          { ic: 'mirliton1', nom: 'Mirliton', texte: 'Annonce un signal à visibilité réduite.' },
        ],
      },
      {
        t: 'list',
        items: [
          'Guidon d’arrêt : bande lumineuse (ou aile rouge) : arrêt absolu.',
          'Feu rouge clignotant : on peut ne pas marquer l’arrêt, marche à vue, 15 km/h au plus au franchissement.',
          'Feu jaune clignotant : être en mesure de s’arrêter avant le signal d’arrêt annoncé à distance réduite par l’avertissement suivant.',
          'Feu vert clignotant (préannonce) : comme le vert jusqu’à 160 km/h ; au-delà, réduire à 160 km/h au plus tard au panneau suivant.',
          'Feu vert : marche normale si rien ne s’y oppose. Feu blanc : marche en manœuvre (30 km/h sur les appareils vers une voie principale). Blanc clignotant : manœuvre seulement, pas de départ en ligne.',
        ],
      },
      { t: 'p', text: 'Limitations de vitesse : ralentissement et rappel 30 ou 60, TIV à distance (fixes ou mobiles), pancartes Z (zone) et R (reprise). LTV de chantier : TIV à distance (fond blanc, chiffres noirs ; avec un disque jaune si 40 km/h ou moins), TIV d’exécution (fond noir, chiffres blancs) à l’origine, tableau blanc de fin : reprise de la vitesse quand le dernier véhicule l’a franchi.' },
      {
        t: 'sig',
        items: [
          { ic: 'tiv-d-fixe-90', nom: 'TIV à distance fixe', texte: 'Ne pas dépasser la vitesse indiquée au franchissement de la zone ou de l’aiguille.' },
          { ic: 'tiv-d-mob-90', nom: 'TIV à distance mobile', texte: 'Annonce une limitation sur l’aiguille ou la zone qui suit.' },
          { ic: 'z', nom: 'Pancarte Z', texte: 'Début de la zone à vitesse limitée.' },
          { ic: 'r', nom: 'Pancarte R', texte: 'Reprise de la vitesse.' },
        ],
      },
      { t: 'p', text: 'Signal d’arrêt à main : repère le point à ne pas dépasser, ou commande l’arrêt immédiat en urgence (à défaut : objet ou lumière vivement agités, deux bras levés). Si l’arrêt n’a pas été obtenu avant le signal, le conducteur ne repart qu’avec l’assurance verbale que rien ne s’y oppose. Pétards : la détonation commande l’arrêt d’urgence, puis la marche à vue sur la distance de couverture des obstacles.' },
      {
        t: 'sig',
        items: [
          { ic: 'arret', nom: 'Pancarte ARRÊT', texte: 'Point d’arrêt (pancartes « Arrêt des trains du chantier », « Arrêt pour refoulement »…).' },
          { ic: 'g', nom: 'Pancarte G', texte: 'Signal de garage.' },
          { ic: 'lm', nom: 'Pancarte LM', texte: 'Limite de manœuvre.' },
          { ic: 'cc-exe', nom: 'Coupez courant', texte: 'Traction électrique : précédé de « Sectionnement à … m ».' },
          { ic: 'bp-dis', nom: 'Baissez panto', texte: 'Traction électrique : baisser le pantographe.' },
          { ic: 'fin-cat', nom: 'Fin de caténaire', texte: 'Fin de la ligne de contact.' },
        ],
      },
      { t: 'p', text: 'Dessins : bibliothèque « signalisation-rfn-svg » de Nicolas Wurtz (licence GPL-3.0).' },
    ],
  },
  {
    id: 'sigles',
    titre: 'Sigles',
    resume: 'AAn, CADA, DFV, RSO, ZD…',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['AAn', 'Attestation de mise en place du dispositif d’annonce'],
          ['AITC', 'Attestation d’interdiction temporaire des circulations (avant l’IN 08029)'],
          ['ARF', 'Autorisation d’engagement en zone à risques ferroviaires'],
          ['ASP', 'Agent sécurité du personnel'],
          ['CADA', 'Carnet où l’ASP trace son calcul de la distance d’annonce'],
          ['DD, MS, DA', 'Délai de dégagement, marge de sécurité, délai d’annonce'],
          ['DFV', 'Demande de fermeture de voie (interdiction de circulation)'],
          ['DMVC', 'Distance minimale de visibilité compatible'],
          ['DPCS', 'Protection à contre-sens accordée en IPCS (voir Dispositions complémentaires)'],
          ['EMIC', 'Équipement mobile d’intervention caténaire'],
          ['ECPL', 'Échelle caténaire poteau ligne'],
          ['EPICB', 'Équipement de protection individuelle contre le bruit'],
          ['IPCS, ICS', 'Installations permanentes de contre-sens'],
          ['LAM', 'Lorry automoteur'],
          ['LTV', 'Limitation temporaire de vitesse'],
          ['RCE', 'Représentant chantier entreprise'],
          ['RPTx', 'Responsable de planche-travaux'],
          ['RSO', 'Représentant de la sécurité opérationnelle'],
          ['VUT', 'Voie unique temporaire'],
          ['ZD', 'Zone dangereuse'],
        ],
      },
    ],
  },
];
