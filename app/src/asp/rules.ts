/**
 * Calcul du délai et de la distance d'annonce (fiche CADA), d'après le support de formation TES M – compétence ASP.
 *
 * Aide au calcul seulement : l'ASP reste responsable de son dispositif, et les textes SNCF Réseau, les consignes
 * locales et les particularités locales priment toujours sur ce calcul.
 */

/** Catégorie d'outillage. */
export type Outillage = 'aucun' | 'cat1' | 'cat2' | 'cat3';

/** Sens des circulations sur une voie, repéré par rapport aux PK. */
export type Sens = 'croissant' | 'decroissant' | 'deux';

/** Un seul sens de marche : les circulations vont vers les PK croissants ou décroissants. */
export type SensSimple = 'croissant' | 'decroissant';

/**
 * Place de la voie par rapport au chantier.
 * - travail : les agents travaillent sur cette voie ;
 * - contigue : voie voisine dont la zone dangereuse (ZD) risque d'être engagée ;
 * - traversee : voie à franchir pour rejoindre l'emplacement de garage ;
 * - hors : aucun risque d'engagement, la voie n'est pas annoncée.
 */
export type RoleVoie = 'travail' | 'contigue' | 'traversee' | 'hors';

export interface Voie {
  id: string;
  /** V1, V2, V1bis, VU… */
  nom: string;
  sens: Sens;
  /** Vitesse maximale des circulations (km/h). */
  vitesse: number | null;
  role: RoleVoie;
  /** Voie interdite à la circulation (DFV obtenue) : elle sort du dispositif d'annonce. */
  interdite: boolean;
}

/** Ce qui change les règles : chaque case correspond à une ligne du support de formation. */
export interface Particularites {
  /** Chantier de nuit. */
  nuit: boolean;
  /** Soudage à l'arc, meulage de rail ou perceuse type bicyclette (outillage de 1re catégorie). */
  soudageMeulage: boolean;
  /** Un obstacle peut masquer, même un moment, l'approche d'une circulation de courte longueur. */
  obstacleMasquant: boolean;
  /** Un annonceur surveille l'approche des circulations dans les 2 sens. */
  annonceur2Sens: boolean;
  /** L'ASP surveille lui-même l'approche des circulations. */
  aspAnnonceLuiMeme: boolean;
  /** Agents sur les voies intérieures d'une plateforme de plus de 2 voies, séparés du garage par une ou plusieurs voies. */
  voiesInterieures: boolean;
  /** Clôture (barrière d'entrevoie) à caractère limitatif. */
  clotureLimitative: boolean;
  /** Clôture à caractère défensif (confinement). */
  clotureDefensive: boolean;
  /** Travail à bord d'un engin à parois ou écrans (confinement). */
  enginParois: boolean;
  /** L'analyse a priori montre qu'il n'y a aucun risque d'engager la ZD, à aucun moment. */
  analyseSansRisque: boolean;
  /** La ZD n'est engagée que par inadvertance (involontairement). */
  engagementInadvertance: boolean;
  /** Garage difficile : tunnel, viaduc ou pont-rail sans accotement, quai haut ou mi-haut, garage non contigu. */
  garageDifficile: boolean;
  /** Voie banalisée, VUT organisée ou TCT. */
  banaliseVutTct: boolean;
  /** IPCS (ICS) sans DPCS obtenue. */
  icsSansDpcs: boolean;
  /** Ligne à grande vitesse. */
  lgv: boolean;
  /** Zone bruyante (routes, usines, aérodromes… : consigne d'établissement). */
  zoneBruyante: boolean;
  /** Chantier bruyant (outillage ou engins ≥ 80 dB(A) par jour, ou crête ≥ 135 dB(A)). */
  chantierBruyant: boolean;
  /** Travail en tunnel. */
  tunnel: boolean;
  /** La distance de visibilité minimale n'est pas obtenue. */
  visibiliteInsuffisante: boolean;
  /** Interdiction de circulation prévue à la préparation ou par consigne locale. */
  dfvPrevue: boolean;
  /** Agent seul : il surveille lui-même l'approche des circulations. */
  agentSeul: boolean;
}

