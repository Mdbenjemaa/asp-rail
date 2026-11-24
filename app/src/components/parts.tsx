import { useState, type ReactNode } from 'react';
import { fmtDist } from '../lib/format';
import { itemDetail } from '../lib/lineinfo';
import { pkText } from './hooks';
import { KIND_BADGE } from '../lib/layers';
import type { AroundItem } from '../lib/nearby';
import { signalImage, SIGNAL_ICONS } from '../lib/signaux';

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.3, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3.5 10.8 12 4l8.5 6.8V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5A1.5 1.5 0 0 1 3.5 19z" {...STROKE} />,
  map: <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2zM9 4.5v13M15 6.5v13" {...STROKE} />,
  calc: (
    <>
      <rect x="5" y="2.8" width="14" height="18.4" rx="2.6" {...STROKE} />
      <path d="M8.6 7.2h6.8M8.8 11.6h.01M12 11.6h.01M15.2 11.6h.01M8.8 15.4h.01M12 15.4h.01M15.2 15.4h.01M8.8 18.2h.01M12 18.2h.01M15.2 18.2h.01" {...STROKE} strokeWidth={2.6} />
    </>
  ),
  book: <path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2zM5 20a2 2 0 0 0 2 2h12v-4M9 7.5h6" {...STROKE} />,
  plus: <path d="M12 5v14M5 12h14" {...STROKE} strokeWidth={2.6} />,
  share: <path d="M12 3.5v11M7.8 7.7 12 3.5l4.2 4.2M5.5 12.5v6a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6" {...STROKE} />,
  check: <path d="M5 12.6 9.6 17 19 7.5" {...STROKE} strokeWidth={2.6} />,
  edit: <path d="M4.5 19.5h3.8L19 8.8 15.2 5 4.5 15.7zM13.4 6.8l3.8 3.8" {...STROKE} />,
  people: (
    <>
      <circle cx="9" cy="8.2" r="3.4" {...STROKE} />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0M15.8 4.9a3.4 3.4 0 0 1 0 6.6M18 14.3a6 6 0 0 1 3.2 5.7" {...STROKE} />
    </>
  ),
  list: <path d="M10 6.5h10M10 12h10M10 17.5h10M3.8 6.4l1.4 1.4 2.4-2.6M3.8 11.9l1.4 1.4 2.4-2.6M3.8 17.4l1.4 1.4 2.4-2.6" {...STROKE} />,
  sliders: (
    <>
      <path d="M4 7h9M19 7h1M4 17h3M13 17h7" {...STROKE} />
      <circle cx="16" cy="7" r="2.6" {...STROKE} />
      <circle cx="10" cy="17" r="2.6" {...STROKE} />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" {...STROKE} />
      <path d="M12 7.5V12l3 2" {...STROKE} />
    </>
  ),
  tool: <path d="M14.6 3.6a4.6 4.6 0 0 0-5.3 6.1L3.8 15.2a1.9 1.9 0 0 0 0 2.7l2.3 2.3a1.9 1.9 0 0 0 2.7 0l5.5-5.5a4.6 4.6 0 0 0 6.1-5.3l-2.9 2.9-2.8-.6-.6-2.8z" {...STROKE} />,
  speed: (
    <>
      <path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0" {...STROKE} />
      <path d="m12 14.5 4.2-4.6" {...STROKE} />
      <circle cx="12" cy="14.5" r="1.4" fill="currentColor" />
    </>
  ),
  moon: <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z" {...STROKE} />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7" {...STROKE} />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.2" {...STROKE} />
      <path d="M15.5 8.5v-3a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" {...STROKE} />
    </>
  ),
  file: <path d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM13.5 3v5h5M8.5 13h7M8.5 16.5h5" {...STROKE} />,
  message: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h0A1.5 1.5 0 0 1 4 15.5zM8 9h8M8 12.5h5" {...STROKE} />,
  flag: <path d="M5.5 21V3.8M5.5 4.5h11.2l-2.2 4 2.2 4H5.5" {...STROKE} />,
  nav: <path d="M12 3.2 19 20.5l-7-4-7 4z" {...STROKE} />,
  go: <path d="M5.5 19.5V14a4.5 4.5 0 0 1 4.5-4.5h9M15 5.5l4 4-4 4" {...STROKE} strokeWidth={2.5} />,
  arrow: <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" {...STROKE} strokeWidth={2.5} />,
  tracks: <path d="M4 8h16M4 16h16M7 5v14M12 5v14M17 5v14" {...STROKE} strokeWidth={2} />,
  sparkle: <path d="M12 3.5 13.9 10 20.5 12l-6.6 2L12 20.5 10.1 14 3.5 12l6.6-2z" {...STROKE} />,
  warn: (
    <>
      <circle cx="12" cy="12" r="8.8" {...STROKE} />
      <path d="M12 7.5v5.2M12 15.8v.3" {...STROKE} strokeWidth={2.6} />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" {...STROKE} />
      <path d="M20 20l-4-4" {...STROKE} />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5z" fill="currentColor" />,
  locate: (
    <>
      <circle cx="12" cy="12" r="7" {...STROKE} strokeWidth={2.2} />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...STROKE} strokeWidth={2.2} />
    </>
  ),
  layers: (
    <>
      <path d="M12 3 2 8l10 5 10-5-10-5z" {...STROKE} strokeWidth={2} />
      <path d="M2 13l10 5 10-5M2 17.5l10 5 10-5" {...STROKE} strokeWidth={2} />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" {...STROKE} strokeWidth={2.6} />,
  right: <path d="M9 6l6 6-6 6" {...STROKE} strokeWidth={2.6} />,
  down: <path d="M6 9l6 6 6-6" {...STROKE} strokeWidth={2.6} />,
  chevup: <path d="M6 15l6-6 6 6" {...STROKE} strokeWidth={2.6} />,
  up: <path d="M12 19V5M6 11l6-6 6 6" {...STROKE} strokeWidth={2.6} />,
  dn: <path d="M12 5v14M6 13l6 6 6-6" {...STROKE} strokeWidth={2.6} />,
  here: <circle cx="12" cy="12" r="4.5" fill="currentColor" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  close: <path d="M6 6l12 12M18 6L6 18" {...STROKE} strokeWidth={2.4} />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" {...STROKE} strokeWidth={2.2} />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" {...STROKE} strokeWidth={2.2} />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" {...STROKE} strokeWidth={2} />
      <path d="M12 11v6M12 7.5v.5" {...STROKE} strokeWidth={2.4} />
    </>
  ),
  train: (
    <>
      <rect x="6" y="3" width="12" height="14" rx="3" {...STROKE} strokeWidth={2} />
      <path d="M6 10h12M9 17l-2 4M15 17l2 4" {...STROKE} strokeWidth={2} />
      <circle cx="9.5" cy="13.5" r="1.2" fill="currentColor" />
      <circle cx="14.5" cy="13.5" r="1.2" fill="currentColor" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" {...STROKE} strokeWidth={2.2} />
      <circle cx="12" cy="9.5" r="2.5" fill="currentColor" />
    </>
  ),
  line: <path d="M4 20L20 4M7 20l-3-3M20 7l-3-3M9.5 14.5l-2-2M14.5 9.5l-2-2" {...STROKE} strokeWidth={2.2} />,
  door: (
    <>
      <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3 21h18" {...STROKE} strokeWidth={2.2} />
      <circle cx="14.5" cy="12.5" r="1.3" fill="currentColor" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" {...STROKE} strokeWidth={2.2} />
      <path d="M4 4v4.5h4.5M12 8v4.5l3 2" {...STROKE} strokeWidth={2.2} />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 21.5 20h-19z" {...STROKE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M12 9.5v5M12 17.2v.3" {...STROKE} strokeWidth={2.4} />
    </>
  ),
  vest: (
    <>
      <path d="M8.5 3 5 5.2V21h6V9.5L8.5 3zM15.5 3 19 5.2V21h-6V9.5L15.5 3z" {...STROKE} strokeWidth={2} />
      <path d="M5 15.5h6M13 15.5h6" {...STROKE} strokeWidth={2.4} />
    </>
  ),
  compass: (
    <>
      <path d="M12 2.5l4.2 9.5H7.8z" fill="#dc2626" />
      <path d="M12 21.5L7.8 12h8.4z" fill="currentColor" opacity="0.45" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

/** Icônes en traits arrondis (24 × 24). */
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** Le dessin du signal quand on le connaît, sinon une pastille de couleur selon le type. */
export function Badge({ kind, ic, size = 'md' }: { kind: string; ic?: string; size?: 'md' | 'lg' | 'xl' }) {
  const b = KIND_BADGE[kind] ?? { text: '?', color: '#6b7280', name: kind };
  if (ic && SIGNAL_ICONS) {
    return (
      <span className={`badge-sig ${size}`} title={b.name}>
        <img src={signalImage(ic)} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className={`badge ${size}`} style={{ background: b.color }} title={b.name}>
      {b.text}
    </span>
  );
}

export function ItemRow({ it, here, onFocus }: { it: AroundItem; here?: boolean; onFocus: (at: [number, number]) => void }) {
  return (
    <li>
      <button className="item" onClick={() => onFocus(it.lonlat)}>
        <Badge kind={it.kind} ic={it.ic} size="lg" />
        <span className="item-main">
          <b>{it.label}</b>
          <small>
            {pkText(it)}
            {it.detail ? ` · ${itemDetail(it.kind, it.detail)}` : ''}
          </small>
        </span>
        <span className="item-dist">{here ? 'ici' : fmtDist(it.dist)}</span>
      </button>
    </li>
  );
}

/** Liste repliable (ouverte au départ) des éléments dans un sens de la ligne. */
export function Deroulant({ dir, items, onFocus }: { dir: 1 | -1; items: AroundItem[]; onFocus: (at: [number, number]) => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`deroulant ${open ? 'open' : ''}`}>
      <button className="deroulant-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="dir-dot dark">
          <Icon name={dir === 1 ? 'up' : 'dn'} size={18} />
        </span>
        <span className="deroulant-title">{dir === 1 ? 'Vers les PK croissants' : 'Vers les PK décroissants'}</span>
        <span className="deroulant-n">{items.length}</span>
        <span className="deroulant-chev">
          <Icon name="down" size={22} />
        </span>
      </button>
      {open &&
        (items.length ? (
          <ul className="items">
            {items.map((it, i) => (
              <ItemRow key={`${dir}-${i}`} it={it} onFocus={onFocus} />
            ))}
          </ul>
        ) : (
          <p className="deroulant-vide">Rien dans les 15 km (selon les filtres).</p>
        ))}
    </div>
  );
}

/**
 * Saisie « Aller au PK » : une case pour les kilomètres, une pour les mètres, comme sur une borne
 * (le clavier chiffres de l'iPhone n'a pas de « + »). « 45,2 » dans la première case marche aussi.
 */
export function PkForm({ onGo }: { onGo: (text: string) => void }) {
  const [km, setKm] = useState('');
  const [m, setM] = useState('');
  const kmClean = km.trim();
  const decimal = /[.,]/.test(kmClean);
  const submit = () => {
    if (!kmClean) return;
    onGo(!decimal && m.trim() ? `${kmClean}+${m.trim().padStart(3, '0')}` : kmClean);
    (document.activeElement as HTMLElement | null)?.blur();
  };
  return (
    <form
      className="pk-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="go-pk">
        <Icon name="pin" size={20} /> Aller à un PK de cette ligne
      </label>
      <input
        id="go-pk"
        className="pk-km"
        value={km}
        onChange={(e) => setKm(e.target.value.replace(/[^\d.,-]/g, ''))}
        inputMode="decimal"
        placeholder="45"
        aria-label="Kilomètres"
        autoComplete="off"
      />
      <span className="pk-plus" aria-hidden="true">
        +
      </span>
      <input
        className="pk-m"
        value={m}
        onChange={(e) => setM(e.target.value.replace(/\D/g, '').slice(0, 3))}
        inputMode="numeric"
        placeholder="200"
        aria-label="Mètres"
        autoComplete="off"
        disabled={decimal}
      />
      <button className="btn primary" type="submit" disabled={!kmClean}>
        Y aller
      </button>
    </form>
  );
}
