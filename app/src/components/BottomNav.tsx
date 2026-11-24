import { Icon } from './parts';

export type Onglet = 'accueil' | 'carte' | 'calcul' | 'reviser';

const ONGLETS: [Onglet, string, string][] = [
  ['accueil', 'Accueil', 'home'],
  ['carte', 'Carte', 'map'],
  ['calcul', 'Calcul', 'calc'],
  ['reviser', 'Réviser', 'book'],
];

/** Barre du bas, comme les applis du téléphone : quatre onglets, celui ouvert en jaune. */
export function BottomNav({ tab, onTab, alerte }: { tab: Onglet; onTab: (t: Onglet) => void; alerte?: boolean }) {
  return (
    <nav className="ds-nav" aria-label="Navigation principale">
      {ONGLETS.map(([id, label, ic]) => (
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
