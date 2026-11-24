/** Petits éléments communs aux écrans de l'ASP : saisies (PK, nombres), interrupteurs, choix, alertes. */
import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../components/parts';
import { fmtPk } from '../lib/format';
import type { Alerte } from './rules';

/** En-tête d'un écran plein : retour, titre, sous-titre, action à droite. */
export function ScreenHead(p: { title: string; sub?: string; onBack: () => void; backLabel?: string; right?: ReactNode }) {
  return (
    <header className="screen-head">
      <button className="round-btn" onClick={p.onBack} aria-label={p.backLabel ?? 'Retour'}>
        <Icon name="back" size={22} />
      </button>
      <div className="screen-title">
        <b>{p.title}</b>
        {p.sub && <small>{p.sub}</small>}
      </div>
      {p.right && <div className="asp-head-right">{p.right}</div>}
    </header>
  );
}

/** Choix exclusif en pastilles (2 à 4 valeurs). */
export function Choix<T extends string>(p: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string; small?: boolean }) {
  return (
    <div className={`asp-choix ${p.small ? 'small' : ''}`} role="radiogroup" aria-label={p.label}>
      {p.options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={p.value === v} className={`asp-choix-btn ${p.value === v ? 'on' : ''}`} onClick={() => p.onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Interrupteur avec son texte (et une précision en petit). */
export function Interrupteur(p: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id?: string }) {
  const auto = useId();
  const id = p.id ?? auto;
  return (
    <label className="toggle asp-toggle" htmlFor={id}>
      <span>
        {p.label}
        {p.hint && <small>{p.hint}</small>}
      </span>
      <span className="switch">
        <input id={id} type="checkbox" checked={p.checked} onChange={(e) => p.onChange(e.target.checked)} />
        <span className="switch-ui" />
      </span>
    </label>
  );
}

/** Champ texte avec son intitulé. */
export function Champ(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div className="asp-field">
      <label htmlFor={id}>{p.label}</label>
      <input
        id={id}
        className="asp-input"
        type={p.type ?? 'text'}
        value={p.value}
        placeholder={p.placeholder}
        inputMode={p.inputMode}
        autoComplete={p.autoComplete ?? 'off'}
        onChange={(e) => p.onChange(e.target.value)}
      />
    </div>
  );
}

/** Nombre entier (secondes, km/h, mètres, effectif) ; vide = null. */
export function Nombre(p: { label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; placeholder?: string; max?: number; id?: string }) {
  const auto = useId();
  const id = p.id ?? auto;
  const [text, setText] = useState(p.value === null ? '' : String(p.value));
  // Valeur changée ailleurs (bouton « utiliser ») : on suit, pendant le rendu (pas d'effet en cascade).
  const [prev, setPrev] = useState(p.value);
  if (p.value !== prev) {
    setPrev(p.value);
    if (!(text !== '' && Number(text) === p.value)) setText(p.value === null ? '' : String(p.value));
  }
  return (
    <div className="asp-field asp-num">
      <label htmlFor={id}>{p.label}</label>
      <div className="asp-num-row">
        <input
          id={id}
          className="asp-input"
          value={text}
          placeholder={p.placeholder}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => {
            const t = e.target.value.replace(/\D/g, '').slice(0, 5);
            setText(t);
            const n = t === '' ? null : Number(t);
            p.onChange(n !== null && p.max !== undefined ? Math.min(n, p.max) : n);
          }}
        />
        {p.unit && <span className="asp-unit">{p.unit}</span>}
      </div>
    </div>
  );
}

/** Saisie d'un PK en deux cases (km + m), comme sur une borne ; valeur en km, ou null. */
export function PkInput(p: { label: string; value: number | null; onChange: (v: number | null) => void; id?: string }) {
  const auto = useId();
  const id = p.id ?? auto;
  const split = (v: number | null): [string, string] => {
    if (v === null || !Number.isFinite(v)) return ['', ''];
    const [km, m] = fmtPk(v).split('+');
    return [km, m];
  };
  const [km, setKm] = useState(() => split(p.value)[0]);
  const [m, setM] = useState(() => split(p.value)[1]);
  // Valeur changée ailleurs (« Ma position », « Au point d'annonce ») : on suit, sauf si c'est la saisie en cours.
  const [prev, setPrev] = useState(p.value);
  if (p.value !== prev) {
    setPrev(p.value);
    const cur = km === '' || km === '-' ? null : Number(km) + (km.startsWith('-') ? -1 : 1) * (Number(m || '0') / 1000);
    const same = (cur === null && p.value === null) || (cur !== null && p.value !== null && Math.abs(cur - p.value) < 0.0005);
    if (!same) {
      const [a, b] = split(p.value);
      setKm(a);
      setM(b);
    }
  }
  const emit = (k: string, mm: string) => {
    if (k === '' || k === '-') return p.onChange(null);
    const n = Number(k);
    if (!Number.isFinite(n)) return;
    const meters = Number(mm || '0') / 1000;
    p.onChange(Math.round((k.startsWith('-') ? n - meters : n + meters) * 1000) / 1000);
  };
  return (
    <div className="asp-field">
      <label htmlFor={id}>{p.label}</label>
      <div className="asp-pk">
        <input
          id={id}
          className="asp-input asp-pk-km"
          value={km}
          inputMode="numeric"
          placeholder="km"
          aria-label={`${p.label} : kilomètres`}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d-]/g, '').slice(0, 5);
            setKm(v);
            emit(v, m);
          }}
        />
        <span className="pk-plus" aria-hidden="true">
          +
        </span>
        <input
          className="asp-input asp-pk-m"
          value={m}
          inputMode="numeric"
          placeholder="m"
          aria-label={`${p.label} : mètres`}
          autoComplete="off"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 3);
            setM(v);
            emit(km, v.padStart(3, '0'));
          }}
          onBlur={() => {
            if (m !== '' && m.length < 3) {
              const v = m.padStart(3, '0');
              setM(v);
              emit(km, v);
            }
          }}
        />
      </div>
    </div>
  );
}

const NIVEAU_TITRE = { stop: 'À régler', attention: 'À vérifier', info: 'Rappel' } as const;

/** Liste d'alertes : à régler (rouge), à vérifier (orange), rappels (gris). */
export function Alertes({ list }: { list: Alerte[] }) {
  if (!list.length) return null;
  const ordre = { stop: 0, attention: 1, info: 2 };
  const tri = [...list].sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
  return (
    <ul className="asp-alertes">
      {tri.map((a, i) => (
        <li key={i} className={`asp-alerte ${a.niveau}`}>
          <b>{NIVEAU_TITRE[a.niveau]}</b>
          <span>{a.texte}</span>
        </li>
      ))}
    </ul>
  );
}

/** Carte (bloc blanc arrondi) avec un titre. */
export function Bloc(p: { title?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`asp-bloc ${p.className ?? ''}`} id={p.id}>
      {p.title && <h3 className="asp-bloc-title">{p.title}</h3>}
      {p.children}
    </section>
  );
}
