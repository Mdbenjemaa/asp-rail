/**
 * Ce qu'un intervenant partage sur un chantier partagé, prêt à dessiner : un titre, l'état en une phrase
 * (« Chaîne d'annonce en place depuis 22:05 »), quelques lignes de détail et des points ou traits déjà placés
 * sur la carte (le téléphone qui reçoit n'a pas à charger la ligne). Et, à l'inverse, la carte de ce que
 * partagent les autres.
 */
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { LineDoc } from '../lib/data';
import { fmtLine, fmtPk } from '../lib/format';
import { positionsAtPk } from '../lib/pk';
import { heureDans } from '../lib/temps';
import { chantierFeatures } from '../asp/carte';
import { SENS_FLECHE, titreChantier, zoneTexte, type Chantier } from '../asp/chantier';
import { codesAgents } from '../asp/dispositif';
import type { Resultat } from '../asp/rules';
import { pointsAnnonceAgent } from '../asp/dispositif';
import { surveilleTexte } from '../asp/partage';
import { etatPoste, ROLE_CHAINE, titrePoste, type Poste, type RoleChaine } from '../chaine/poste';
import { avancementLam, OUTIL_COURT, titreMissionLam, TYPE_MISSION, type MissionLam } from '../lam/mission';
import { avancement, PROCEDURE_TITRE, ROLE_PN, titreMission, type Mission } from '../pn/mission';
import type { Activite, Partage } from './session';

/** en-place : chaîne posée, PN gardé, LAM en voie… ; attente : pas encore ; fini : levé, mission finie. */
type Niveau = 'en-place' | 'attente' | 'fini';

export interface Donnees {
  v: 1;
  titre: string;
  etat: string;
  niveau: Niveau;
  ligne: string | null;
  details: string[];
  /** Traits et points : propriétés r (zone, pa, agent, pn, lam) et label. */
  geo: Feature[];
  /** ASP : sa chaîne d'annonce, pour que chaque agent y prenne son poste. */
  chaine?: Maillon[];
  /** Agent de la chaîne : le poste qu'il tient dans la chaîne d'un ASP (son téléphone et le code). */
  lien?: { asp: string; code: string };
}

/** Un poste de la chaîne de l'ASP. */
export interface Maillon {
  code: string;
  role: RoleChaine;
  pk: number | null;
  surveille: string;
  pas: { titre: string; pk: number }[];
}

export const ACTIVITE_LABEL: Record<Activite, string> = { asp: 'ASP', pn: 'Agent PN', lam: 'AP LAM / S9', chaine: 'Chaîne d’annonce' };

/** Coordonnées au mètre près : assez pour la carte, léger à envoyer. */
const arrondi = (c: number[]) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];

function point(doc: LineDoc | null, pk: number | null, r: string, label: string): Feature[] {
  if (!doc || pk === null) return [];
  const pos = positionsAtPk(doc, pk);
  return pos.length ? [{ type: 'Feature', properties: { r, label }, geometry: { type: 'Point', coordinates: arrondi(pos[0].lonlat) } }] : [];
}

