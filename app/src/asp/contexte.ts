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
  | { k: 'memo'; section?: string; banque?: 'asp' | 'pn' | 'lam' }
  | { k: 'quiz'; banque?: 'asp' | 'pn' | 'lam' }
  | { k: 'cas' }
  | { k: 'pn-nouvelle'; id: string; etape?: EtapePn; seule?: boolean }
  | { k: 'pn-mission'; id: string }
  | { k: 'pn-procedure'; id: string; type: 'mobile' | 'lam' }
  | { k: 'pn-diagnostic'; id?: string }
  | { k: 'pn-ordre' }
  | { k: 'pn-missions' }
  | { k: 'lam-nouvelle'; id: string; etape?: EtapeLam; seule?: boolean }
  | { k: 'lam-mission'; id: string }
  | { k: 'lam-ttx'; id: string }
  | { k: 'lam-urgences'; id?: string }
  | { k: 'lam-ordre' }
  | { k: 'lam-missions' }
  | { k: 'lam-dsh' };

export type EtapePn = 'role' | 'pn' | 'equipement' | 'chantier';
export type EtapeLam = 'type' | 'lieu' | 'detail' | 'chantier';

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
