/**
 * Dossiers archivés sur le téléphone (IndexedDB) : le PDF de la clôture, tel qu'il a été signé et téléchargé, avec
 * l'état de son envoi à l'entreprise. Le PDF est gardé en octets (plus sûr que les Blob sur les anciens iPhone).
 */
import { useSyncExternalStore } from 'react';
import { magasin } from '../lib/magasin';
import type { TypeMission } from './cloture';

export type EtatEnvoi = 'attente' | 'envoye' | 'refuse';

export interface Dossier {
  id: string;
  type: TypeMission;
  /** Mission, chantier ou poste archivé. */
  refId: string;
  titre: string;
  /** Date de la mission (AAAA-MM-JJ). */
  date: string;
  agent: string;
  /** Heure de la clôture (ms). */
  cloture: number;
  nomFichier: string;
  taille: number;
  envoi: EtatEnvoi;
  envoyeLe?: number;
  /** Entreprise qui a reçu la copie. */
  entreprise?: string;
  /** Pourquoi l'envoi a été refusé. */
  erreur?: string;
}

interface Enregistrement extends Dossier {
  pdf: ArrayBuffer;
}

const DB = 'asp-archives';
const STORE = 'dossiers';

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await ouvrir();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = run(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(t.error ?? new Error('Enregistrement impossible sur ce téléphone.'));
    };
  });
}

const sansPdf = ({ pdf: _pdf, ...d }: Enregistrement): Dossier => d;

/** Liste en mémoire (sans les PDF), triée du plus récent au plus ancien ; null tant qu'elle n'est pas lue. */
const liste = magasin<Dossier[] | null>(() => null);
let lecture: Promise<void> | null = null;

export function relire(): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    liste.set([]);
    return Promise.resolve();
  }
  lecture = tx<Enregistrement[]>('readonly', (s) => s.getAll() as IDBRequest<Enregistrement[]>)
    .then((all) => liste.set(all.map(sansPdf).sort((a, b) => b.cloture - a.cloture)))
    .catch(() => liste.set([]));
  return lecture;
}

export function useDossiers(): Dossier[] | null {
  const v = useSyncExternalStore(liste.abonner, liste.get);
  if (v === null && !lecture) void relire();
  return v;
}

export async function tousLesDossiers(): Promise<Dossier[]> {
  if (liste.get() === null) await relire();
  return liste.get() ?? [];
}

export async function ajouterDossier(d: Dossier, pdf: ArrayBuffer): Promise<void> {
  await tx('readwrite', (s) => s.put({ ...d, pdf } satisfies Enregistrement));
  await relire();
}

export async function majDossier(id: string, patch: Partial<Dossier>): Promise<void> {
  const e = await tx<Enregistrement | undefined>('readonly', (s) => s.get(id) as IDBRequest<Enregistrement | undefined>);
  if (!e) return;
  await tx('readwrite', (s) => s.put({ ...e, ...patch, id }));
  await relire();
}

/** Le PDF du dossier, tel qu'il a été créé à la clôture. */
export async function fichierDossier(id: string): Promise<File | null> {
  const e = await tx<Enregistrement | undefined>('readonly', (s) => s.get(id) as IDBRequest<Enregistrement | undefined>);
  return e ? new File([e.pdf], e.nomFichier, { type: 'application/pdf' }) : null;
}
