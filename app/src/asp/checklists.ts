/** Check-lists de l'ASP, tirées du support de formation (documents, briefing, essais, pendant et fin du chantier). */

export interface CheckItem {
  id: string;
  text: string;
  hint?: string;
}

export interface CheckList {
  id: string;
  title: string;
  /** Quand s'en servir. */
  when: string;
  items: CheckItem[];
}

export const CHECKLISTS: CheckList[] = [
  {
    id: 'docs',
    title: 'Documents à avoir sur moi',
    when: 'Avant de partir',
    items: [
      { id: 'docs-particularites', text: 'Particularités locales du chantier', hint: 'Remises contre émargement, valables pour ce chantier.' },
      { id: 'docs-aan', text: 'Carnet d’attestations de mise en place du dispositif d’annonce (AAn)' },
      { id: 'docs-cada', text: 'Carnet CADA' },
      { id: 'docs-habilitation', text: 'Carte d’habilitation et attestation d’accès aux emprises' },
      { id: 'docs-prevention', text: 'Plan de prévention, ou PGC et PPSPS', hint: 'Commentés aux agents.' },
      { id: 'docs-csf', text: 'CSF et ISF si le chantier en a' },
    ],
  },
  {
    id: 'ligne',
    title: 'Ce que je dois savoir de la ligne',
    when: 'Avant de partir',
    items: [
      { id: 'ligne-vitesses', text: 'Nom et vitesses de la ligne', hint: 'Rupture de vitesse : prendre la plus importante entre le point d’annonce et le chantier.' },
      { id: 'ligne-regime', text: 'Régime d’exploitation (double voie, IPCS, banalisée…)' },
      { id: 'ligne-plateforme', text: 'Plateforme : nom des voies et sens des circulations' },
      { id: 'ligne-pistes', text: 'Pistes et itinéraires, emplacements de garage (réduits ou interdits)' },
      { id: 'ligne-alim', text: 'Alimentation (1500 V, 25 000 V) et ouvrages d’art' },
      { id: 'ligne-entrevoies', text: 'Entrevoies larges, zones bruyantes, DCO' },
    ],
  },
  {
    id: 'avant',
    title: 'Avant d’engager les voies',
    when: 'Sur place',
    items: [
      { id: 'avant-dd', text: 'Délai de dégagement choisi avec le chef de chantier et vérifié', hint: 'Test du délai de dégagement, ou simulation hors ZD avant l’engagement.' },
      { id: 'avant-cada', text: 'Fiche CADA établie : marge, délai et distance d’annonce' },
      { id: 'avant-pa', text: 'Points d’annonce repérés sur le terrain', hint: 'Poteaux kilométriques et hectométriques, points singuliers, roue d’arpenteur. Pas les poteaux caténaires (30 à 60 m d’écart).' },
      { id: 'avant-garage', text: 'Emplacements de garage définis et montrés' },
      { id: 'avant-annonceurs', text: 'Annonceurs placés : visibilité de chaque voie et sens, audibilité, visibles de moi, hors ZD côté garage' },
      { id: 'avant-sentinelles', text: 'Sentinelles et répétiteurs : chacun voit et entend le suivant', hint: 'Chantier bruyant : coup de trompe + drapeau blanc déployé non agité de jour, bâton lumineux la nuit.' },
      { id: 'avant-essai', text: 'Essai préalable du dispositif d’annonce et essai d’audibilité' },
      { id: 'avant-aan', text: 'AAn : cadre B rempli, 1er feuillet remis au demandeur, souche gardée' },
    ],
  },
  {
    id: 'briefing',
    title: 'Briefing',
    when: 'Avant le début du travail',
    items: [
      { id: 'brief-acteurs', text: 'Les acteurs sécurité et leur repérage', hint: 'ASP, R SNCF/Ch ou RSO, annonceurs, sentinelles, agents d’activité…' },
      { id: 'brief-chantier', text: 'Caractéristiques du chantier (fixe, mobile, itinérant, bruyant…)' },
      { id: 'brief-phases', text: 'Changements de phase et d’activité prévus' },
      { id: 'brief-circulation', text: 'Conditions de circulation sur la voie de chantier et les voies contiguës', hint: 'S9, VUT, IPCS, vitesses, LTV.' },
      { id: 'brief-limites', text: 'Limites de la zone de travail à ne pas dépasser', hint: 'PK, repères fixes, banderoles.' },
      { id: 'brief-dispositif', text: 'Dispositif d’annonce : voies et sens annoncés, rôle de chacun, signal d’annonce' },
      { id: 'brief-protections', text: 'Protections collectives en place (chaînette, clôture, barrière)' },
      { id: 'brief-garage', text: 'Emplacements de garage à rejoindre' },
      { id: 'brief-epi', text: 'Vêtements et EPI des agents' },
    ],
  },
  {
    id: 'pendant',
    title: 'Pendant le chantier',
    when: 'En continu',
    items: [
      { id: 'pendant-verif', text: 'Je vérifie aussi souvent que nécessaire le délai de dégagement et la distance de visibilité' },
      { id: 'pendant-essai', text: 'Nouvel essai d’audibilité si le vent, le bruit ou le chantier changent' },
      { id: 'pendant-defaillance', text: 'Sécurité plus réglementaire ou annonceur défaillant : je fais dégager la ZD' },
      { id: 'pendant-brouillard', text: 'Brouillard sans la distance de visibilité : arrêt du travail sur les voies ouvertes' },
      { id: 'pendant-reprise', text: 'Je donne l’ordre de reprise après chaque interruption, quand c’est sans danger' },
      { id: 'pendant-modif', text: 'Je ne modifie pas le dispositif sans en aviser les agents' },
    ],
  },
  {
    id: 'fin',
    title: 'Fin du chantier',
    when: 'À la fin',
    items: [
      { id: 'fin-cessation', text: 'Cadre C (cessation) reçu du RCE, du R SNCF/Ch ou du RSO, collé au recto du feuillet' },
      { id: 'fin-accompagnement', text: 'Si j’accompagne l’entreprise : cadre D signé par le RCE une fois hors des emprises' },
      { id: 'fin-sortie', text: 'Tous les agents et le dispositif d’annonce sont sortis des voies' },
    ],
  },
];

export function progression(checks: Record<string, boolean>, list: CheckList): [number, number] {
  return [list.items.filter((i) => checks[i.id]).length, list.items.length];
}
