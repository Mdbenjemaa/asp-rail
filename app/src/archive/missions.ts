/**
 * Les quatre sortes de mission vues par la clôture : chantier de l'ASP, mission PN, mission LAM / S9, poste dans la
 * chaîne. Pour chacune : son titre, si elle est finie, comment créer son dossier PDF, et comment la marquer clôturée.
 */
import { useMemo } from 'react';
import { calculChantier, titreChantier, type Chantier } from '../asp/chantier';
import type { Constructeur } from '../asp/ExportPdf';
import { today } from '../asp/etat';
import { finie } from '../asp/deroule';
import { chantierActifId, chantierParId, definirActif, enregistrer, useTousLesChantiers } from '../asp/store';
import { enregistrerPoste, posteParId, titrePoste, useTousLesPostes, type Poste } from '../chaine/poste';
import { enregistrerMissionLam, missionLamParId, titreMissionLam, useToutesMissionsLam, type MissionLam } from '../lam/mission';
import { loadLine } from '../lib/data';
import { newId } from '../lib/collection';
import { enregistrerMission, missionParId, titreMission, useToutesMissions, type Mission } from '../pn/mission';
import { aCloturer, nomDossier, type Cloture, type TypeMission } from './cloture';
import { ajouterDossier, type Dossier } from './dossiers';
import { envoyerDossier } from './envoi';

type Une = { type: 'asp'; x: Chantier } | { type: 'pn'; x: Mission } | { type: 'lam'; x: MissionLam } | { type: 'chaine'; x: Poste };

export function trouver(type: TypeMission, id: string): Une | null {
  if (type === 'asp') {
    const x = chantierParId(id);
    return x ? { type, x } : null;
  }
  if (type === 'pn') {
    const x = missionParId(id);
    return x ? { type, x } : null;
  }
  if (type === 'lam') {
    const x = missionLamParId(id);
    return x ? { type, x } : null;
  }
  const x = posteParId(id);
  return x ? { type, x } : null;
}

export function titreDe(u: Une): string {
  return u.type === 'asp' ? titreChantier(u.x) : u.type === 'pn' ? titreMission(u.x) : u.type === 'lam' ? titreMissionLam(u.x) : titrePoste(u.x);
}

export const estFinie = (u: Une) => (u.type === 'asp' ? finie(u.x.deroule) : u.x.fin !== null);

/** Ce qu'il faut pour créer le dossier : signatures, textes, et la fabrique du PDF. */
export interface Preparation {
  titre: string;
  docId: string;
  defautNom: string;
  second?: { titre: string; defautNom: string };
  intro: string;
  preparer: () => Promise<Constructeur>;
}

const enDossier =
  (f: Constructeur): Constructeur =>
  (info) => {
    const fichier = f(info);
    return new File([fichier], nomDossier(fichier.name), { type: 'application/pdf' });
  };

export function preparation(u: Une): Preparation {
  const pasFinie = !estFinie(u);
  if (u.type === 'asp') {
    const c = u.x;
    return {
      titre: titreChantier(c),
      docId: `${c.id}:cr`,
      defautNom: c.asp,
      second: { titre: 'Responsable du chantier', defautNom: c.responsable },
      intro: pasFinie
        ? 'La levée du dispositif n’est pas notée : les heures manquantes resteront « non noté ». Le dossier regroupe le compte rendu et la fiche CADA.'
        : 'Le dossier regroupe le compte rendu de l’intervention et la fiche CADA. Le responsable du chantier peut signer ici aussi.',
      preparer: async () => {
        const [{ dossierChantierPdf }, ligne] = await Promise.all([import('../asp/pdf'), c.ligne ? loadLine(c.ligne).catch(() => null) : Promise.resolve(null)]);
        return enDossier((info) => {
          const x = chantierParId(c.id) ?? c;
          return dossierChantierPdf(x, calculChantier(x), info, ligne);
        });
      },
    };
  }
  if (u.type === 'pn') {
    const m = u.x;
    return {
      titre: titreMission(m),
      docId: m.id,
      defautNom: '',
      intro: pasFinie ? 'La mission n’est pas terminée : les étapes non faites resteront à faire dans le dossier.' : 'Le dossier reprend tout le journal de la mission, avec le plan et les dépêches.',
      preparer: async () => {
        const [{ journalPnPdf }, ligne] = await Promise.all([import('../pn/pdf'), m.pn.ligne ? loadLine(m.pn.ligne).catch(() => null) : Promise.resolve(null)]);
        return enDossier((info) => journalPnPdf(missionParId(m.id) ?? m, info, ligne));
      },
    };
  }
  if (u.type === 'lam') {
    const m = u.x;
    return {
      titre: titreMissionLam(m),
      docId: m.id,
      defautNom: '',
      intro: pasFinie ? 'La mission n’est pas terminée : les étapes non faites resteront à faire dans le dossier.' : 'Le dossier reprend tout le journal de la mission, avec le plan et le carnet de dépêches.',
      preparer: async () => {
        const [{ journalLamPdf }, ligne] = await Promise.all([import('../lam/pdf'), m.lieu.ligne ? loadLine(m.lieu.ligne).catch(() => null) : Promise.resolve(null)]);
        return enDossier((info) => journalLamPdf(missionLamParId(m.id) ?? m, info, ligne));
      },
    };
  }
  const p = u.x;
  return {
    titre: titrePoste(p),
    docId: `${p.id}:cr`,
    defautNom: '',
    second: { titre: 'ASP', defautNom: p.asp },
    intro: pasFinie ? 'La fin de poste n’est pas notée : elle restera « non notée » dans le dossier.' : 'Le dossier reprend ton poste, tes horaires, les trains annoncés et les incidents. Ton ASP peut signer ici aussi.',
    preparer: async () => {
      const { compteRenduPostePdf } = await import('../chaine/pdf');
      return enDossier((info) => compteRenduPostePdf(posteParId(p.id) ?? p, info));
    },
  };
}

