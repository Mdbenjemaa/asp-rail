/**
 * Lecture du planning « Sécurité chantiers » d'ETF (PDF imprimé depuis Excel) à partir du texte placé de chaque page.
 *
 * Le tableau : une ligne par agent (nom, numéro, adresse), puis une case par jour, du lundi au dimanche. Le PDF ne
 * garde pas les cases : on les retrouve par la position du texte. Chaque morceau va dans la colonne du jour la plus
 * proche (d'après les en-têtes « lun 23 nov »…) et dans la ligne de l'agent dont le nom est le plus proche en hauteur
 * (les textes sont centrés dans leurs cases : vérifié sur 28 plannings, aucun morceau mal rangé).
 */

/** Un morceau de texte d'une page : coin bas-gauche (x, y, y vers le haut comme dans le PDF), largeur, hauteur. */
export interface Morceau {
  s: string;
  x: number;
  y: number;
  l: number;
  h: number;
}

export interface AgentLu {
  nom: string;
  numero: string;
  adresse: string;
  /** Pour chaque jour, du lundi au dimanche : les lignes de la case, de haut en bas. */
  jours: string[][];
}

export interface PlanningLu {
  /** Numéro de semaine (ISO, comme le « S.48 » du planning), d'après les dates des en-têtes. */
  semaine: number;
  annee: number;
  /** Lundi de la semaine, AAAA-MM-JJ. */
  lundi: string;
  agents: AgentLu[];
}

const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const EN_TETE_JOUR = /^(lun|mar|mer|jeu|ven|sam|dim)[a-z]*\.?\s+(\d{1,2})\s*([a-zA-Zéèêûôà]+)\.?$/i;
const MOIS: Record<string, number> = {
  janv: 1, janvier: 1, jan: 1,
  fevr: 2, fevrier: 2, fev: 2,
  mars: 3, mar: 3,
  avr: 4, avril: 4,
  mai: 5,
  juin: 6,
  juil: 7, juillet: 7,
  aout: 8,
  sept: 9, septembre: 9, sep: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, decembre: 12,
};
const ETIQUETTES = /^(nom|pr[ée]nom|nom\s+pr[ée]nom|num[ée]ro|adresse|t[ée]l[ée]phone)$/i;
const TELEPHONE = /^\+?\d[\d .]{7,}\d$/;

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cx = (m: Morceau) => m.x + m.l / 2;
const cy = (m: Morceau) => m.y + m.h / 2;

interface EnTete {
  jour: number;
  centre: number;
  y: number;
  jj: number;
  mm: number | null;
}

function enTetes(page: Morceau[]): EnTete[] {
  const r: EnTete[] = [];
  for (const m of page) {
    const t = EN_TETE_JOUR.exec(m.s.trim());
    if (!t) continue;
    const mm = MOIS[sansAccents(t[3]).toLowerCase()] ?? null;
    r.push({ jour: JOURS.indexOf(t[1].toLowerCase()), centre: cx(m), y: cy(m), jj: Number(t[2]), mm });
  }
  return r;
}

/** Centres des 7 colonnes : ceux des en-têtes lus, les autres déduits (colonnes régulières). */
function colonnes(h: EnTete[]): number[] | null {
  const par = new Map<number, number>();
  for (const e of h) if (!par.has(e.jour)) par.set(e.jour, e.centre);
  if (par.size < 2) return null;
  const pts = [...par.entries()];
  const n = pts.length;
  const mx = pts.reduce((a, [i]) => a + i, 0) / n;
  const my = pts.reduce((a, [, c]) => a + c, 0) / n;
  const pente = pts.reduce((a, [i, c]) => a + (i - mx) * (c - my), 0) / pts.reduce((a, [i]) => a + (i - mx) ** 2, 0);
  return JOURS.map((_, i) => par.get(i) ?? my + pente * (i - mx));
}