/** Chantier de l'ASP : zone, points d'annonce, agents de la chaîne, et où en est l'annonce. */
export function donneesChantier(c: Chantier, r: Resultat, doc: LineDoc | null): Donnees {
  const d = c.deroule;
  const h = (t: number) => heureDans(t, c.date);
  let etat: string;
  let niveau: Niveau = 'attente';
  if (d.jalons.leve) {
    etat = `Chaîne d’annonce levée à ${h(d.jalons.leve)}`;
    niveau = 'fini';
  } else if (d.jalons.enPlace) {
    etat = `Chaîne d’annonce en place depuis ${h(d.jalons.enPlace)}${d.jalons.debut && !d.jalons.fin ? ' · travaux en cours' : d.jalons.fin ? ' · travaux finis' : ''}`;
    niveau = 'en-place';
  } else if (d.jalons.arrivee) {
    etat = `ASP sur place depuis ${h(d.jalons.arrivee)} · chaîne pas encore en place`;
  } else {
    etat = 'Chaîne d’annonce pas encore en place';
  }
  const codes = codesAgents(c.agents);
  const details = [
    `${c.ligne ? `Ligne ${fmtLine(c.ligne)} · ` : ''}${zoneTexte(c)}`,
    r.voies.length
      ? `Annonce : ${r.voies.map((v) => `${v.voie} ${SENS_FLECHE[v.sens]} ${v.distance ? `${v.distance} m` : '?'}${v.pointAnnonce !== null ? ` (PA PK ${fmtPk(v.pointAnnonce)})` : ''}`).join(', ')}`
      : null,
    c.agents.some((a) => a.role !== 'asp')
      ? `Chaîne : ${c.agents
          .filter((a) => a.role !== 'asp')
          .map((a) => `${codes.get(a.id)}${a.pk !== null ? ` PK ${fmtPk(a.pk)}` : ''}`)
          .join(' · ')}`
      : null,
    d.trains.length ? `Trains annoncés : ${d.trains.length}` : null,
  ].filter((x): x is string => !!x);
  const geo: Feature[] = [];
  if (doc) {
    for (const f of chantierFeatures(c, doc, r).features) {
      const role = f.properties?.role as string;
      const r2 = role === 'zone' || role === 'equipe' ? 'zone' : role === 'pa' ? 'pa' : role === 'agent' || role === 'sentinelle' || role === 'asp' ? 'agent' : null;
      if (!r2) continue;
      const geometry =
        f.geometry.type === 'Point'
          ? { type: 'Point' as const, coordinates: arrondi(f.geometry.coordinates) }
          : f.geometry.type === 'LineString'
            ? { type: 'LineString' as const, coordinates: f.geometry.coordinates.map(arrondi) }
            : null;
      if (geometry) geo.push({ type: 'Feature', properties: { r: r2, label: String(f.properties?.label ?? '') }, geometry });
    }
  }
  const chaine: Maillon[] = c.agents
    .filter((a): a is typeof a & { role: RoleChaine } => a.role !== 'asp')
    .map((a) => ({
      code: codes.get(a.id) ?? '',
      role: a.role,
      pk: a.pk,
      surveille: surveilleTexte(c, a.surveille),
      pas: pointsAnnonceAgent(c, r, a.id).map((p) => ({ titre: p.titre, pk: p.pk })),
    }));
  return { v: 1, titre: titreChantier(c), etat, niveau, ligne: c.ligne, details, geo, chaine };
}

/** Poste d'un agent de la chaîne : où il est et s'il est en place. Relié à la chaîne d'un ASP, son point est déjà sur la carte de l'ASP. */
export function donneesPoste(p: Poste, doc: LineDoc | null): Donnees {
  const e = etatPoste(p);
  const details = [
    `${ROLE_CHAINE[p.role]} ${p.code}${p.pk !== null ? ` · PK ${fmtPk(p.pk)}` : ''}${p.ligne ? ` · ligne ${fmtLine(p.ligne)}` : ''}`,
    p.surveille ? `Surveille ${p.surveille}` : null,
    p.trains.length ? `Trains annoncés : ${p.trains.length}` : null,
  ].filter((x): x is string => !!x);
  return {
    v: 1,
    titre: titrePoste(p),
    etat: e.texte.replace(/ \(.*\)$/, ''),
    niveau: e.niveau,
    ligne: p.ligne,
    details,
    geo: p.lien ? [] : point(doc, p.pk, 'agent', p.code),
    ...(p.lien ? { lien: { asp: p.lien.asp, code: p.code } } : {}),
  };
}

/** Mission de l'agent PN : le PN gardé et son état. */
export function donneesPn(m: Mission, doc: LineDoc | null): Donnees {
  const av = avancement(m);
  const h = (t: number) => heureDans(t, m.date);
  const debut = m.journal.length ? Math.min(...m.journal.map((e) => e.t)) : null;
  let etat: string;
  let niveau: Niveau = 'attente';
  if (m.fin) {
    etat = `Mission finie à ${h(m.fin)}`;
    niveau = 'fini';
  } else if (m.enCours) {
    etat = `${PROCEDURE_TITRE[m.enCours.type]} : en cours depuis ${h(m.enCours.debut)}`;
    niveau = 'en-place';
  } else if (av.pendant) {
    etat = 'PN gardé : agent en poste';
    niveau = 'en-place';
  } else {
    etat = debut ? `Prise de poste en cours (${av.faites}/${av.total})` : 'Pas encore en poste';
  }
  const numero = m.pn.numero.trim().replace(/^PN\s*/i, '');
  const details = [
    ROLE_PN[m.role],
    [numero ? `PN ${numero}` : null, m.pn.lieu || null].filter(Boolean).join(' · ') || null,
    m.pn.ligne ? `Ligne ${fmtLine(m.pn.ligne)}${m.pn.pk !== null ? ` · PK ${fmtPk(m.pn.pk)}` : ''}` : null,
    m.passages || m.lam ? `Mobiles travaux passés : ${m.passages} · LAM mis en voie : ${m.lam}` : null,
  ].filter((x): x is string => !!x);
  return { v: 1, titre: titreMission(m), etat, niveau, ligne: m.pn.ligne, details, geo: point(doc, m.pn.pk, 'pn', numero ? `PN ${numero}` : 'PN') };
}