export const AUCUNE_PARTICULARITE: Particularites = {
  nuit: false,
  soudageMeulage: false,
  obstacleMasquant: false,
  annonceur2Sens: false,
  aspAnnonceLuiMeme: false,
  voiesInterieures: false,
  clotureLimitative: false,
  clotureDefensive: false,
  enginParois: false,
  analyseSansRisque: false,
  engagementInadvertance: false,
  garageDifficile: false,
  banaliseVutTct: false,
  icsSansDpcs: false,
  lgv: false,
  zoneBruyante: false,
  chantierBruyant: false,
  tunnel: false,
  visibiliteInsuffisante: false,
  dfvPrevue: false,
  agentSeul: false,
};

export type TypeChantier = 'fixe' | 'mobile' | 'itinerant';

/** Données du calcul. Les PK sont en kilomètres (12,3 = 12+300). */
export interface Entree {
  outillage: Outillage;
  /** Délai de dégagement en secondes (0 = nul), ou null s'il n'est pas encore choisi. */
  dd: number | null;
  p: Particularites;
  voies: Voie[];
  /** Zone de travail : la limite amont dépend du sens de chaque voie. */
  pkDebut: number | null;
  pkFin: number | null;
  type?: TypeChantier;
}

/** Où se trouve le chantier par rapport aux voies annoncées : chaque cas a son tableau de marges. */
export type Situation = 'circulee' | 'interdite' | 'proximite';

export const SITUATION_LABEL: Record<Situation, string> = {
  circulee: 'Travaux sur voie circulée',
  interdite: 'Travaux sur voie interdite à la circulation',
  proximite: 'Travaux hors ZD, à proximité de la ZD',
};

export interface Alerte {
  /** stop : à régler avant d'engager ; attention : à vérifier ; info : rappel. */
  niveau: 'stop' | 'attention' | 'info';
  texte: string;
}

export interface ResultatVoie {
  voieId: string;
  voie: string;
  sens: SensSimple;
  vitesse: number;
  /** Délai d'annonce retenu pour cette voie (au moins 10 s au-delà de 160 km/h). */
  da: number;
  /** Distance d'annonce (m), arrondie à la dizaine supérieure. */
  distance: number;
  /** Limite amont de la zone de travail pour ce sens (PK, km). */
  limiteAmont: number | null;
  /** Point d'annonce (PK, km) : là où l'annonce doit être déclenchée. */
  pointAnnonce: number | null;
  note?: string;
}

export interface Resultat {
  situation: Situation;
  /** Raisons qui rendent l'interdiction de circulation obligatoire (mesure S9) sur la voie de travail. */
  dfv: string[];
  /** Cas où l'annonce n'est pas obligatoire (confinement, analyse de risques…), sinon null. */
  exemption: string | null;
  dd: { saisi: number | null; retenu: number | null; erreurs: string[]; conseils: string[] };
  ms: { valeur: number; raisons: string[] };
  /** Délai d'annonce de base (DD + MS), avant le minimum de 10 s au-delà de 160 km/h. */
  da: number | null;
  voies: ResultatVoie[];
  alertes: Alerte[];
}

/* ---------- Distance d'annonce ---------- */

/**
 * Distance parcourue par une circulation à cette vitesse pendant ce délai, arrondie à la dizaine de mètres
 * supérieure : c'est la règle des tableaux de distances d'annonce (160 km/h et 20 s → 888,9 m → 890 m).
 * Calcul en nombres entiers : V (km/h) × t (s) / 3,6 = V × t / 36 dizaines de mètres.
 */
export function distanceAnnonce(vitesse: number, delai: number): number {
  if (!(vitesse > 0) || !(delai > 0)) return 0;
  const v = Math.round(vitesse);
  const t = Math.round(delai);
  return Math.ceil((v * t) / 36) * 10;
}

/** Délai d'annonce minimal sur les lignes parcourues à plus de 160 km/h (sans dépasser 200, ou 220 pour les TGV). */
export const DA_MIN_GRANDE_VITESSE = 10;

/* ---------- Outils ---------- */

