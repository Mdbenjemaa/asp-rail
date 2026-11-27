/**
 * Contrôles du dispositif d'annonce : qui surveille quoi, où sont placés les annonceurs par rapport aux points
 * d'annonce, chaîne d'annonce, et règles sur le rôle de l'ASP.
 */
import { fmtDist, fmtPk } from '../lib/format';
import { ROLE_COURT, type Agent, type Chantier, cleSens, newId, SENS_FLECHE, SENS_TEXTE } from './chantier';
import type { Alerte, Resultat, ResultatVoie } from './rules';

/** Nom court de chaque agent : ASP, A1, A2, R1, S1… dans l'ordre de la liste. */
export function codesAgents(agents: Agent[]): Map<string, string> {
  const n: Record<string, number> = {};
  const out = new Map<string, string>();
  for (const a of agents) {
    if (a.role === 'asp') {
      out.set(a.id, 'ASP');
      continue;
    }
    n[a.role] = (n[a.role] ?? 0) + 1;
    out.set(a.id, `${ROLE_COURT[a.role]}${n[a.role]}`);
  }
  return out;
}

export interface Visibilite {
  agentId: string;
  /** Voie et sens surveillés. */
  cle: string;
  voie: string;
  sens: 'croissant' | 'decroissant';
  pointAnnonce: number;
  /** Distance entre l'agent et le point d'annonce, le long de la ligne (m), s'il est placé en deçà du point. */
  aVoir: number | null;
  /** L'agent est au-delà du point d'annonce (plus loin du chantier) : il voit arriver les circulations plus tôt. */
  auDela: boolean;
}

/** Ce que chaque agent placé doit voir : la distance jusqu'au point d'annonce de chaque sens qu'il surveille. */
export function visibilites(c: Chantier, r: Resultat): Visibilite[] {
  const out: Visibilite[] = [];
  for (const a of c.agents) {
    if (a.pk === null) continue;
    for (const k of a.surveille) {
      const v = r.voies.find((x) => cleSens(x.voieId, x.sens) === k);
      if (!v || v.pointAnnonce === null) continue;
      const ecart = (a.pk - v.pointAnnonce) * 1000;
      // Sens croissant : les circulations viennent des PK inférieurs ; l'agent doit être en aval du point (PK plus grand).
      const enDeca = v.sens === 'croissant' ? ecart >= 0 : ecart <= 0;
      out.push({
        agentId: a.id,
        cle: k,
        voie: v.voie,
        sens: v.sens,
        pointAnnonce: v.pointAnnonce,
        aVoir: enDeca ? Math.round(Math.abs(ecart)) : null,
        auDela: !enDeca,
      });
    }
  }
  return out;
}

