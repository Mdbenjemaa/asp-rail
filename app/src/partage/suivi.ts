/**
 * Le chantier partagé tourne tout seul tant que l'appli est ouverte : lecture de ce que partagent les autres
 * toutes les 30 secondes (et au retour sur l'appli), et envoi de ce que ce téléphone partage dès qu'il change
 * (au moins toutes les 2 minutes, pour dire « toujours là »). Un lien « #chantier=K7P-3QX » fait rejoindre la session.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { calculChantier } from '../asp/chantier';
import { useChantiers } from '../asp/store';
import { useMissionsLam } from '../lam/mission';
import { loadLine } from '../lib/data';
import { useMissions } from '../pn/mission';
import { donneesChantier, donneesLam, donneesPn, type Donnees } from './donnees';
import { envoyer, magasin, RAISON_TEXTE, rafraichir, rejoindre, sessionFromHash, useMonPartage, useSession } from './session';

const LECTURE_MS = 30_000;
const RAPPEL_MS = 120_000;

/** Dernier envoi de ce que partage ce téléphone. */
const envoiStore = magasin<{ t: number | null; erreur: string | null }>(() => ({ t: null, erreur: null }));
export const useEnvoi = () => useSyncExternalStore(envoiStore.abonner, envoiStore.get);

/** Ce que partage ce téléphone, construit depuis le chantier ou la mission choisi (null s'il n'existe plus). */
function useMesDonnees(): (() => Promise<Donnees | null>) | null {
  const moi = useMonPartage();
  const chantiers = useChantiers();
  const missions = useMissions();
  const lams = useMissionsLam();
  return useMemo(() => construireMes(moi, chantiers, missions, lams), [moi, chantiers, missions, lams]);
}

function construireMes(
  moi: ReturnType<typeof useMonPartage>,
  chantiers: ReturnType<typeof useChantiers>,
  missions: ReturnType<typeof useMissions>,
  lams: ReturnType<typeof useMissionsLam>,
): (() => Promise<Donnees | null>) | null {
  if (!moi?.actif) return null;
  if (moi.activite === 'asp') {
    const c = chantiers.find((x) => x.id === moi.id);
    if (!c) return null;
    return async () => donneesChantier(c, calculChantier(c), c.ligne ? await loadLine(c.ligne).catch(() => null) : null);
  }
  if (moi.activite === 'pn') {
    const m = missions.find((x) => x.id === moi.id);
    if (!m) return null;
    return async () => donneesPn(m, m.pn.ligne ? await loadLine(m.pn.ligne).catch(() => null) : null);
  }
  const m = lams.find((x) => x.id === moi.id);
  if (!m) return null;
  return async () => donneesLam(m, m.lieu.ligne ? await loadLine(m.lieu.ligne).catch(() => null) : null);
}

export function useChantierPartage(ouvert: boolean) {
  const session = useSession();
  const moi = useMonPartage();
  const construire = useMesDonnees();
  const [rappel, setRappel] = useState(0);
  const dernier = useRef<{ cle: string; t: number } | null>(null);

  // Lien reçu : « …#chantier=K7P-3QX » → rejoindre, puis l'adresse est nettoyée.
  useEffect(() => {
    if (!ouvert) return;
    const code = sessionFromHash(location.hash);
    if (!code) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    void rejoindre(code).then(
      (raison) => envoiStore.set({ ...envoiStore.get(), erreur: raison ? RAISON_TEXTE[raison] : null }),
      () => envoiStore.set({ ...envoiStore.get(), erreur: 'Pas de réseau : impossible de rejoindre le chantier partagé.' }),
    );
  }, [ouvert]);

  // Lecture régulière tant que l'appli est visible.
  useEffect(() => {
    if (!ouvert || !session) return;
    void rafraichir();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void rafraichir();
    }, LECTURE_MS);
    const retour = () => {
      if (document.visibilityState === 'visible') {
        void rafraichir();
        setRappel((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', retour);
    const rappeler = setInterval(() => setRappel((n) => n + 1), RAPPEL_MS);
    return () => {
      clearInterval(t);
      clearInterval(rappeler);
      document.removeEventListener('visibilitychange', retour);
    };
  }, [ouvert, session]);

  // Envoi de ce que partage ce téléphone, quand ça change ou pour dire « toujours là ».
  useEffect(() => {
    if (!ouvert || !session || !construire || !moi?.actif) return;
    let annule = false;
    const attente = setTimeout(() => void publier(), 1200);
    const publier = async () => {
      const donnees = await construire();
      if (annule || !donnees) return;
      const cle = JSON.stringify([donnees, moi.nom, moi.tel, moi.activite]);
      if (dernier.current && dernier.current.cle === cle && Date.now() - dernier.current.t < RAPPEL_MS - 5_000) return;
      try {
        const raison = await envoyer(donnees);
        if (annule) return;
        if (raison) {
          envoiStore.set({ t: envoiStore.get().t, erreur: RAISON_TEXTE[raison] });
          return;
        }
        dernier.current = { cle, t: Date.now() };
        envoiStore.set({ t: Date.now(), erreur: null });
        void rafraichir();
      } catch {
        if (!annule) envoiStore.set({ t: envoiStore.get().t, erreur: 'Pas de réseau : ton partage sera envoyé dès que possible.' });
      }
    };
    return () => {
      annule = true;
      clearTimeout(attente);
    };
  }, [ouvert, session, construire, moi, rappel]);
}
