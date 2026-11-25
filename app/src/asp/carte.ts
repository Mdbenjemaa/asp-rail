/**
 * Le chantier sur la carte : zone de travail (trait épais le long de la ligne), points d'annonce et agents
 * du dispositif, placés à leur PK sur la ligne du chantier.
 */
import type { Feature, FeatureCollection } from 'geojson';
import type { LineDoc } from '../lib/data';
import { fmtPk } from '../lib/format';
import { lineBetween, positionsAtPk } from '../lib/pk';
import { ROLE_LABEL, SENS_FLECHE, titreChantier, zoneAnnonce, type Chantier } from './chantier';
import { codesAgents } from './dispositif';
import type { Resultat } from './rules';

/** Position d'un PK sur la ligne (la première, si la ligne passe deux fois par ce PK). */
function auPk(doc: LineDoc, pk: number | null): [number, number] | null {
  if (pk === null) return null;
  const pos = positionsAtPk(doc, pk);
  return pos.length ? pos[0].lonlat : null;
}

export function chantierFeatures(c: Chantier, doc: LineDoc, r: Resultat): FeatureCollection {
  const features: Feature[] = [];
  const titre = titreChantier(c);
  // Toute la zone de travail, puis la portion sous annonce (chantier mobile).
  if (c.pkDebut !== null && c.pkFin !== null) {
    for (const part of lineBetween(doc, c.pkDebut, c.pkFin)) {
      features.push({
        type: 'Feature',
        properties: { role: 'zone', n: titre, d: `Zone de travail : PK ${fmtPk(c.pkDebut)} → ${fmtPk(c.pkFin)}`, c: c.ligne ?? '' },
        geometry: { type: 'LineString', coordinates: part },
      });
    }
  }
  const z = zoneAnnonce(c);
  if (c.type === 'mobile' && z.debut !== null && z.fin !== null) {
    for (const part of lineBetween(doc, z.debut, z.fin)) {
      features.push({
        type: 'Feature',
        properties: { role: 'equipe', n: 'Zone sous annonce', d: `PK ${fmtPk(z.debut)} → ${fmtPk(z.fin)}`, c: c.ligne ?? '' },
        geometry: { type: 'LineString', coordinates: part },
      });
    }
  }
  // Points d'annonce (un par voie et par sens).
  for (const v of r.voies) {
    const at = auPk(doc, v.pointAnnonce);
    if (!at || v.pointAnnonce === null) continue;
    features.push({
      type: 'Feature',
      properties: {
        role: 'pa',
        label: `PA ${v.voie} ${SENS_FLECHE[v.sens]}`,
        n: `Point d’annonce ${v.voie} ${SENS_FLECHE[v.sens]}`,
        pk: fmtPk(v.pointAnnonce),
        d: `${v.distance} m en amont du chantier · ${v.vitesse} km/h · délai ${v.da} s`,
        c: c.ligne ?? '',
      },
      geometry: { type: 'Point', coordinates: at },
    });
  }
  // Agents du dispositif.
  const codes = codesAgents(c.agents);
  for (const a of c.agents) {
    const at = auPk(doc, a.pk);
    if (!at || a.pk === null) continue;
    features.push({
      type: 'Feature',
      properties: {
        role: a.role === 'sentinelle' ? 'sentinelle' : a.role === 'asp' ? 'asp' : 'agent',
        label: codes.get(a.id) ?? '',
        n: `${codes.get(a.id)} · ${ROLE_LABEL[a.role]}${a.nom.trim() ? ` · ${a.nom.trim()}` : ''}`,
        pk: fmtPk(a.pk),
        c: c.ligne ?? '',
      },
      geometry: { type: 'Point', coordinates: at },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Emprise à montrer : la zone et ses points d'annonce. */
export function emprise(fc: FeatureCollection): [[number, number], [number, number]] | null {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  const add = (p: number[]) => {
    w = Math.min(w, p[0]);
    e = Math.max(e, p[0]);
    s = Math.min(s, p[1]);
    n = Math.max(n, p[1]);
  };
  for (const f of fc.features) {
    if (f.geometry.type === 'Point') add(f.geometry.coordinates);
    else if (f.geometry.type === 'LineString') f.geometry.coordinates.forEach(add);
  }
  return Number.isFinite(w) ? [[w, s], [e, n]] : null;
}