/** Contrôles du dispositif, du plus grave au plus léger. */
export function controlesDispositif(c: Chantier, r: Resultat): Alerte[] {
  const alertes: Alerte[] = [];
  const codes = codesAgents(c.agents);
  const nom = (a: Agent) => `${codes.get(a.id)}${a.nom.trim() ? ` (${a.nom.trim()})` : ''}`;
  const guetteurs = c.agents.filter((a) => a.role === 'annonceur' || a.role === 'sentinelle' || (a.role === 'asp' && a.surveille.length));

  // Chaque voie annoncée, dans chaque sens, doit être surveillée.
  if (!r.exemption) {
    for (const v of r.voies) {
      const k = cleSens(v.voieId, v.sens);
      if (!guetteurs.some((a) => a.surveille.includes(k))) {
        alertes.push({ niveau: 'stop', texte: `Personne ne surveille ${v.voie} (${SENS_TEXTE[v.sens]}).` });
      }
    }
  }

  // Un annonceur qui surveille les 2 sens : la marge augmente.
  for (const a of guetteurs) {
    const sens = new Set(a.surveille.map((k) => k.split(':')[1]));
    if (sens.size > 1 && !c.p.annonceur2Sens && a.role !== 'asp') {
      alertes.push({
        niveau: 'stop',
        texte: `${nom(a)} surveille les 2 sens : coche « Un annonceur surveille les 2 sens » dans l’onglet Annonce (marge de sécurité plus grande).`,
      });
    }
  }

  // L'ASP qui surveille lui-même.
  const asp = c.agents.find((a) => a.role === 'asp');
  if (asp && asp.surveille.length) {
    if (c.type === 'mobile') alertes.push({ niveau: 'stop', texte: 'Chantier mobile : l’ASP ne peut pas assurer la fonction d’annonceur.' });
    if (!c.p.aspAnnonceLuiMeme) {
      alertes.push({
        niveau: 'stop',
        texte: 'L’ASP surveille des voies : coche « L’ASP surveille lui-même l’approche des circulations » dans l’onglet Annonce (marge de sécurité plus grande).',
      });
    }
    if (c.effectif !== null && c.effectif > 3) {
      alertes.push({
        niveau: 'attention',
        texte: `Pour tenir la fonction d’annonceur, l’ASP doit avoir une petite équipe (3 agents au plus, groupés, chantier fixe), être dégagé de tout autre travail et autorisé nominativement par le dirigeant local. Effectif indiqué : ${c.effectif}.`,
      });
    }
  }

  // Une chaîne d'annonce ne mélange pas les entreprises.
  const chaine = c.agents.filter((a) => a.role !== 'asp');
  const entreprises = new Set(chaine.map((a) => a.entreprise.trim().toLowerCase()).filter(Boolean));
  if (entreprises.size > 1) {
    alertes.push({ niveau: 'stop', texte: 'Mixité d’entreprises : une chaîne d’annonce ne comporte que du personnel de la même entreprise.' });
  }

  // Répétiteurs sans annonceur à répéter, sentinelles sans annonceur.
  if (c.agents.some((a) => a.role === 'repetiteur') && !c.agents.some((a) => a.role === 'annonceur')) {
    alertes.push({ niveau: 'attention', texte: 'Des répétiteurs, mais aucun annonceur : un répétiteur répercute l’annonce d’un annonceur.' });
  }
  if (c.agents.some((a) => a.role === 'sentinelle') && !c.agents.some((a) => a.role === 'annonceur')) {
    alertes.push({ niveau: 'attention', texte: 'Une sentinelle transmet l’annonce à un annonceur placé au chantier : ajoute l’annonceur.' });
  }

  // Positions : l'agent doit voir le point d'annonce de chaque sens qu'il surveille.
  for (const vis of visibilites(c, r)) {
    const a = c.agents.find((x) => x.id === vis.agentId)!;
    if (vis.auDela) {
      alertes.push({
        niveau: 'info',
        texte: `${nom(a)} est placé au-delà du point d’annonce de ${vis.voie} (PK ${fmtPk(vis.pointAnnonce)}) : il annonce dès qu’il voit arriver la circulation, plus tôt que nécessaire.`,
      });
    } else if (vis.aVoir !== null) {
      alertes.push({
        niveau: 'info',
        texte: `${nom(a)} doit voir jusqu’au PK ${fmtPk(vis.pointAnnonce)} sur ${vis.voie} : ${fmtDist(vis.aVoir)} de visibilité, à vérifier sur place.`,
      });
    }
  }
  for (const a of guetteurs) {
    if (a.role !== 'asp' && a.pk === null && a.surveille.length) {
      alertes.push({ niveau: 'attention', texte: `${nom(a)} : indique sa position (PK) pour vérifier ce qu’il doit voir.` });
    }
  }
  if (!c.agents.some((a) => a.role !== 'asp') && !c.p.aspAnnonceLuiMeme && !r.exemption && r.voies.length) {
    alertes.push({ niveau: 'attention', texte: 'Ajoute les annonceurs (et si besoin sentinelles et répétiteurs).' });
  }
  return alertes;
}

/**
 * Un annonceur par sens de circulation, placé au point d'annonce et qui surveille toutes les voies de ce sens.
 * L'ASP est gardé (sans surveillance) ; les autres agents sont remplacés.
 */
export function annonceurParSens(c: Chantier, r: Resultat): Chantier {
  const asp = c.agents.filter((a) => a.role === 'asp').map((a) => ({ ...a, surveille: [] }));
  const sensPresents = (['croissant', 'decroissant'] as const).filter((s) => r.voies.some((v) => v.sens === s));
  const annonceurs: Agent[] = sensPresents.map((s) => {
    const vs = r.voies.filter((v) => v.sens === s);
    const pa = vs.find((v) => v.pointAnnonce !== null)?.pointAnnonce ?? null;
    return { id: newId(), role: 'annonceur', nom: '', entreprise: c.entreprise, pk: pa, surveille: vs.map((v) => cleSens(v.voieId, v.sens)) };
  });
  return { ...c, agents: [...asp, ...annonceurs], p: { ...c.p, annonceur2Sens: false } };
}

/** Ce qu'un agent surveille, en peu de mots : « surveille V1 ▲, V2 ▼ ». */
export function surveilleTexteCourt(c: Chantier, a: Agent): string {
  if (a.role === 'repetiteur') return 'répète l’annonce';
  const noms = a.surveille
    .map((k) => {
      const [id, sens] = k.split(':');
      const v = c.voies.find((x) => x.id === id);
      return v ? `${v.nom} ${sens === 'croissant' ? '▲' : '▼'}` : null;
    })
    .filter(Boolean);
  if (noms.length) return `surveille ${noms.join(', ')}`;
  return a.role === 'asp' ? '' : 'ne surveille encore rien';
}

/** Le chantier avec un agent posé à un autre PK. */
export const avecAgentA = (c: Chantier, id: string, pk: number): Chantier => ({ ...c, agents: c.agents.map((a) => (a.id === id ? { ...a, pk } : a)) });

/**
 * Pendant qu'on déplace un agent sur la carte : « A1 · PK 28+310 · PA V1 ▲ à 42 m », ou « au-delà du PA V1 ▲ »
 * (pour chaque sens qu'il surveille).
 */