const OUTILLAGE_LABEL: Record<Outillage, string> = {
  aucun: 'sans outillage',
  cat1: 'outillage de 1re catégorie (portatif)',
  cat2: 'outillage de 2e catégorie (facilement déraillable)',
  cat3: 'outillage de 3e catégorie (fait obstacle)',
};
export const outillageLabel = (o: Outillage) => OUTILLAGE_LABEL[o];

/** Voies annoncées : celles où des circulations peuvent survenir et dont la ZD risque d'être engagée. */
export function voiesAnnoncees(voies: Voie[]): Voie[] {
  return voies.filter((v) => v.role !== 'hors' && !v.interdite);
}

/** Sens à surveiller sur une voie. */
function sensDe(v: Voie): SensSimple[] {
  return v.sens === 'deux' ? ['croissant', 'decroissant'] : [v.sens];
}

/** Cas du chantier, déduit de la place des voies : il choisit le tableau des marges de sécurité. */
function situationDe(voies: Voie[]): Situation {
  const travail = voies.filter((v) => v.role === 'travail');
  if (travail.some((v) => !v.interdite)) return 'circulee';
  if (travail.length) return 'interdite';
  return 'proximite';
}

/** Limite amont de la zone de travail : le point du chantier que la circulation atteint en premier. */
export function limiteAmont(sens: SensSimple, pkDebut: number | null, pkFin: number | null): number | null {
  if (pkDebut === null || pkFin === null) return pkDebut ?? pkFin ?? null;
  return sens === 'croissant' ? Math.min(pkDebut, pkFin) : Math.max(pkDebut, pkFin);
}

/** Point d'annonce : en amont de la zone, de la distance d'annonce (PK en km, arrondi au mètre). */
export function pointAnnonce(sens: SensSimple, amont: number | null, distance: number): number | null {
  if (amont === null) return null;
  const pk = sens === 'croissant' ? amont - distance / 1000 : amont + distance / 1000;
  return Math.round(pk * 1000) / 1000;
}

/* ---------- Le calcul ---------- */

