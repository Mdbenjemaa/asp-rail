/**
 * Clôture de fin de mission : l'agent (ASP, agent PN, AP LAM / S9, annonceur, répétiteur, sentinelle) crée son
 * dossier PDF complet et signé, le télécharge, et la mission est archivée : verrouillée sur le téléphone, rangée dans
 * « Mes archives », et une copie part à son entreprise. Tant qu'une mission finie n'est pas clôturée, l'accueil le
 * rappelle.
 */

export type TypeMission = 'asp' | 'pn' | 'lam' | 'chaine';

/** Marque posée sur la mission à la clôture : plus rien ne la modifie ensuite. */
export interface Cloture {
  /** Heure de la clôture (ms). */
  le: number;
  /** Agent qui a clôturé (nom écrit sur le dossier). */
  par: string;
  /** Identifiant du dossier archivé sur le téléphone. */
  archive: string;
}

export const TYPE_MISSION_LABEL: Record<TypeMission, string> = {
  asp: 'Annonce (ASP)',
  pn: 'Agent PN',
  lam: 'AP LAM / S9',
  chaine: 'Chaîne d’annonce',
};

/** Au-delà, une mission passée n'est plus rappelée (elle reste à clôturer depuis sa fiche). */
export const RAPPEL_JOURS = 14;

/** « AAAA-MM-JJ » d'aujourd'hui moins `n` jours, à l'heure du téléphone. */
export function jourMoins(aujourdhui: string, n: number): string {
  const [y, m, d] = aujourdhui.split('-').map(Number);
  const t = new Date(y, m - 1, d - n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/**
 * Mission à clôturer : pas encore clôturée, et finie (fin notée) ou d'un jour passé, depuis moins de RAPPEL_JOURS jours.
 * Une mission passée plus ancienne n'est pas rappelée.
 */
export function aCloturer(x: { cloture?: Cloture | null; brouillon?: boolean; date: string }, finie: boolean, aujourdhui: string): boolean {
  if (x.cloture || x.brouillon) return false;
  if (x.date < jourMoins(aujourdhui, RAPPEL_JOURS)) return false;
  return finie || x.date < aujourdhui;
}

/** « Dossier-Journal-PN-26-… .pdf » : le nom du fichier du dossier, d'après celui du document. */
export const nomDossier = (nom: string) => (nom.startsWith('Dossier-') ? nom : `Dossier-${nom}`);
