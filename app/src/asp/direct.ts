/**
 * Position en direct pour l'accueil : ligne, PK et vitesse de la ligne, mis à jour en continu tant que l'accueil
 * est affiché, seulement si le téléphone a déjà autorisé la position (aucune demande au démarrage). Le GPS
 * s'arrête dès qu'on quitte l'accueil ou que l'appli passe en arrière-plan, pour la batterie.
 */
import { useEffect, useState } from 'react';
import { loadCell, loadLine, loadManifest, type Manifest } from '../lib/data';
import { follow, type Fix } from '../lib/gps';
import { cellsAround, matchInCells, pickFollowLine, searchRadius } from '../lib/locate';
import { vmaxEntre } from './lignes';

export interface Direct {
  code: string;
  nom: string | null;
  /** PK au droit de l'agent (km). */
  pk: number;
  /** Distance entre l'agent et l'axe de la ligne (m). */
  ecart: number;
  /** Précision annoncée par le GPS (m). */
  precision: number;
  /** Vitesse de la ligne à cet endroit, d'après les données ouvertes (km/h). */
  vmax: number | null;
  t: number;
}

/** arret : GPS pas encore autorisé (il faut toucher) · recherche · ok · loin : aucune ligne à moins de 300 m · erreur. */
export type EtatDirect = 'arret' | 'recherche' | 'ok' | 'loin' | 'erreur';

/** Une ligne à plus de 300 m : on ne la donne pas comme « ta » ligne. */
const ECART_MAX = 300;

async function rattacher(fix: Fix, m: Manifest, prefer: string | null): Promise<Omit<Direct, 't'> | null> {
  const radius = Math.max(searchRadius(fix.accuracy), 150);
  const known = new Set(m.cells);
  const cells = (await Promise.all(cellsAround(fix.lonlat, radius, m.cellsPerDegree).map((k) => loadCell(k, known)))).filter((c) => c !== null);
  const best = pickFollowLine(matchInCells(cells, fix.lonlat, radius).lines, prefer, fix.accuracy);
  if (!best || best.dist > ECART_MAX) return null;
  const doc = await loadLine(best.code).catch(() => null);
  return {
    code: best.code,
    nom: m.lines[best.code]?.n ?? null,
    pk: best.pk,
    ecart: best.dist,
    precision: fix.accuracy,
    vmax: doc ? vmaxEntre(doc, best.pk, best.pk) : null,
  };
}

/** La position a-t-elle déjà été autorisée ? (sans rien demander) */
async function autorise(): Promise<boolean> {
  try {
    const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return p?.state === 'granted';
  } catch {
    return false;
  }
}

export function usePositionDirecte(actif: boolean): { etat: EtatDirect; pos: Direct | null } {
  const [etat, setEtat] = useState<EtatDirect>('arret');
  const [pos, setPos] = useState<Direct | null>(null);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    if (!actif || !visible || !('geolocation' in navigator)) return;
    let stop: (() => void) | null = null;
    let fini = false;
    let occupe = false;
    let dernier = 0;
    let ligne: string | null = null;
    void autorise().then(async (ok) => {
      if (fini || !ok) return;
      setEtat((e) => (e === 'ok' ? e : 'recherche'));
      const m = await loadManifest().catch(() => null);
      if (fini || !m) return;
      // Une mesure à la fois, au plus toutes les 1,5 s ; la dernière reçue n'est jamais perdue (le GPS peut se taire ensuite).
      let attente: Fix | null = null;
      let minuterie: ReturnType<typeof setTimeout> | null = null;
      const traiter = () => {
        minuterie = null;
        if (fini || occupe || !attente) return;
        const reste = 1500 - (Date.now() - dernier);
        if (reste > 0) {
          minuterie = setTimeout(traiter, reste);
          return;
        }
        const fix = attente;
        attente = null;
        occupe = true;
        dernier = Date.now();
        rattacher(fix, m, ligne)
          .then((r) => {
            if (fini) return;
            if (!r) {
              setEtat('loin');
              return;
            }
            ligne = r.code;
            setPos({ ...r, t: fix.received });
            setEtat('ok');
          })
          .catch(() => undefined)
          .finally(() => {
            occupe = false;
            if (attente && !minuterie) traiter();
          });
      };
      const arretGps = follow(
        (fix) => {
          attente = fix;
          if (!minuterie) traiter();
        },
        () => {
          if (!fini) setEtat((e) => (e === 'ok' ? e : 'erreur'));
        },
      );
      stop = () => {
        arretGps();
        if (minuterie) clearTimeout(minuterie);
      };
    });
    return () => {
      fini = true;
      stop?.();
    };
  }, [actif, visible]);

  return { etat, pos };
}