export function calculer(e: Entree): Resultat {
  const p = e.p;
  const alertes: Alerte[] = [];
  const situation = situationDe(e.voies);
  const annoncees = voiesAnnoncees(e.voies);
  const travailCirculee = e.voies.filter((v) => v.role === 'travail' && !v.interdite);
  const vTravail = Math.max(0, ...travailCirculee.map((v) => v.vitesse ?? 0));
  const vAnnoncees = Math.max(0, ...annoncees.map((v) => v.vitesse ?? 0));

  /* Interdiction de circulation obligatoire (sur la voie de travail circulée). */
  const dfv: string[] = [];
  if (travailCirculee.length) {
    if (e.outillage === 'cat3') dfv.push('Outillage de 3e catégorie : il fait obstacle à la circulation.');
    if (p.visibiliteInsuffisante) dfv.push('La distance de visibilité minimale n’est pas obtenue.');
    if (p.dfvPrevue) dfv.push('Interdiction prévue à la préparation du chantier ou par consigne locale.');
    if (e.outillage === 'cat2') {
      const cas: string[] = [];
      if (p.nuit) cas.push('de nuit');
      if (p.banaliseVutTct) cas.push('voie banalisée, VUT organisée ou TCT');
      if (p.icsSansDpcs) cas.push('IPCS sans DPCS obtenue');
      if (p.garageDifficile) cas.push('garage difficile (tunnel, pont-rail sans accotement, quai haut ou mi-haut, garage non contigu)');
      if (e.dd !== null && e.dd > 15) cas.push('délai de dégagement de plus de 15 s');
      if (vTravail > 160) cas.push('vitesse de plus de 160 km/h');
      if (p.lgv) cas.push('LGV');
      for (const c of cas) dfv.push(`Outillage de 2e catégorie, ${c}.`);
    }
    if (vTravail > 160 && e.outillage !== 'aucun' && e.outillage !== 'cat1' && !dfv.some((d) => d.includes('160 km/h'))) {
      dfv.push('Au-delà de 160 km/h, seul l’outillage portatif (ou sans outillage) est permis sans interdiction de circulation.');
    }
  }
  if (dfv.length) {
    alertes.push({
      niveau: 'stop',
      texte: `Interdiction de circulation obligatoire sur la voie de travail (mesure S9) : ${dfv.map((d) => d.replace(/\.$/, '').toLowerCase()).join(' ; ')}.`,
    });
  }
  if (e.outillage === 'cat2' && p.banaliseVutTct && travailCirculee.length) {
    alertes.push({
      niveau: 'info',
      texte: 'Sur une ligne à une seule voie banalisée, un document d’application local peut permettre de travailler sans interdiction avec de l’outillage de 2e catégorie.',
    });
  }
  if (e.voies.some((v) => (v.vitesse ?? 0) > 220) || p.lgv) {
    alertes.push({
      niveau: 'stop',
      texte: 'LGV ou vitesse de plus de 220 km/h : les particularités LGV s’appliquent ; ce calcul ne les couvre pas.',
    });
  }

  /* Délai de dégagement. */
  const erreurs: string[] = [];
  const conseils: string[] = [];
  let ddRetenu: number | null = e.dd;
  const nulPermis = p.engagementInadvertance || p.clotureLimitative;
  if (e.dd === null || !Number.isFinite(e.dd)) {
    ddRetenu = null;
    erreurs.push('Saisis le délai de dégagement : il est choisi par le chef de chantier avec toi, puis testé par un essai.');
  } else if (e.dd < 0) {
    ddRetenu = null;
    erreurs.push('Un délai de dégagement ne peut pas être négatif.');
  } else if (e.dd === 0) {
    if (!nulPermis) {
      erreurs.push('Un délai de dégagement nul n’est possible que si la ZD n’est engagée que par inadvertance, ou avec une barrière d’entrevoie limitative.');
      ddRetenu = 5;
    } else if (p.soudageMeulage) {
      erreurs.push('Soudage ou meulage : le délai de dégagement est d’au moins 5 s, même avec une clôture limitative.');
      ddRetenu = 5;
    }
  } else if (e.dd < 5) {
    erreurs.push('Un délai de dégagement non nul est d’au moins 5 s.');
    ddRetenu = 5;
  } else if (nulPermis && !p.soudageMeulage) {
    conseils.push(
      p.clotureLimitative
        ? 'Avec une barrière d’entrevoie limitative, le délai de dégagement peut être nul : le délai d’annonce se réduit à la marge de sécurité.'
        : 'Si la ZD n’est engagée que par inadvertance, le délai de dégagement peut être nul.',
    );
  }
  if (e.outillage === 'cat2' && e.dd !== null && e.dd > 15) {
    erreurs.push('Avec de l’outillage de 2e catégorie, le délai de dégagement ne peut pas dépasser 15 s.');
  }
  if (e.dd !== null && e.dd > 0) {
    conseils.push('Tiens compte des facteurs défavorables : voies à traverser, niches ou refuges à rejoindre, obstacles.');
  }

  /* Marge de sécurité. */
  const ms = marge(e, situation);
  const da = ddRetenu === null ? null : ddRetenu + ms.valeur;

  /* Délai et distance d'annonce, pour chaque voie et chaque sens. */
  const voies: ResultatVoie[] = [];
  for (const v of annoncees) {
    for (const s of sensDe(v)) {
      const vitesse = v.vitesse ?? 0;
      let daVoie = da ?? 0;
      let note: string | undefined;
      if (vitesse > 160 && da !== null && da < DA_MIN_GRANDE_VITESSE) {
        daVoie = DA_MIN_GRANDE_VITESSE;
        note = `Délai porté à ${DA_MIN_GRANDE_VITESSE} s : voie parcourue à plus de 160 km/h.`;
      }
      const dist = da === null || !vitesse ? 0 : distanceAnnonce(vitesse, daVoie);
      const amont = limiteAmont(s, e.pkDebut, e.pkFin);
      voies.push({
        voieId: v.id,
        voie: v.nom || 'Voie',
        sens: s,
        vitesse,
        da: daVoie,
        distance: dist,
        limiteAmont: amont,
        pointAnnonce: dist ? pointAnnonce(s, amont, dist) : null,
        note,
      });
    }
  }
  if (annoncees.some((v) => !v.vitesse)) {
    alertes.push({ niveau: 'stop', texte: 'Indique la vitesse maximale de chaque voie annoncée (carte des vitesses, renseignements techniques).' });
  }
  if (!annoncees.length && e.voies.length) {
    alertes.push({
      niveau: 'attention',
      texte: 'Aucune voie à annoncer : toutes sont interdites à la circulation ou hors dispositif. Vérifie que c’est bien le cas (avis de voie interdite, cases S9).',
    });
  }
  if (vAnnoncees > 160 && e.outillage !== 'aucun' && e.outillage !== 'cat1' && situation === 'circulee') {
    // Déjà dans les raisons de DFV quand la voie de travail dépasse 160 km/h ; ici, c'est une voie voisine.
    if (vTravail <= 160) {
      alertes.push({
        niveau: 'attention',
        texte: 'Une voie annoncée est parcourue à plus de 160 km/h : vérifie dans les particularités locales l’emploi de l’outillage choisi.',
      });
    }
  }

  /* Annonce non obligatoire (3 cas). */
  let exemption: string | null = null;
  if (p.enginParois) exemption = 'Travaux à bord d’un engin à parois ou écrans : le personnel et l’outillage ne peuvent pas sortir du gabarit de l’engin côté entrevoie (confinement).';
  else if (p.clotureDefensive) exemption = 'Clôture à caractère défensif en place (confinement).';
  else if (p.analyseSansRisque && p.clotureLimitative)
    exemption = 'L’analyse a priori montre qu’il n’y a aucun risque d’engager la ZD, et une clôture limitative matérialise la limite de la ZD.';
  if (exemption) alertes.push({ niveau: 'info', texte: `Annonce non obligatoire : ${exemption}` });
  else if (p.analyseSansRisque && !p.clotureLimitative)
    alertes.push({ niveau: 'info', texte: 'Sans clôture limitative, l’absence de risque ne dispense pas de l’annonce.' });

  /* Agent seul. */
  if (p.agentSeul) {
    const obligeAnnonceur: string[] = [];
    if (p.zoneBruyante || p.chantierBruyant) obligeAnnonceur.push('intervention en zone bruyante');
    if (p.icsSansDpcs) obligeAnnonceur.push('IPCS sans DPCS');
    if (p.banaliseVutTct) obligeAnnonceur.push('voie banalisée, VUT ou TCT');
    if (p.nuit) obligeAnnonceur.push('chantier de nuit');
    if (p.voiesInterieures) obligeAnnonceur.push('voies intérieures d’une plateforme de plus de 2 voies');
    if (vAnnoncees > 160) obligeAnnonceur.push('zone à plus de 160 km/h');
    if (p.visibiliteInsuffisante) obligeAnnonceur.push('distance d’annonce non obtenue');
    if (obligeAnnonceur.length)
      alertes.push({ niveau: 'stop', texte: `Agent seul : un dispositif d’annonce (annonceur) est obligatoire — ${obligeAnnonceur.join(', ')}.` });
    if (p.lgv) alertes.push({ niveau: 'stop', texte: 'L’agent seul est interdit sur LGV.' });
    alertes.push({
      niveau: 'info',
      texte: 'Agent seul : il faut que le cas soit autorisé par un document d’application local, et tu assures la traçabilité du calcul (carnet CADA).',
    });
  }

  /* L'ASP annonce lui-même (cumul ASP / annonceur). */
  if (p.aspAnnonceLuiMeme && !p.agentSeul) {
    const interdit: string[] = [];
    if (p.zoneBruyante || p.chantierBruyant) interdit.push('zone ou engins bruyants');
    if (p.banaliseVutTct) interdit.push('voie banalisée, TCT ou VUT organisée');
    if (p.icsSansDpcs) interdit.push('IPCS sans DPCS accordée');
    if (p.tunnel) interdit.push('tunnel');
    if (p.nuit) interdit.push('travaux de nuit');
    if (p.voiesInterieures) interdit.push('voies intérieures d’une plateforme de plus de 2 voies');
    if (p.visibiliteInsuffisante) interdit.push('distance de visibilité insuffisante');
    if (interdit.length) alertes.push({ niveau: 'stop', texte: `L’ASP ne peut pas annoncer lui-même : ${interdit.join(', ')}.` });
    else
      alertes.push({
        niveau: 'info',
        texte: 'L’ASP qui annonce lui-même : gilet blanc et passant jaune, trompe ceinture, essai d’audibilité ; seulement si son travail et les conditions locales le permettent.',
      });
  }

  /* Bruit. */
  if (p.chantierBruyant) {
    alertes.push({
      niveau: 'info',
      texte: 'Chantier bruyant : annonce avec un avertisseur à grande puissance (type Gérard ou Saint-Dizier) à moins de 5 m des agents. Seul l’annonceur peut porter un EPICB actif homologué (pas la sentinelle). Bouchons moulés : brassard violet.',
    });
  }
  if (p.nuit && !p.agentSeul) {
    alertes.push({ niveau: 'info', texte: 'Chantier de nuit : attention à la vigilance des annonceurs et des sentinelles.' });
  }
  if (e.type === 'mobile') {
    alertes.push({
      niveau: 'info',
      texte: 'Chantier mobile : les annonceurs (et sentinelles) suivent l’équipe sans interrompre le dispositif ; l’ASP ne peut pas être annonceur.',
    });
  }
  if (e.type === 'itinerant') {
    alertes.push({
      niveau: 'info',
      texte: 'Chantier itinérant : interromps le dispositif à la fin de chaque intervention et fais acheminer les agents sous ta responsabilité.',
    });
  }

  return {
    situation,
    dfv,
    exemption,
    dd: { saisi: e.dd, retenu: ddRetenu, erreurs, conseils },
    ms,
    da,
    voies,
    alertes,
  };
}