export function infoDeplacement(c: Chantier, r: Resultat, id: string, pk: number): string {
  const code = codesAgents(c.agents).get(id) ?? 'Agent';
  const vis = visibilites(avecAgentA(c, id, pk), r).filter((v) => v.agentId === id);
  const sens = vis.map((v) => (v.auDela ? `au-delà du PA ${v.voie} ${SENS_FLECHE[v.sens]}` : `PA ${v.voie} ${SENS_FLECHE[v.sens]} à ${fmtDist(v.aVoir ?? 0)}`));
  return [`${code} · PK ${fmtPk(pk)}`, ...sens].join(' · ');
}

/** Ce qui est apparu à régler ou à vérifier en posant l'agent ailleurs (visibilité à avoir…), le plus grave d'abord. */
export function nouveauxProblemes(avant: Chantier, apres: Chantier, r: Resultat): string[] {
  const rang = { stop: 0, attention: 1, info: 2 } as const;
  const deja = new Set(controlesDispositif(avant, r).map((a) => a.texte));
  return controlesDispositif(apres, r)
    .filter((a) => !deja.has(a.texte))
    .sort((x, y) => rang[x.niveau] - rang[y.niveau])
    .map((a) => a.texte);
}

/** Distance au mètre près (« 1 240 m ») : pour ce qu'un annonceur doit voir, « 1,2 km » ne suffit pas. */
export const metres = (m: number) => `${Math.round(m).toLocaleString('fr-FR')} m`;

/** Le point d'annonce d'un sens surveillé par un agent, et où l'agent est par rapport à lui. */
export interface PaAgent {
  cle: string;
  /** « PA V1 ▲ ». */
  titre: string;
  pk: number;
  /** au : posé au point d'annonce (à 5 m près) ; voir : entre le point et le chantier, il doit le voir ; audela : plus loin que le point. */
  etat: 'au' | 'voir' | 'audela';
  /** Écart entre l'agent et le point d'annonce, le long de la ligne (m). */
  ecart: number;
  /** Où il est, en une phrase. */
  texte: string;
  /** Comment le point est calculé : vitesse × délai = distance avant le chantier. */
  calcul: string;
}

/** Comment le point d'annonce d'une voie est obtenu : « 160 km/h × 20 s (dégagement 5 s + marge 15 s) = 890 m avant le chantier (PK 28+718) ». */
export function calculPa(v: ResultatVoie, r: Resultat): string {
  const dd = r.dd.retenu;
  const detail = v.note ? ' (minimum au-delà de 160 km/h)' : dd !== null ? ` (dégagement ${dd} s + marge ${r.ms.valeur} s)` : '';
  const amont = v.limiteAmont !== null ? ` (PK ${fmtPk(v.limiteAmont)})` : '';
  return `${v.vitesse} km/h × ${v.da} s${detail} = ${metres(v.distance)} avant le chantier${amont}.`;
}

/** Les points d'annonce que doit voir un agent placé (un par sens surveillé), du plus loin à voir au plus proche. */
export function pointsAnnonceAgent(c: Chantier, r: Resultat, id: string): PaAgent[] {
  const a = c.agents.find((x) => x.id === id);
  if (!a || a.pk === null) return [];
  const out: PaAgent[] = [];
  for (const vis of visibilites(c, r).filter((v) => v.agentId === id)) {
    const v = r.voies.find((x) => cleSens(x.voieId, x.sens) === vis.cle)!;
    const ecart = Math.round(Math.abs(a.pk - vis.pointAnnonce) * 1000);
    const etat = ecart <= 5 ? 'au' : vis.auDela ? 'audela' : 'voir';
    const titre = `PA ${vis.voie} ${SENS_FLECHE[vis.sens]}`;
    const texte =
      etat === 'au'
        ? 'Posé au point d’annonce : il annonce dès qu’il voit la circulation arriver.'
        : etat === 'voir'
          ? `Doit voir arriver les trains sur ${metres(ecart)}, jusqu’au PK ${fmtPk(vis.pointAnnonce)} : à vérifier sur place.`
          : `${metres(ecart)} au-delà du point d’annonce : il annonce plus tôt que nécessaire.`;
    out.push({ cle: vis.cle, titre, pk: vis.pointAnnonce, etat, ecart, texte, calcul: calculPa(v, r) });
  }
  const aVoir = (p: PaAgent) => (p.etat === 'voir' ? p.ecart : -1);
  return out.sort((x, y) => aVoir(y) - aVoir(x));
}

/** Pourquoi un agent placé n'a pas de point d'annonce à voir. */
export function sansPaTexte(a: Agent): string {
  if (a.role === 'repetiteur') return 'Répète l’annonce : pas de point d’annonce à voir.';
  if (a.role === 'asp') return 'Ne surveille pas lui-même l’approche des circulations.';
  if (!a.surveille.length) return 'Ne surveille encore aucune voie : choisis-les dans le chantier, onglet Dispositif.';
  return 'Point d’annonce pas encore calculé : indique la vitesse des voies et le délai de dégagement.';
}
