/** Ce que la carte et le GPS prêtent aux écrans de l'ASP, et la liste des écrans qu'on peut ouvrir. */
import type { Manifest } from '../lib/data';
import type { Chantier } from './chantier';

/** Où est l'agent (dernier repérage) : pour remplir la ligne et le PK d'un chantier. */
export interface Here {
  code: string;
  pk: number;
  ligneNom: string | null;
}

export type EtapeId = 'lieu' | 'type' | 'voies' | 'vitesses' | 'outillage' | 'degagement' | 'cas' | 'resultat';

/** Écrans ouverts par-dessus les onglets (le dernier est au-dessus). */
export type Vue =
  | { k: 'assistant'; id: string; etape?: EtapeId; seule?: boolean }
  | { k: 'fiche'; id: string }
  | { k: 'checklists'; id: string }
  | { k: 'chantiers' }
  | { k: 'memo'; section?: string }
  | { k: 'quiz' }
  | { k: 'cas' };

export interface Ctx {
  manifest: Manifest | null;
  here: Here | null;
  locating: boolean;
  locError: string | null;
  onLocate: () => void;
  onToast: (t: string) => void;
  /** Aller à un PK sur la carte (point d'annonce). */
  onGoPk: (code: string, pk: number) => void;
  /** Montrer le chantier sur la carte. */
  onShowMap: (c: Chantier) => void;
  /** Ouvrir un écran par-dessus. */
  open: (v: Vue) => void;
  /** Fermer l'écran du dessus. */
  back: () => void;
  /** Remplacer l'écran du dessus. */
  replace: (v: Vue) => void;
}