/** Marge de sécurité, avec ce qui l'a fixée. */
export function marge(e: Entree, situation = situationDe(e.voies)): { valeur: number; raisons: string[] } {
  const p = e.p;
  if (p.agentSeul) {
    return situation === 'circulee'
      ? { valeur: 15, raisons: ['Agent seul, travail sur voie circulée.'] }
      : { valeur: 10, raisons: ['Agent seul, travail sur voie interdite ou à proximité de la ZD.'] };
  }
  const cas: string[] = [];
  if (p.obstacleMasquant) cas.push('un obstacle peut masquer l’approche d’une circulation courte');
  if (p.annonceur2Sens) cas.push('un annonceur surveille les 2 sens');
  if (p.aspAnnonceLuiMeme) cas.push('l’ASP surveille lui-même l’approche des circulations');

  if (situation === 'circulee') {
    const raisons: string[] = [];
    if (e.outillage === 'cat2') raisons.push('Outillage de 2e catégorie.');
    if (e.outillage === 'cat3') raisons.push('Outillage de 3e catégorie (interdiction obligatoire).');
    if (p.soudageMeulage) raisons.push('Soudage à l’arc, meulage de rail ou perceuse type bicyclette.');
    for (const c of cas) raisons.push(`${c[0].toUpperCase()}${c.slice(1)}.`);
    if (p.voiesInterieures) raisons.push('Agents sur les voies intérieures d’une plateforme de plus de 2 voies, séparés du garage.');
    if (raisons.length) return { valeur: 15, raisons };
    return {
      valeur: 5,
      raisons: [e.outillage === 'aucun' ? 'Voie circulée, sans outillage.' : 'Voie circulée, outillage de 1re catégorie (hors soudage, meulage, perceuse bicyclette).'],
    };
  }
  const ou = situation === 'interdite' ? 'Voie interdite à la circulation' : 'Travail à proximité de la ZD';
  if (p.clotureLimitative) return { valeur: 5, raisons: [`${ou}, avec une clôture à caractère limitatif.`] };
  if (cas.length) return { valeur: 10, raisons: cas.map((c) => `${ou}, sans clôture limitative : ${c}.`) };
  return { valeur: 5, raisons: [`${ou}, sans cas particulier.`] };
}
