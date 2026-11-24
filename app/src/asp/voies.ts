/** Voies du chantier : plateformes types et contrôle de la vitesse le long de la ligne (sans écran). */
import type { LineDoc } from '../lib/data';
import { nouvelleVoie, SENS_FLECHE } from './chantier';
import { vmaxEntre } from './lignes';
import type { Alerte, Resultat, Voie } from './rules';

/** Plateformes types, pour démarrer vite. */
export const MODELES: { id: string; label: string; sub: string; voies: () => Voie[] }[] = [
  { id: 'dv', label: 'Double voie', sub: 'V1 vers les PK croissants, V2 vers les PK décroissants', voies: () => [nouvelleVoie('V1', 'croissant', 'travail'), nouvelleVoie('V2', 'decroissant', 'contigue')] },
  { id: 'vu', label: 'Voie unique', sub: 'Une voie, circulations dans les deux sens', voies: () => [nouvelleVoie('VU', 'deux', 'travail')] },
  { id: 'banal', label: '2 voies banalisées', sub: 'Les deux sens sur chaque voie', voies: () => [nouvelleVoie('V1', 'deux', 'travail'), nouvelleVoie('V2', 'deux', 'contigue')] },
  {
    id: 'quatre',
    label: '4 voies',
    sub: 'V1bis, V1, V2, V2bis',
    voies: () => [
      nouvelleVoie('V1bis', 'croissant', 'contigue'),
      nouvelleVoie('V1', 'croissant', 'travail'),
      nouvelleVoie('V2', 'decroissant', 'contigue'),
      nouvelleVoie('V2bis', 'decroissant', 'hors'),
    ],
  },
];

/** Contrôle de la vitesse : entre le point d'annonce et le chantier, prendre la vitesse la plus importante. */
export function alertesVitesse(r: Resultat, doc: LineDoc | null): Alerte[] {
  if (!doc) return [];
  const out: Alerte[] = [];
  for (const v of r.voies) {
    if (v.pointAnnonce === null || v.limiteAmont === null) continue;
    const max = vmaxEntre(doc, v.pointAnnonce, v.limiteAmont);
    if (max !== null && max > v.vitesse) {
      out.push({
        niveau: 'attention',
        texte: `${v.voie} ${SENS_FLECHE[v.sens]} : la ligne monte à ${max} km/h entre le point d’annonce et le chantier (données ouvertes). En cas de rupture de vitesse, prends la vitesse la plus importante.`,
      });
    }
  }
  return out;
}

/** Plateforme type qui correspond aux voies (noms et sens), ou null si elle a été réglée à la main. */
export function modeleDe(voies: Voie[]): string | null {
  const sig = (vs: Voie[]) => vs.map((v) => `${v.nom}:${v.sens}`).join('|');
  const s = sig(voies);
  return MODELES.find((m) => sig(m.voies()) === s)?.id ?? null;
}
