/**
 * Mémo AP LAM / AP S9, reformulé d'après le « Livret technique AP-LAM / AP-S9 » (ETF Services / Feroway, version 2).
 * OP 485, 486, 489, 491, MT 08143, la consigne LAM, la fiche de travail et les particularités locales priment toujours.
 */
import type { MemoSection } from '../asp/memo';

export const MEMO_LAM: MemoSection[] = [
  {
    id: 'lam-role',
    titre: 'L’AP LAM et son engin',
    resume: '1 à 3 LAM groupés, sécurité du personnel et des circulations',
    blocs: [
      {
        t: 'p',
        text: 'L’agent prestataire LAM assure la sécurité du déplacement et des opérations de mise en voie et hors voie d’un à trois LAM au maximum (wagons automoteurs, mini-pelles et engins semblables compris). Mission de sécurité du personnel et des circulations.',
      },
      {
        t: 'list',
        items: [
          'Les LAM restent groupés, sans s’isoler, et dans son champ de vision (tracé, profil, visibilité, météo).',
          'Un LAM a un moteur et se déplace seul sur le rail : MRT, pelle rail-route, débroussailleuse, 4 axes…',
          'Un LAM est numéroté et agréé. Un lorry à main n’est pas un LAM.',
          'Un LAM n’assure pas le fonctionnement normal des circuits de voie.',
          'En mode route, il n’est plus guidé par les rails : il peut engager le gabarit de la voie contiguë, même avec ses limiteurs.',
        ],
      },
      { t: 'warn', text: 'Les missions de sécurité se font séparées dans le temps : jamais AP LAM et AP S9 en même temps.' },
    ],
  },
  {
    id: 'lam-perimetre',
    titre: 'Périmètre et voies interdites',
    resume: 'Une ZCh de la DFV, S9, consigne LAM',
    blocs: [
      {
        t: 'list',
        items: [
          'Mise en voie, travail et mise hors voie sur une zone de chantier (ZCh) de la DFV.',
          'Pas de transfert d’une ZCh à une autre ni d’acheminement ; entre ZCh adjacentes seulement si le contrat de travaux le prévoit.',
          'Voie électrifiée : toutes les voies que le LAM (ou une de ses parties) peut atteindre font l’objet des mesures.',
          'Toutes les voies dont la ZD peut être engagée font l’objet des mesures.',
          'Mise en voie, circulation et utilisation seulement sous couvert d’une mesure S9 et sur ordre écrit ou par dépêche du CCh (consigne LAM).',
        ],
      },
      {
        t: 'kv',
        rows: [
          ['LGV', 'Interdit au-delà de 220 km/h'],
          ['Déclivité', 'Interdit au-delà de 35 ‰'],
          ['3e rail', 'Lignes électrifiées par 3e rail interdites'],
          ['Triage', 'Bosses et voies à freins de voie interdites'],
          ['Chariots transbordeurs', 'Interdits'],
        ],
      },
      { t: 'p', text: 'Sauf cas exceptionnels, après étude spécifique.' },
    ],
  },
  {
    id: 'lam-chantier',
    titre: 'Mode de déplacement chantier',
    resume: '30 km/h maximum, klaxon, 100 m',
    blocs: [
      {
        t: 'list',
        items: [
          'Être en tête du mouvement, ou voir la voie dans le sens du mouvement, et en relation avec le ou les LAM.',
          'Avancer avec prudence, prêt à obéir aux signaux rencontrés ou faits.',
          'Adapter la vitesse à la voie aperçue, sans dépasser 30 km/h (freinage, profil, obstacles, personnel).',
          'Klaxon avant chaque démarrage.',
          'Surveiller la voie, pouvoir attirer l’attention des personnes, s’arrêter si la voie n’est pas dégagée.',
        ],
      },
      { t: 'warn', text: 'Entre le point de mise en voie et la zone de travail : au moins 100 m avec le mobile qui précède.' },
      {
        t: 'p',
        text: 'Les SAM sont toujours respectés : arrêt du LAM, aucun SAM franchi. L’AP LAM est dispensé de tenir compte des autres signaux fixes, mais évite que l’engin abîme les installations de sécurité ou actionne les détecteurs (sinon, il demande les consignes au CCh).',
      },
    ],
  },
  {
    id: 'lam-limiteurs',
    titre: 'Limiteurs et zone d’évolution',
    resume: 'Électrique d’abord, mécanique en secours',
    blocs: [
      {
        t: 'p',
        text: 'Les limiteurs de débattement et de rotation sont en service dès que la ou les voies contiguës sont circulées. Leur mise en œuvre et leur vérification sont de la responsabilité du conducteur ; l’AP LAM le vérifie.',
      },
      {
        t: 'list',
        items: [
          'Le limiteur électrique arrête le mouvement en premier ; le mécanique rattrape s’il est défaillant.',
          'Certaines machines agréées ont deux limiteurs électriques ou électrohydrauliques (voir la fiche d’agrément dans l’engin).',
          'Réglage par retrait de la clé à la hauteur voulue ou par programmation.',
        ],
      },
      {
        t: 'kv',
        rows: [
          ['Caténaire à 5 m ou plus', 'Hauteur max. 4,28 m (exemple du livret)'],
          ['Zone bleue, caténaire à moins de 5 m', 'Hauteur max. 3,92 m (exemple du livret)'],
          ['Bielle en position bleue', 'Travail caténaire alimentée, y compris zone bleue'],
          ['Bielle en position rouge', 'Travail caténaire mise hors tension'],
        ],
      },
      {
        t: 'p',
        text: 'Zone d’évolution : distance de freinage de l’engin à sa vitesse de travail et diagramme des parties mobiles et des charges. Le conducteur la communique à l’AP LAM et à l’ASP. Tout agent dans la zone d’évolution porte un casque.',
      },
    ],
  },
  {
    id: 'lam-agres',
    titre: 'Vérifications avant mise en voie',
    resume: 'Agrément, agrès, fiche quotidienne',
    blocs: [
      {
        t: 'list',
        items: [
          'Agrément : un numéro d’agrément est indiqué sur le LAM et sa date de validité est respectée.',
          'Limiteurs en service et opérationnels ; fiche quotidienne du conducteur : organes de sécurité, freinage, arrêt d’urgence, avertisseur sonore.',
        ],
      },
      {
        t: 'table',
        head: ['Agrès du LAM', 'Validité'],
        rows: [
          ['2 cales en bois dur', ''],
          ['1 boîte de six pétards', '17 ans'],
          ['2 drapeaux rouges', ''],
          ['1 torche à flamme rouge', '6 ans'],
          ['1 barre de court-circuit', '1 an'],
          ['1 lanterne de bord, feu blanc et feu rouge', ''],
        ],
      },
      { t: 'warn', text: 'Agrès absents ou agrément en défaut : l’AP LAM interdit l’utilisation de l’engin et avise le CCh.' },
    ],
  },
  {
    id: 'lam-mev',
    titre: 'Mise en voie et hors voie',
    resume: 'ARF, consigne LAM, 5 minutes',
    blocs: [
      {
        t: 'p',
        text: 'Avant d’autoriser la mise en voie ou hors voie, l’AP LAM a l’assurance : interception de la voie du LAM, interception de la voie contiguë si la ZD peut être engagée, mise hors tension de la voie de travail et de la contiguë si nécessaire.',
      },
      {
        t: 'list',
        items: [
          'Mise en voie ou hors voie rapide : au-delà de 5 minutes, il contacte le CCh (mesures en plus vis-à-vis de la route).',
          'Mise hors tension et zone de chantier en service : assurance obtenue en consultant l’ARF (présentée par le RCE).',
          'Consigne LAM reçue du CCh, avec la situation géographique si la réglementation S9 l’impose ; autorisation de mise en voie portée sur la consigne.',
          'Il renseigne le conducteur : limites de la ZCh, balisage, arrêt au SAM, cales pour franchir les détecteurs d’annonce de PN.',
          'Puis il donne verbalement l’autorisation de mettre en voie.',
        ],
      },
      {
        t: 'p',
        text: 'Mise hors voie : autorisation reçue du CCh ; autorisation verbale au conducteur avec le lieu et les conditions de garage ; aviser le CCh que le LAM est hors voie et stationné ; restituer la consigne LAM.',
      },
      {
        t: 'p',
        text: 'Cas particuliers, s’ils sont inscrits au document de coactivité (ISF, plan de prévention) : sans mise hors tension si l’agrément le prévoit, sans interception de la contiguë en entrevoie très large. CCh présent au point de mise en voie : autorisation verbale directe possible pour la contiguë, si le document d’organisation le décrit.',
      },
    ],
  },
  {
    id: 'lam-pn-route',
    titre: 'Mise en voie au PN',
    resume: 'CSR, agent K1 ou R24, barrières',
    blocs: [
      {
        t: 'list',
        items: [
          'Faire présenter la signalisation lumineuse du PN avec le CSR ou le M/A.',
          'Un agent au PN avec un signal K1 ou un feu R24 à main arrête les véhicules en amont de l’engin.',
          'Faire relever les barrières à la main ou à la manivelle (SAL 2, SAL 4) pour laisser passer l’engin.',
          'LAM en voie et dégagé du PN (et de la zone courte) : faire ouvrir le PN avec le CSR (ou le M/A).',
        ],
      },
      {
        t: 'p',
        text: 'Pour intervenir sur le PN : soit un agent dédié au PN et l’AP LAM suit ses consignes ; soit la consigne LAM l’y autorise et il est aussi agent PN ; soit il appelle le CCh.',
      },
      { t: 'warn', text: 'Fermer le PN par la zone courte est interdit avec un LAM : il ne garantit pas le fonctionnement du circuit de voie.' },
    ],
  },
  {
    id: 'lam-deplacement',
    titre: 'SAM, PN et appareils de voie',
    resume: 'Jamais de SAM franchi, talonnage interdit',
    blocs: [
      {
        t: 'list',
        items: [
          'SAM à franchir : arrêter le LAM et appeler le CCh pour le faire retirer. Jamais de sa propre initiative.',
          'SAM de repérage d’une autre activité : après entente avec l’agent d’activité ou l’agent PN, il fait franchir le SAM de repérage si c’est autorisé.',
          'SAM de limite d’utilisation : maintenir l’arrêt et appeler le chef de chantier.',
          'PN : appliquer les mesures de la consigne LAM ou de la fiche de travail.',
          'Appareil de voie : l’AP LAM est en tête ; il vérifie la position et le collage des aiguilles (et le cœur à pointe mobile).',
          'Doute : arrêter le LAM et appeler le CCh. Appareil à manœuvrer : demande verbale au CCh et attendre son autorisation.',
        ],
      },
      { t: 'warn', text: 'Le talonnage des appareils de voie est interdit, talonnables ou non.' },
    ],
  },
  {
    id: 'lam-stationnement',
    titre: 'Stationnement du LAM',
    resume: '0,70 m de la ZD, pas sous un feeder',
    blocs: [
      {
        t: 'list',
        items: [
          'Garé à au moins 0,70 m de la zone dangereuse, en laissant le garage et le passage.',
          'Sol stable, freiné et calé pour qu’il ne reparte pas.',
          'Garé dans la piste : pancarte « Piste interrompue » prévue par l’organisateur.',
          'Ne masque ni la signalisation ferroviaire ou routière, ni la visibilité des usagers à un PN à croix de Saint-André ou piéton.',
          'Pas sous un feeder ni en zone bleue (caténaire à 5 m ou moins du plan de roulement).',
          'Toute pollution laissée en voie (fuite d’huile…) est signalée au CCh.',
        ],
      },
    ],
  },
  {
    id: 'lam-personnel',
    titre: 'Sécurité du personnel',
    resume: 'Casque, entrevoie, 1,60 m',
    blocs: [
      {
        t: 'list',
        items: [
          'L’AP LAM suit les prescriptions de l’ASP.',
          'Tout accès côté entrevoie est condamné.',
          'Ne jamais monter ni descendre d’un engin en mouvement.',
          'Pas de nacelle ni d’engin de levage par grand vent.',
          'Traversée du personnel dans la zone d’évolution : l’AP LAM demande et obtient l’arrêt du LAM.',
          'Pas de train de lorrys (attelage, réunion d’engins), sauf si l’agrément le permet.',
          'LAM sans place pour l’AP LAM : il l’accompagne au sol et fait adapter la vitesse à son pas ; en cabine double, seulement en déplacement.',
          'LAM télécommandé : le conducteur ne franchit pas la file de rail côté contiguë ; entrevoie seulement avec l’accord de l’ASP.',
        ],
      },
      { t: 'warn', text: 'Risque d’électrocution : interdit de monter sur les parties hautes non protégées, à plus de 1,60 m du plan de roulement.' },
    ],
  },
  {
    id: 'lam-electrique',
    titre: 'Risque électrique',
    resume: 'Tout est sous tension sauf assurance du contraire',
    blocs: [
      { t: 'warn', text: 'Tout conducteur électrique, nu ou isolé, est considéré sous tension sauf assurance du contraire.' },
      {
        t: 'list',
        items: [
          'Conducteur tombé : s’écarter sans précipitation, protéger les circulations si le gabarit est engagé, empêcher d’autres personnes d’approcher, faire couper d’urgence.',
          'Électrocution ou électrisation par contact direct, indirect (objet, jet, flamme) ou par amorçage, plus facile par brouillard, vapeur ou fumée.',
          'Interdit : approcher un support qui grésille ou fait des étincelles, entrer dans un local électrique, intervenir sur une installation, monter aux poteaux, travailler dehors par orage.',
          'Interdit : faire du feu près des lignes, jeter de l’eau, utiliser une lance à eau, uriner sur les installations.',
          'Le retour du courant de traction passe par les rails : sa continuité est toujours assurée.',
        ],
      },
      {
        t: 'kv',
        rows: [
          ['Zone 0', 'Emprises accessibles à tous les agents'],
          ['Zone 1', 'Agents avertis et formés au risque électrique'],
          ['Zone 2', 'Habilités C0, ou formés sous surveillance d’un C0'],
          ['Zone 3', 'Caténaires et habilités C0 autorisés aux mesures complémentaires'],
        ],
      },
      { t: 'p', text: 'Mise hors tension = consignation (tension supprimée, réalimentation empêchée) ET mesures de protection contre toute tension résiduelle.' },
    ],
  },
  {
    id: 's9-role',
    titre: 'L’AP S9 et sa mission',
    resume: 'S9A, S9B, habilitation TES M',
    blocs: [
      {
        t: 'p',
        text: 'L’AP S9 met en œuvre des mesures du RPTx ou du CCh : bouclage de la ZCh, repérage de points particuliers. Mission de sécurité des circulations, toujours sur ordre par dépêche.',
      },
      {
        t: 'kv',
        rows: [
          ['S9A', 'Poser des outils de bouclage ou de protection (commutateur de blocage, DSh, SAM, pétards), vérifier la libération de la ZCh'],
          ['S9B', 'Déposer momentanément un bouclage pour un mobile travaux, lever le SAM au point de dégagement, porter les CCBD ou consignes LAM, vérifier un itinéraire'],
        ],
      },
      {
        t: 'list',
        items: [
          'Tâche de sécurité autre qu’essentielle ; l’AP S9 se déplace seul et peut engager la ZD : habilitation TES M (annonceur + ASP) obligatoire.',
          'Il connaît les particularités locales comme pour l’annonce.',
          'Cumul interdit : aucune autre mission pendant la mission S9 (avant ou après, possible selon l’organisation).',
          'Il fait tout ce qui est écrit sur sa fiche de travail, uniquement cela. Fiches individuelles, jamais échangées sans accord SNCF et du chef d’équipe.',
          'Briefing obligatoire ; au moindre doute, il alerte le CCh ou son chef d’équipe avant de faire.',
        ],
      },
    ],
  },
  {
    id: 's9-dsh',
    titre: 'Dispositif de shuntage (DSh)',
    resume: 'Interdictions et 10 gestes de pose',
    blocs: [
      { t: 'p', text: 'Posé et retiré sur ordre par dépêche du CCh, selon la situation géographique et la fiche de travail.' },
      {
        t: 'list',
        items: [
          'Interdit dans les 30 m en aval d’un signal.',
          'Interdit dans la zone d’incertitude de shuntage (cornière dans l’axe de la voie ou tuyau plastique contre l’âme du rail).',
          'Interdit si la table de roulement est oxydée, sur LGV, ou si le DSh est en mauvais état.',
          'Interdit s’il ferme un PN à SAL, perturbe une TVP ou dérange les annonces d’un PN gardé (schéma de ligne).',
          'Zone d’annonce de PN par CdV seuls : interdit ; par pédales + CdV : seulement sans circulation ou après réarmement par le dernier train.',
          'Jamais pour assurer le retour du courant de traction. Sur les rails en service, pas sur un rail de sécurité ou un LRS en attente.',
        ],
      },
      {
        t: 'table',
        head: ['Pose, gants obligatoires', ''],
        rows: [
          ['1', 'Vérifier l’intégrité : câbles, pinces, griffes, gaines'],
          ['2', 'Vérifier la date de validité'],
          ['3', 'Vérifier la vis de contact (pointeau)'],
          ['4', 'Brosser le patin du rail à la brosse métallique'],
          ['5', 'Vis pointeau plus haute que les griffes'],
          ['6', 'Appliquer le cé jusqu’à la butée'],
          ['7', 'Serrer la vis jusqu’à la première application'],
          ['8', 'Encore 3 tours (ou 6 demi-tours)'],
          ['9', 'Recommencer de l’autre côté'],
          ['10', 'Mettre les pinces de chaque côté'],
        ],
      },
      { t: 'warn', text: 'Autocontrôle systématique avant chaque pose ou dépose (DSh, commutateur, SAM, pétards).' },
      { t: 'p', text: 'DSh connectés (OSI) : posés et activés par la SNCF ; en situation dégradée, l’AP S9 peut poser un DSh « normal ».' },
    ],
  },
  {
    id: 's9-sam',
    titre: 'SAM, pétards et commutateur de blocage',
    resume: 'Ordre de retrait et de remise, rouge = fermé',
    blocs: [
      {
        t: 'list',
        items: [
          'SAM de jour : drapeau rouge déployé ou jalon à damier rouge et blanc ; de nuit : feu rouge d’un jalon, d’une lanterne ou d’un dispositif autorisé.',
          'Emplacement des SAM et pétards : la situation géographique. Pétard fixé avec les griffes de chaque côté du rail.',
          'Seulement les SAM demandés sur la fiche de travail. Au retrait, autocontrôle pour ne pas oublier le pétard en voie.',
        ],
      },
      {
        t: 'table',
        head: ['Passage d’un TTx (accord par dépêche)', 'Ordre'],
        rows: [
          ['Retrait momentané', 'Pinces, pétard, SAM, puis dépêche'],
          ['Remise', 'SAM, pétard, pinces, puis dépêche'],
        ],
      },
      {
        t: 'kv',
        rows: [
          ['Commutateur de blocage', 'Sur ordre du CCh par dépêche, clé de Berne, autocontrôle du bon commutateur'],
          ['Ouvert', 'Vert'],
          ['Fermé', 'Rouge'],
          ['Après manœuvre', 'Cadenas du commerce (l’AP S9 garde la clé) et fanion de l’entreprise'],
        ],
      },
      { t: 'p', text: 'Observation : à la demande du CCh ou du RPTx, vérifier un signal, un voyant (PN…) ou la libération d’une voie ou d’une zone, comme décrit sur la fiche de travail.' },
    ],
  },
  {
    id: 's9-depeches',
    titre: 'Échanger par dépêche',
    resume: 'Dicter, écrire, répéter, numéros au hasard',
    blocs: [
      {
        t: 'list',
        items: [
          'L’émetteur dicte, le récepteur écrit (sur papier vierge ou document préimprimé : consigne LAM, fiche de travail).',
          'Le récepteur répète tout, même le préimprimé.',
          'Si c’est correct, l’émetteur dit « Correct » et donne un numéro pris au hasard, sans suite avec les autres.',
          'Le récepteur note ce numéro et en donne un à son tour, au hasard lui aussi.',
          'Chacun note l’heure à sa propre montre.',
        ],
      },
      {
        t: 'table',
        head: ['Bouclage A3 (exemple du livret)', 'Numéros'],
        rows: [
          ['RPTx demande la mise en place', 'donne 93'],
          ['AP S9 confirme avoir reçu l’ordre', 'reçoit 93, donne 24'],
          ['AP S9 confirme la mise en place (après la pose)', 'donne 45'],
          ['RPTx confirme la mise en place', 'reçoit 45, donne 36'],
        ],
      },
      { t: 'p', text: 'Même enchaînement pour le retrait : demande, accusé de réception, puis confirmation après le retrait physique et sa validation.' },
      { t: 'p', text: 'Collationner : faire répéter le message à son interlocuteur et le valider par un numéro.' },
      { t: 'p', text: 'Interlocuteurs de l’AP S9 : RPTx et CCh (privilégiés) des voies de travail et contiguës, ASP. Tous les échanges se font par dépêche.' },
    ],
  },
  {
    id: 'lam-urgences',
    titre: 'Urgences',
    resume: 'Arrêt d’urgence, S2B, CCh',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Conducteur défaillant, danger grave', 'Arrêt d’urgence du LAM si possible ; gabarit engagé : S2B ou maintenir la ZCh ; appeler le CCh'],
          ['SAM franchi', 'Arrêter et immobiliser d’urgence ; S2B ; appeler le CCh'],
          ['Gabarit engagé, point protégé engagé', 'S2B ; appeler le CCh'],
          ['Dérive', 'S2B ; prévenir d’urgence tout le personnel vers lequel le lorry dérive ; appeler le CCh'],
          ['Vitesse excessive', 'Faire arrêter d’urgence le LAM ; appeler le CCh'],
        ],
      },
      {
        t: 'p',
        text: 'S2B, protection des obstacles inopinés : arrêter les trains (alerte radio, torche, coupure d’urgence, barre de court-circuit, commutateurs) puis couvrir l’obstacle en allant au-devant du premier train attendu.',
      },
    ],
  },
  {
    id: 'lam-aleas',
    titre: 'Aléas',
    resume: 'Le CCh décide, par écrit ou dépêche',
    blocs: [
      {
        t: 'list',
        items: [
          'Conducteur qui ne respecte pas les consignes : arrêt du LAM, vérifier gabarit et point protégé, prévenir le CCh puis le RSNCF ou RSO. Seul le CCh autorise la reprise.',
          'Panne : aviser le CCh pour le secours, pas de train de lorrys ; repliement dans le gabarit en moins de 15 minutes.',
          'Point de mise en voie ou hors voie, ou zone d’action du LAM à changer : jamais de soi-même ; le CCh étudie, refait un briefing et autorise par écrit ou dépêche.',
          'Installation ou câble endommagé : aviser le CCh, empêcher toute approche d’un câble arraché.',
          'Changement d’organisation : le CCh présente la dérogation, prend en compte les demandes de l’AP LAM et remet une nouvelle consigne LAM.',
          'AP S9 : aviser le CCh ou le RPTx ; jamais modifier la prestation sans autorisation écrite.',
        ],
      },
    ],
  },
  {
    id: 'lam-organisation',
    titre: 'Organisation et documents',
    resume: 'PPSPS, plan de prévention, ARF, passants',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Décret 94', 'Coordination SPS : PGC, inspection commune, PPSPS commenté aux salariés'],
          ['Décret 92', 'Plan de prévention établi en commun'],
          ['Consigne LAM', 'Obligatoire (sauf si l’agent LAM est le CCh de la voie de travail) ; une seule pour un groupe de LAM'],
          ['ARF', 'Présentée par le RCE : mise hors tension, interdictions de circulation'],
          ['Situation géographique', 'Limites de la ZCh, de l’activité du LAM, repérage des PN à franchir'],
          ['RSNCF', 'Passant gris'],
          ['RCE', 'Passant vert'],
        ],
      },
    ],
  },
  {
    id: 'lam-zones',
    titre: 'Zone dangereuse et garages',
    resume: '1,50 m, 2 m, garage 0,70 m',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['Jusqu’à 40 km/h', '1,25 m si la consigne d’établissement le prévoit'],
          ['Jusqu’à 160 km/h', '1,50 m'],
          ['Au-delà de 160 km/h', '2 m'],
          ['Garage', '0,70 m de large au moins, hors ZD'],
          ['Garage réduit', '0,50 m'],
          ['Entrevoie large', 'ZD + ZD + 0,70 m'],
        ],
      },
      { t: 'p', text: 'Amont : rencontré avant, dans le sens considéré. Aval : rencontré après.' },
    ],
  },
  {
    id: 'lam-sigles',
    titre: 'Sigles',
    resume: 'AP LAM, CCh, RPTx, ZCh…',
    blocs: [
      {
        t: 'kv',
        rows: [
          ['AP LAM', 'Agent prestataire lorry automoteur'],
          ['AP S9', 'Agent prestataire S9'],
          ['ARF', 'Délivrée par le RSNCF ou le RSO au RCE, présentée à l’AP LAM : mesures de prévention en place'],
          ['CCh', 'Chef de chantier'],
          ['CmB', 'Commutateur de blocage'],
          ['DFV', 'Demande de fermeture de voie'],
          ['DSh', 'Dispositif de shuntage'],
          ['LAM', 'Lorry automoteur'],
          ['MeV / MhV', 'Mise en voie / mise hors voie'],
          ['RCE', 'Responsable chantier de l’entreprise'],
          ['RPTx', 'Responsable de planche travaux'],
          ['RSO', 'Représentant de la sécurité opérationnelle'],
          ['TTx', 'Train travaux'],
          ['ZCh', 'Zone de chantier'],
          ['ZD', 'Zone dangereuse'],
          ['ZEP', 'Zone élémentaire de protection'],
        ],
      },
    ],
  },
];

/** Règles clés qui défilent sur l'accueil. */
export const REGLES_LAM = [
  'Mode chantier : 30 km/h maximum, klaxon à chaque démarrage',
  '100 m au moins avec le mobile qui précède',
  'Aucun SAM franchi : arrêt et appel au CCh',
  'Talonnage des aiguilles interdit',
  'Mise en voie de plus de 5 minutes : appeler le CCh',
  'Stationnement : 0,70 m de la ZD, jamais sous un feeder',
  'DSh interdit dans les 30 m en aval d’un signal',
  'TTx : pinces, pétard, SAM… puis SAM, pétard, pinces',
  'Commutateur de blocage : rouge = fermé, vert = ouvert',
  'Dépêche : répéter, puis numéro au hasard, sans suite',
];