/** Range les morceaux d'une case en lignes, de haut en bas puis de gauche à droite. */
function enLignes(ms: Morceau[]): string[] {
  const tri = [...ms].sort((a, b) => cy(b) - cy(a) || a.x - b.x);
  const lignes: { y: number; ms: Morceau[] }[] = [];
  for (const m of tri) {
    const der = lignes[lignes.length - 1];
    if (der && Math.abs(der.y - cy(m)) < Math.max(1.2, m.h * 0.4)) der.ms.push(m);
    else lignes.push({ y: cy(m), ms: [m] });
  }
  return lignes
    .map((l) =>
      l.ms
        .sort((a, b) => a.x - b.x)
        .map((m) => m.s.trim())
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

/** Les agents d'une page, et la date d'un des jours (pour retrouver la semaine). */
function lirePage(page: Morceau[]): { agents: AgentLu[]; jours: EnTete[] } {
  const items = page.filter((m) => m.s.trim());
  const h = enTetes(items);
  const col = colonnes(h);
  if (!col) return { agents: [], jours: [] };
  const largeur = (col[6] - col[0]) / 6;
  const hautEntete = Math.min(...h.map((e) => e.y));
  const gauche = col[0] - largeur / 2;
  const droite = col[6] + largeur / 2;

  // Colonnes de gauche : nom, numéro, adresse (d'après leurs titres, sinon d'après les numéros de téléphone).
  const titre = (re: RegExp) => items.find((m) => re.test(m.s.trim()) && cx(m) < gauche);
  const tNumero = titre(/^num[ée]ro$/i);
  const tAdresse = titre(/^adresse$/i);
  const corps = items.filter((m) => cy(m) < hautEntete - 2 && !ETIQUETTES.test(m.s.trim()));
  const tels = corps.filter((m) => cx(m) < gauche && TELEPHONE.test(m.s.trim()));
  const centreNumero = tNumero ? cx(tNumero) : tels.length ? tels.reduce((a, m) => a + cx(m), 0) / tels.length : null;
  const finNom = centreNumero !== null ? centreNumero - (tNumero?.l ?? 30) : gauche;
  const debutAdresse = tAdresse && centreNumero !== null ? (centreNumero + cx(tAdresse)) / 2 : centreNumero !== null ? centreNumero + 25 : gauche;

  // Noms : un ou plusieurs morceaux empilés (nom long sur deux lignes).
  const noms = corps.filter((m) => cx(m) < finNom && !TELEPHONE.test(m.s.trim())).sort((a, b) => cy(b) - cy(a));
  const ancres: { y: number; ms: Morceau[] }[] = [];
  for (const m of noms) {
    const der = ancres[ancres.length - 1];
    if (der && der.ms[der.ms.length - 1] && cy(der.ms[der.ms.length - 1]) - cy(m) < Math.max(9, m.h * 1.6)) der.ms.push(m);
    else ancres.push({ y: 0, ms: [m] });
  }
  for (const a of ancres) a.y = a.ms.reduce((s, m) => s + cy(m), 0) / a.ms.length;
  if (!ancres.length) return { agents: [], jours: h };

  const agents = ancres.map(() => ({ numero: [] as Morceau[], adresse: [] as Morceau[], jours: JOURS.map(() => [] as Morceau[]) }));
  const ecartMax = Math.max(60, (ancres.length > 1 ? (ancres[0].y - ancres[ancres.length - 1].y) / (ancres.length - 1) : 40) * 1.5);
  for (const m of corps) {
    if (noms.includes(m)) continue;
    const x = cx(m);
    if (x > droite) continue;
    let k = 0;
    for (let i = 1; i < ancres.length; i++) if (Math.abs(ancres[i].y - cy(m)) < Math.abs(ancres[k].y - cy(m))) k = i;
    if (Math.abs(ancres[k].y - cy(m)) > ecartMax) continue;
    if (x < gauche) {
      if (x < debutAdresse) agents[k].numero.push(m);
      else agents[k].adresse.push(m);
      continue;
    }
    let j = 0;
    for (let i = 1; i < 7; i++) if (Math.abs(col[i] - x) < Math.abs(col[j] - x)) j = i;
    agents[k].jours[j].push(m);
  }
  return {
    jours: h,
    agents: ancres.map((a, k) => ({
      nom: enLignes(a.ms).join(' '),
      numero: enLignes(agents[k].numero).join(' '),
      adresse: enLignes(agents[k].adresse).join(' '),
      jours: agents[k].jours.map(enLignes),
    })),
  };
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Semaine ISO (celle des plannings : du lundi au dimanche, la semaine 1 contient le premier jeudi). */
export function semaineIso(d: Date): { semaine: number; annee: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const debut = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { semaine: Math.ceil(((t.getTime() - debut.getTime()) / 86400000 + 1) / 7), annee: t.getUTCFullYear() };
}

/** Le lundi de la semaine, d'après un en-tête lu : l'année est celle qui tombe sur le bon jour, au plus près d'aujourd'hui. */
function lundiDe(h: EnTete[], maintenant: Date): Date | null {
  for (const e of h) {
    if (e.mm === null) continue;
    const annees = [-1, 0, 1].map((k) => maintenant.getFullYear() + k);
    const possibles = annees
      .map((a) => new Date(a, e.mm! - 1, e.jj))
      .filter((d) => d.getMonth() === e.mm! - 1 && ((d.getDay() + 6) % 7) === e.jour)
      .sort((a, b) => Math.abs(a.getTime() - maintenant.getTime()) - Math.abs(b.getTime() - maintenant.getTime()));
    if (!possibles.length) continue;
    const d = possibles[0];
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - e.jour);
  }
  return null;
}

/** Lit toutes les pages. Rend null si ce n'est pas un planning (pas d'en-têtes de jours ni d'agents). */
export function lirePlanning(pages: Morceau[][], maintenant = new Date()): PlanningLu | null {
  const agents: AgentLu[] = [];
  let lundi: Date | null = null;
  for (const page of pages) {
    const r = lirePage(page);
    if (!lundi && r.jours.length) lundi = lundiDe(r.jours, maintenant);
    agents.push(...r.agents);
  }
  if (!lundi || !agents.length) return null;
  const { semaine, annee } = semaineIso(lundi);
  return { semaine, annee, lundi: iso(lundi), agents };
}

/** « Martin  Jean-Paul » → « MARTIN JEAN PAUL » : pour comparer des noms écrits différemment. */
export const nomNormal = (s: string) =>
  sansAccents(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

/** Le nom gardé (ou celui du code d'accès) correspond-il à cette ligne du planning ? Tous ses mots doivent y être. */
export function memeAgent(nomPlanning: string, nomCherche: string): boolean {
  const a = nomNormal(nomPlanning).split(' ');
  const b = nomNormal(nomCherche).split(' ').filter((m) => m.length > 1);
  return b.length > 0 && b.every((m) => a.includes(m));
}

/** Les lignes qui ressemblent le plus au nom donné (au moins un mot commun), les meilleures d'abord. */
export function proches(agents: AgentLu[], nom: string): AgentLu[] {
  const b = nomNormal(nom).split(' ').filter((m) => m.length > 1);
  if (!b.length) return [];
  return agents
    .map((a) => ({ a, n: nomNormal(a.nom).split(' ').filter((m) => b.includes(m)).length }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .map((x) => x.a);
}
