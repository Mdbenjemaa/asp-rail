import { Icon } from './parts';

export type Onglet = 'accueil' | 'carte' | 'calcul' | 'reviser';

const ONGLETS: [Onglet, string, string][] = [
  ['accueil', 'Accueil', 'home'],
  ['carte', 'Carte', 'map'],
  ['calcul', 'Calcul', 'calc'],
  ['reviser', 'Réviser', 'book'],
];

/** 3e onglet selon l'activité : « Calcul » (annonce), « Dérangement » (agent PN), « Urgences » (LAM / S9). */
const TROISIEME: Record<'asp' | 'pn' | 'lam', [string, string]> = { asp: ['Calcul', 'calc'], pn: ['Dérangement', 'alert'], lam: ['Urgences', 'alert'] };

/** Barre du bas, comme les applis du téléphone : quatre onglets, celui ouvert en jaune. */
export function BottomNav({
  tab,
  onTab,
  alerte,
  activite = 'asp',
  sansReviser = false,
}: {
  tab: Onglet;
  onTab: (t: Onglet) => void;
  alerte?: boolean;
  activite?: 'asp' | 'pn' | 'lam';
  /** Pas de mémo ni de quiz pour l'entreprise : pas d'onglet « Réviser ». */
  sansReviser?: boolean;
}) {
  const onglets: [Onglet, string, string][] = ONGLETS.filter(([id]) => !(sansReviser && id === 'reviser')).map(([id, label, ic]) =>
    id === 'calcul' ? [id, ...TROISIEME[activite]] : [id, label, ic],
  );
  return (
    <nav className="ds-nav" aria-label="Navigation principale" style={{ gridTemplateColumns: `repeat(${onglets.length}, minmax(0, 1fr))` }}>
      {onglets.map(([id, label, ic]) => (
        <button key={id} className="ds-nav-btn" aria-current={tab === id ? 'page' : undefined} onClick={() => onTab(id)}>
          <span className="ds-nav-ico">
            <Icon name={ic} />
            {alerte && id === 'accueil' && <i className="ds-nav-dot" aria-label="Chantier à régler" />}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}
