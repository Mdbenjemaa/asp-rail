/**
 * Envoi des dossiers archivés à l'entreprise de l'agent (fonction serveur « asp-archive », avec le code d'accès).
 * Sans réseau, le dossier attend : l'appli réessaie à l'ouverture, au retour du réseau et toutes les 5 minutes.
 */
import { useEffect } from 'react';
import { loadAccess } from '../access/gate';
import { PREVIEW } from '../lib/env';
import { SB_KEY, SB_URL } from '../lib/server';
import { fichierDossier, majDossier, tousLesDossiers, type Dossier } from './dossiers';

export const RAISON_ENVOI: Record<string, string> = {
  acces: 'Code d’accès coupé ou arrivé à sa fin : demande un nouveau code, puis réessaie.',
  trop: 'Trop de dossiers envoyés aujourd’hui avec ce code : nouvel essai plus tard.',
  taille: 'Dossier trop lourd pour l’envoi (10 Mo au plus).',
  donnees: 'Dossier refusé par le serveur.',
};

async function base64(f: File): Promise<string> {
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Dossiers en cours d'envoi : un seul envoi à la fois par dossier (clôture, renvoi et envoi automatique). */
const enVol = new Map<string, Promise<Dossier['envoi']>>();

/** Envoie un dossier ; renvoie son nouvel état. Lève une erreur sans réseau (il reste « en attente »). */
export function envoyerDossier(d: Dossier): Promise<Dossier['envoi']> {
  const deja = enVol.get(d.id);
  if (deja) return deja;
  const p = envoyer(d).finally(() => enVol.delete(d.id));
  enVol.set(d.id, p);
  return p;
}

async function envoyer(d: Dossier): Promise<Dossier['envoi']> {
  // Déjà reçu entre-temps (liste lue avant un autre envoi) : rien à refaire.
  const actuel = (await tousLesDossiers()).find((x) => x.id === d.id);
  if (actuel?.envoi === 'envoye') return 'envoye';
  const acces = loadAccess();
  const f = await fichierDossier(d.id);
  if (!acces || !f) return d.envoi;
  const res = await fetch(`${SB_URL}/functions/v1/asp-archive`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: acces.code,
      ref: d.id,
      type: d.type,
      titre: d.titre,
      date: d.date,
      agent: d.agent,
      cloture_le: d.cloture,
      nom_fichier: d.nomFichier,
      pdf: await base64(f),
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const r = (await res.json().catch(() => ({ ok: false, raison: 'serveur' }))) as { ok?: boolean; raison?: string; entreprise?: string };
  if (r.ok) {
    await majDossier(d.id, { envoi: 'envoye', envoyeLe: Date.now(), entreprise: r.entreprise || d.entreprise, erreur: undefined });
    return 'envoye';
  }
  const raison = r.raison ?? 'serveur';
  if (raison === 'serveur' || raison === 'trop') {
    await majDossier(d.id, { envoi: 'attente', erreur: RAISON_ENVOI[raison] });
    return 'attente';
  }
  await majDossier(d.id, { envoi: 'refuse', erreur: RAISON_ENVOI[raison] ?? RAISON_ENVOI.donnees });
  return 'refuse';
}

let enCours = false;
/** Envoie les dossiers en attente, un par un. */
export async function envoyerEnAttente(): Promise<void> {
  if (enCours || PREVIEW || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  enCours = true;
  try {
    for (const d of await tousLesDossiers()) {
      if (d.envoi !== 'attente') continue;
      try {
        await envoyerDossier(d);
      } catch {
        break; // pas de réseau : on réessaiera
      }
    }
  } finally {
    enCours = false;
  }
}

/** À l'ouverture de l'appli, au retour du réseau et toutes les 5 minutes : les dossiers en attente partent. */
export function useEnvoiDossiers() {
  useEffect(() => {
    const go = () => void envoyerEnAttente();
    const t0 = setTimeout(go, 3000);
    const t = setInterval(go, 5 * 60_000);
    window.addEventListener('online', go);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
      window.removeEventListener('online', go);
    };
  }, []);
}
