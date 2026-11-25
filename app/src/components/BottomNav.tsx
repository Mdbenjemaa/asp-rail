import { Icon } from './parts';

export type Onglet = 'accueil' | 'carte' | 'calcul' | 'reviser';

const ONGLETS: [Onglet, string, string][] = [
  ['accueil', 'Accueil', 'home'],
  ['carte', 'Carte', 'map'],
  ['calcul', 'Calcul', 'calc'],
  ['reviser', 'Réviser', 'book'],
];

/** Barre du bas, comme les applis du téléphone : quatre onglets, celui ouvert en jaune. En activité PN, « Calcul » devient « Dérangement ». */
export function BottomNav({ tab, onTab, alerte, pn }: { tab: Onglet; onTab: (t: Onglet) => void; alerte?: boolean; pn?: boolean }) {
  const onglets: [Onglet, string, string][] = ONGLETS.map(([id, label, ic]) => (pn && id === 'calcul' ? [id, 'Dérangement', 'alert'] : [id, label, ic]));
  return (
    <nav className="ds-nav" aria-label="Navigation principale">
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
