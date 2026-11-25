/**
 * Plan de situation pour les PDF : la ligne autour d'un PK, dessinée à plat et tournée pour que les PK croissent
 * vers la droite, avec les gares, PN et signaux proches, des repères de PK et les marques du document
 * (PN, point de mise en voie, zone de travail, points d'annonce). Tout vient des données ouvertes déjà sur le
 * téléphone : rien à télécharger au moment de l'export.
 */
import type { LineDoc } from './data';
import { localProjector, type LonLat } from './geo';
import { decodeGeom, positionsAtPk } from './pk';

export interface MarquePlan {
  pk: number;
  label: string;
  genre: 'ici' | 'annonce' | 'agent';
}

export interface PointPlan {
  u: number;
  v: number;
  nom: string;
  genre: 'gare' | 'pn' | 'signal';
}

export interface PlanSituation {
  /** Point central, en longitude et latitude. */
  centre: LonLat;
  pk: number;
  /** Demi-longueur du plan le long de la voie (m). */
  rayon: number;
  /** Tronçons de la ligne, en mètres : u le long de la voie (PK croissants à droite), v à gauche de la voie. */
  traces: [number, number][][];
  points: PointPlan[];
  reperes: { u: number; v: number; pk: number; angle: number }[];
  zone: [number, number][] | null;
  marques: { u: number; v: number; label: string; genre: MarquePlan['genre'] }[];
  /** Direction du nord dans le plan (vecteur unité u, v). */
  nord: [number, number];
}

const premier = (doc: LineDoc, pk: number): LonLat | null => positionsAtPk(doc, pk)[0]?.lonlat ?? null;

/** Plan autour d'un PK, ou null si le PK n'est pas sur la géométrie de la ligne. */
export function planSituation(doc: LineDoc, pk: number, opts: { rayon?: number; zone?: [number, number] | null; marques?: MarquePlan[] } = {}): PlanSituation | null {
  const centre = premier(doc, pk);
  if (!centre) return null;
  const rayon = opts.rayon ?? 1200;
  const proj = localProjector(centre);
  // Sens de la voie au centre : du PK un peu avant au PK un peu après.
  const a = premier(doc, pk - 0.1) ?? centre;
  const b = premier(doc, pk + 0.1) ?? centre;
  const [ax, ay] = proj.toXY(a);
  const [bx, by] = proj.toXY(b);
  const angle = ax === bx && ay === by ? 0 : Math.atan2(by - ay, bx - ax);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const uv = (p: LonLat): [number, number] => {
    const [x, y] = proj.toXY(p);
    return [x * c + y * s, -x * s + y * c];
  };
  const dans = ([u, v]: [number, number], marge = 1.3) => Math.abs(u) <= rayon * marge && Math.abs(v) <= rayon * marge;

  const traces: [number, number][][] = [];
  for (const t of doc.troncons) {
    if (!t.g) continue;
    let cur: [number, number][] = [];
    let prev: [number, number] | null = null;
    for (const vtx of decodeGeom(t.g)) {
      const p = uv([vtx[0], vtx[1]]);
      if (dans(p)) {
        // On garde le sommet d'avant pour que le trait aille jusqu'au bord du plan.
        if (!cur.length && prev) cur.push(prev);
        cur.push(p);
      } else if (cur.length) {
        cur.push(p);
        traces.push(cur);
        cur = [];
      }
      prev = p;
    }
    if (cur.length > 1) traces.push(cur);
  }

  const points: PointPlan[] = [];
  for (const p of doc.points) {
    const genre = p[1] === 'gare' ? 'gare' : p[1] === 'pn' ? 'pn' : p[1] === 'sig_carre' || p[1] === 'sig_autre' ? 'signal' : null;
    if (!genre) continue;
    const q = uv([p[4], p[5]]);
    if (Math.abs(q[0]) <= rayon && Math.abs(q[1]) <= rayon * 0.45) points.push({ u: q[0], v: q[1], nom: p[2], genre });
  }
  points.sort((x, y) => x.u - y.u);

  const reperes: PlanSituation['reperes'] = [];
  const pas = rayon > 1500 ? 1 : 0.5;
  for (let k = Math.ceil((pk - rayon / 1000) / pas) * pas; k <= pk + rayon / 1000 + 1e-9; k += pas) {
    const kk = Math.round(k * 1000) / 1000;
    const p = premier(doc, kk);
    if (!p) continue;
    const p0 = uv(premier(doc, kk - 0.02) ?? p);
    const p1 = uv(premier(doc, kk + 0.02) ?? p);
    const q = uv(p);
    if (dans(q, 1)) reperes.push({ u: q[0], v: q[1], pk: kk, angle: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) });
  }

  let zone: [number, number][] | null = null;
  if (opts.zone) {
    const [d, f] = opts.zone[0] <= opts.zone[1] ? opts.zone : [opts.zone[1], opts.zone[0]];
    const n = Math.min(400, Math.max(2, Math.ceil(((f - d) * 1000) / 20)));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const p = premier(doc, d + ((f - d) * i) / n);
      if (p) pts.push(uv(p));
    }
    zone = pts.length > 1 ? pts : null;
  }

  const marques: PlanSituation['marques'] = [];
  for (const m of opts.marques ?? []) {
    const p = premier(doc, m.pk);
    if (!p) continue;
    const q = uv(p);
    if (dans(q, 1)) marques.push({ u: q[0], v: q[1], label: m.label, genre: m.genre });
  }

  return { centre, pk, rayon, traces, points, reperes, zone, marques, nord: [s, c] };
}

/** Rayon qui fait tenir une zone (chantier, points d'annonce) dans le plan, entre 600 m et 5 km. */
export function rayonPour(pk: number, autres: (number | null | undefined)[]): number {
  const loin = Math.max(0, ...autres.filter((x): x is number => typeof x === 'number').map((x) => Math.abs(x - pk) * 1000));
  return Math.min(5000, Math.max(600, Math.ceil((loin * 1.25) / 100) * 100));
}

/** Lien vers une carte (s'ouvre dans l'appli de cartes du téléphone). */
export const lienCarte = ([lon, lat]: LonLat) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;

export const coordonnees = ([lon, lat]: LonLat) =>
  `${Math.abs(lat).toFixed(5).replace('.', ',')}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(5).replace('.', ',')}° ${lon >= 0 ? 'E' : 'O'}`;
