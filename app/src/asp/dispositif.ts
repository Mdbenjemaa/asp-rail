/**
 * Contrôles du dispositif d'annonce : qui surveille quoi, où sont placés les annonceurs par rapport aux points
 * d'annonce, chaîne d'annonce, et règles sur le rôle de l'ASP.
 */
import { fmtDist, fmtPk } from '../lib/format';
import { ROLE_COURT, ROLE_LABEL, type Agent, type Chantier, cleSens, SENS_TEXTE } from './chantier';
import type { Alerte, Resultat } from './rules';

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

/** Libellé d'un agent pour les listes : « A1 · Annonceur · Karim ». */
export function libelleAgent(a: Agent, codes: Map<string, string>): string {
  return [codes.get(a.id), ROLE_LABEL[a.role], a.nom.trim()].filter(Boolean).join(' · ');
}
