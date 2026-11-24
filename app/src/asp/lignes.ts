/** Vitesses de la ligne (données ouvertes SNCF Réseau) autour de la zone de travail. */
import { useEffect, useState } from 'react';
import { loadLine, type LineDoc } from '../lib/data';
import { zoneAnnonce, type Chantier } from './chantier';
import { chantierParId, enregistrer } from './store';

/** Vitesse maximale la plus élevée entre deux PK (km/h), ou null si la ligne n'en donne pas. */
export function vmaxEntre(doc: LineDoc, a: number, b: number): number | null {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let best: number | null = null;
  for (const [s, e, v] of doc.sections.vmax ?? []) {
    if (Math.max(s, e) < lo - 0.001 || Math.min(s, e) > hi + 0.001) continue;
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) best = best === null ? n : Math.max(best, n);
  }
  return best;
}

/** Vitesse de la ligne autour de la zone d'après les données ouvertes (km/h), ou null. */
export function vitesseLigne(c: Chantier, doc: LineDoc | null): number | null {
  if (!doc) return null;
  const z = zoneAnnonce(c);
  if (z.debut === null) return null;
  return vmaxEntre(doc, z.debut, z.fin ?? z.debut);
}

/**
 * Chantier tout juste placé sur une ligne (depuis la position) : propose la vitesse de la ligne aux voies.
 * Ne touche à rien si une vitesse a déjà été saisie, ni si la fiche a changé de ligne pendant le chargement.
 */
export async function proposerVitesses(id: string): Promise<number | null> {
  const avant = chantierParId(id);
  if (!avant?.ligne) return null;
  let doc: LineDoc;
  try {
    doc = await loadLine(avant.ligne);
  } catch {
    return null;
  }
  const c = chantierParId(id); // relue : l'agent a pu la modifier pendant le chargement
  if (!c || c.ligne !== avant.ligne || !c.voies.length || c.voies.some((v) => v.vitesse !== null)) return null;
  const v = vitesseLigne(c, doc);
  if (v === null) return null;
  enregistrer({ ...c, voies: c.voies.map((x) => ({ ...x, vitesse: v })) });
  return v;
}

/** Fiche de la ligne du chantier (chargée à la demande, gardée par l'appli pour le hors-ligne). */
export function useLigne(code: string | null): { doc: LineDoc | null; erreur: string | null } {
  const [state, setState] = useState<{ code: string | null; doc: LineDoc | null; erreur: string | null }>({ code: null, doc: null, erreur: null });
  useEffect(() => {
    if (!code || !/^\d{6}$/.test(code)) return;
    let cancel = false;
    loadLine(code).then(
      (doc) => !cancel && setState({ code, doc, erreur: null }),
      (e: Error) => !cancel && setState({ code, doc: null, erreur: e.message || 'Ligne indisponible.' }),
    );
    return () => {
      cancel = true;
    };
  }, [code]);
  return state.code === code ? { doc: state.doc, erreur: state.erreur } : { doc: null, erreur: null };
}