/** Mission AP LAM ou AP S9 : le lieu, la protection ou le LAM en voie, un passage de train travaux. */
export function donneesLam(m: MissionLam, doc: LineDoc | null): Donnees {
  const av = avancementLam(m);
  const h = (t: number) => heureDans(t, m.date);
  let etat: string;
  let niveau: Niveau = 'attente';
  if (m.fin) {
    etat = `Mission finie à ${h(m.fin)}`;
    niveau = 'fini';
  } else if (m.enCours) {
    etat = `Passage de train travaux en cours depuis ${h(m.enCours.debut)}`;
    niveau = 'en-place';
  } else if (av.pendant) {
    etat = m.type === 's9' ? 'Protection S9 en place' : 'LAM en voie';
    niveau = 'en-place';
  } else {
    etat = av.faites ? `Mise en place en cours (${av.faites}/${av.total})` : 'Pas encore commencée';
  }
  const details = [
    TYPE_MISSION[m.type],
    [m.lieu.ligne ? `Ligne ${fmtLine(m.lieu.ligne)}` : null, m.lieu.pk !== null ? `PK ${fmtPk(m.lieu.pk)}` : null, m.lieu.voie ? `voie ${m.lieu.voie}` : null, m.lieu.lieu || null]
      .filter(Boolean)
      .join(' · ') || null,
    m.type === 's9' && (m.bouclage.trim() || m.outils.length) ? [m.bouclage.trim() && `Bouclage ${m.bouclage.trim()}`, m.outils.map((o) => OUTIL_COURT[o]).join(', ')].filter(Boolean).join(' · ') : null,
    m.ttx ? `Trains travaux passés : ${m.ttx}` : null,
  ].filter((x): x is string => !!x);
  const label = m.type === 's9' ? `S9${m.bouclage.trim() ? ` ${m.bouclage.trim()}` : ''}` : 'LAM';
  return { v: 1, titre: titreMissionLam(m), etat, niveau, ligne: m.lieu.ligne, details, geo: point(doc, m.lieu.pk, 'lam', label) };
}

/** « il y a 3 min » */
export function depuis(t: number, now: number): string {
  const min = Math.floor((now - t) / 60_000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** Ce que partagent les autres intervenants, pour la carte. */
export function partagesFeatures(list: Partage[], moi: string): FeatureCollection {
  const features: Feature[] = [];
  for (const p of list) {
    if (p.appareil === moi) continue;
    const d = p.donnees;
    for (const f of d.geo ?? []) {
      if (!f?.geometry || (f.geometry.type !== 'Point' && f.geometry.type !== 'LineString')) continue;
      features.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          r: String(f.properties?.r ?? 'agent'),
          label: String(f.properties?.label ?? ''),
          act: p.activite,
          niv: d.niveau,
          n: `${ACTIVITE_LABEL[p.activite]} · ${p.nom || 'Sans nom'}${p.entreprise ? ` (${p.entreprise})` : ''}`,
          t: d.titre,
          e: d.etat,
          d: (d.details ?? []).join('\n'),
          tel: p.tel,
          maj: p.maj,
          app: p.appareil,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Où regarder sur la carte pour un intervenant : ses points et traits. */
export function centreDe(p: Partage): [number, number] | null {
  const pts = (p.donnees.geo ?? []).flatMap((f) =>
    f.geometry.type === 'Point' ? [(f.geometry as Point).coordinates] : f.geometry.type === 'LineString' ? f.geometry.coordinates : [],
  );
  if (!pts.length) return null;
  const lon = pts.reduce((s, c) => s + c[0], 0) / pts.length;
  const lat = pts.reduce((s, c) => s + c[1], 0) / pts.length;
  return [lon, lat];
}
