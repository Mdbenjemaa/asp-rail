/** Mon poste sur la carte : moi (A1…), les points d'annonce que je dois voir, et le trait jusqu'à eux. */
import type { Feature, FeatureCollection } from 'geojson';
import type { LineDoc } from '../lib/data';
import { fmtPk } from '../lib/format';
import { lineBetween, positionsAtPk } from '../lib/pk';
import { metres } from '../asp/dispositif';
import { ecartPa, ROLE_CHAINE, type Poste } from './poste';

export function posteFeatures(p: Poste, doc: LineDoc): FeatureCollection {
  const features: Feature[] = [];
  const at = (pk: number | null) => (pk === null ? null : (positionsAtPk(doc, pk)[0]?.lonlat ?? null));
  for (const pa of p.pas) {
    const ecart = ecartPa(p, pa);
    if (p.pk !== null && ecart !== null && ecart > 5) {
      for (const part of lineBetween(doc, p.pk, pa.pk)) {
        features.push({ type: 'Feature', properties: { role: 'vue', etat: 'voir', o: 0, label: `${p.code} → ${pa.titre} · ${metres(ecart)}` }, geometry: { type: 'LineString', coordinates: part } });
      }
    }
    const pt = at(pa.pk);
    if (pt) features.push({ type: 'Feature', properties: { role: 'pa', label: pa.titre, n: pa.titre, pk: fmtPk(pa.pk), c: p.ligne ?? '', poste: p.id }, geometry: { type: 'Point', coordinates: pt } });
  }
  const moi = at(p.pk);
  if (moi && p.pk !== null) {
    features.push({
      type: 'Feature',
      properties: { role: 'agent', label: p.code, n: `${p.code} · ${ROLE_CHAINE[p.role]} (mon poste)`, pk: fmtPk(p.pk), c: p.ligne ?? '', poste: p.id },
      geometry: { type: 'Point', coordinates: moi },
    });
  }
  return { type: 'FeatureCollection', features };
}