/** Pose la marque de clôture sur la mission (elle est ensuite verrouillée). */
function marquer(u: Une, cloture: Cloture): boolean {
  if (u.type === 'asp') {
    const ok = enregistrer({ ...u.x, cloture });
    if (chantierActifId() === u.x.id) definirActif(null);
    return ok;
  }
  if (u.type === 'pn') return enregistrerMission({ ...u.x, cloture });
  if (u.type === 'lam') return enregistrerMissionLam({ ...u.x, cloture });
  return enregistrerPoste({ ...u.x, cloture });
}

/**
 * Clôture : le dossier est gardé sur le téléphone, la mission est marquée clôturée (verrouillée), puis la copie part à
 * l'entreprise (ou attend le réseau). Renvoie le dossier.
 */
export async function cloturer(type: TypeMission, id: string, file: File, x: { agent: string; t: number }): Promise<Dossier> {
  const u = trouver(type, id);
  if (!u) throw new Error('Mission introuvable sur ce téléphone.');
  if (u.x.cloture) throw new Error('Mission déjà clôturée.');
  const d: Dossier = {
    id: newId(),
    type,
    refId: id,
    titre: titreDe(u),
    date: u.x.date,
    agent: x.agent,
    cloture: x.t,
    nomFichier: file.name,
    taille: file.size,
    envoi: 'attente',
  };
  await ajouterDossier(d, await file.arrayBuffer());
  if (!marquer(u, { le: x.t, par: x.agent, archive: d.id })) throw new Error('Le téléphone a refusé d’enregistrer la clôture (stockage plein ?).');
  void envoyerDossier(d).catch(() => undefined);
  return d;
}

export interface ACloturer {
  type: TypeMission;
  id: string;
  titre: string;
  date: string;
  finie: boolean;
}

/** Missions finies (ou passées) pas encore clôturées, de la plus ancienne à la plus récente. */
export function useACloturer(): ACloturer[] {
  const chantiers = useTousLesChantiers();
  const pn = useToutesMissions();
  const lam = useToutesMissionsLam();
  const postes = useTousLesPostes();
  return useMemo(() => {
    const j = today();
    const tout: Une[] = [
      ...chantiers.map((x) => ({ type: 'asp' as const, x })),
      ...pn.map((x) => ({ type: 'pn' as const, x })),
      ...lam.map((x) => ({ type: 'lam' as const, x })),
      ...postes.map((x) => ({ type: 'chaine' as const, x })),
    ];
    return tout
      .filter((u) => aCloturer(u.x, estFinie(u), j))
      .map((u) => ({ type: u.type, id: u.x.id, titre: titreDe(u), date: u.x.date, finie: estFinie(u) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [chantiers, pn, lam, postes]);
}

/** Missions archivées : identifiant → sorte de mission (pour ouvrir leur archive au lieu de l'écran de saisie). */
export function useArchivees(): Map<string, TypeMission> {
  const chantiers = useTousLesChantiers();
  const pn = useToutesMissions();
  const lam = useToutesMissionsLam();
  const postes = useTousLesPostes();
  return useMemo(() => {
    const m = new Map<string, TypeMission>();
    for (const x of chantiers) if (x.cloture) m.set(x.id, 'asp');
    for (const x of pn) if (x.cloture) m.set(x.id, 'pn');
    for (const x of lam) if (x.cloture) m.set(x.id, 'lam');
    for (const x of postes) if (x.cloture) m.set(x.id, 'chaine');
    return m;
  }, [chantiers, pn, lam, postes]);
}
