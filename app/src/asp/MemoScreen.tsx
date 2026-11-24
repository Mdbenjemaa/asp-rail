/** Mémo de l'ASP : chapitres du support TES M, avec recherche. */
import { useMemo, useState } from 'react';
import { Icon } from '../components/parts';
import { signalImage, SIGNAL_ICONS } from '../lib/signaux';
import { MEMO, type MemoBloc, type MemoSection } from './memo';
import { useRetour } from '../lib/back';
import { ScreenHead } from './ui';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function texteDe(b: MemoBloc): string {
  switch (b.t) {
    case 'p':
    case 'warn':
      return b.text;
    case 'list':
      return b.items.join(' ');
    case 'kv':
      return b.rows.flat().join(' ');
    case 'table':
      return [...b.head, ...b.rows.flat()].join(' ');
    case 'sig':
      return b.items.map((i) => `${i.nom} ${i.texte}`).join(' ');
    default:
      return '';
  }
}

/** Exemple de chaîne d'annonce : sentinelle, annonceur, répétiteur, annonceur, ASP. */
function SchemaChaine() {
  return (
    <figure className="asp-schema">
      <svg viewBox="0 0 360 150" role="img" aria-label="Chaîne d’annonce : la sentinelle voit le point d’annonce de V1, l’annonceur A1 la voit, le répétiteur R1 répète, l’annonceur A2 voit le point d’annonce de V2.">
        <line x1="20" y1="88" x2="340" y2="88" stroke="#64748b" strokeWidth="3" />
        <line x1="20" y1="118" x2="340" y2="118" stroke="#64748b" strokeWidth="3" />
        <text x="6" y="92" fontSize="11" fontWeight="700" fill="currentColor">
          V1
        </text>
        <text x="6" y="122" fontSize="11" fontWeight="700" fill="currentColor">
          V2
        </text>
        <rect x="150" y="80" width="80" height="16" rx="4" fill="#f5b400" />
        <text x="190" y="92" fontSize="10" textAnchor="middle" fontWeight="700" fill="#3b2a00">
          chantier
        </text>
        <line x1="34" y1="74" x2="34" y2="104" stroke="#db2777" strokeWidth="2" strokeDasharray="4 3" />
        <text x="34" y="140" fontSize="10" textAnchor="middle" fill="#db2777" fontWeight="700">
          PA V1
        </text>
        <line x1="330" y1="104" x2="330" y2="132" stroke="#db2777" strokeWidth="2" strokeDasharray="4 3" />
        <text x="330" y="145" fontSize="10" textAnchor="middle" fill="#db2777" fontWeight="700">
          PA V2
        </text>
        {[
          [88, 'S1', '#7c3aed'],
          [150, 'A1', '#0f766e'],
          [190, 'R1', '#0f766e'],
          [230, 'A2', '#0f766e'],
        ].map(([x, l, c]) => (
          <g key={l as string}>
            <circle cx={x as number} cy="46" r="11" fill={c as string} />
            <text x={x as number} y="50" fontSize="10" textAnchor="middle" fill="#fff" fontWeight="800">
              {l}
            </text>
          </g>
        ))}
        <circle cx="190" cy="16" r="10" fill="#13305c" />
        <text x="190" y="20" fontSize="8" textAnchor="middle" fill="#fff" fontWeight="800">
          ASP
        </text>
        <path d="M100 46h38M162 46h16M202 46h16" stroke="#0f766e" strokeWidth="2" markerEnd="url(#fl)" markerStart="url(#fl)" />
        <defs>
          <marker id="fl" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#0f766e" strokeWidth="2" />
          </marker>
        </defs>
        <path d="M80 70 L40 82" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M240 58 L322 110" stroke="#0f766e" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
      <figcaption>
        S1 voit arriver les trains de V1 au point d’annonce (courbe : l’annonceur A1 ne le voit pas) et alerte A1 ; R1 répète au milieu d’un
        chantier long et bruyant ; A2 voit lui-même le point d’annonce de V2. Chacun voit et entend le suivant, l’ASP les voit tous.
      </figcaption>
    </figure>
  );
}

function Bloc({ b }: { b: MemoBloc }) {
  switch (b.t) {
    case 'p':
      return <p className="asp-memo-p">{b.text}</p>;
    case 'warn':
      return <div className="warn-box asp-memo-warn">{b.text}</div>;
    case 'list':
      return (
        <ul className="asp-list">
          {b.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      );
    case 'kv':
      return (
        <dl className="facts-list asp-kv">
          {b.rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      );
    case 'table':
      return (
        <div className="asp-table-wrap">
          <table className="asp-table asp-table-text">
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (j === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'sig':
      return (
        <ul className="asp-sigs">
          {b.items.map((s) => (
            <li key={s.ic}>
              {SIGNAL_ICONS && (
                <span className="asp-sig-img">
                  <img src={signalImage(s.ic)} alt="" loading="lazy" />
                </span>
              )}
              <span>
                <b>{s.nom}</b>
                <small>{s.texte}</small>
              </span>
            </li>
          ))}
        </ul>
      );
    case 'chaine':
      return <SchemaChaine />;
  }
}

function Section({ s, onBack }: { s: MemoSection; onBack: () => void }) {
  return (
    <div className="screen asp-screen" role="dialog" aria-label={s.titre}>
      <ScreenHead title={s.titre} sub="Mémo ASP" onBack={onBack} backLabel="Retour au mémo" />
      <div className="screen-body asp-body asp-memo">
        {s.blocs.map((b, i) => (
          <Bloc key={i} b={b} />
        ))}
        <p className="muted small">D’après le support « TES M – compétence ASP ». Les textes SNCF Réseau et les consignes locales priment.</p>
      </div>
    </div>
  );
}

export function MemoScreen({ onBack, section }: { onBack: () => void; section?: string }) {
  const [open, setOpen] = useState<string | null>(section ?? null);
  const [q, setQ] = useState('');
  const index = useMemo(() => MEMO.map((s) => ({ s, text: norm(`${s.titre} ${s.resume} ${s.blocs.map(texteDe).join(' ')}`) })), []);
  const found = q.trim() ? index.filter((x) => norm(q).split(/\s+/).every((w) => x.text.includes(w))).map((x) => x.s) : MEMO;
  const cur = MEMO.find((s) => s.id === open);
  useRetour(!cur, onBack);
  if (cur) return <Section s={cur} onBack={() => setOpen(null)} />;
  return (
    <div className="screen asp-screen" role="dialog" aria-label="Mémo ASP">
      <header className="ds-topbar">
        <button className="ds-iconbtn" onClick={onBack} aria-label="Retour">
          <Icon name="back" size={24} />
        </button>
        <h1>Mémo ASP</h1>
      </header>
      <div className="ds-search">
        <Icon name="search" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : bruit, DMVC, PN…" aria-label="Chercher dans le mémo" type="search" />
      </div>
      <div className="screen-body asp-body">
        <div className="ds-list">
          {found.map((s) => (
            <button key={s.id} className="ds-row" onClick={() => setOpen(s.id)}>
              <span className="ds-row-ico">
                <Icon name="book" size={20} />
              </span>
              <span className="ds-row-txt">
                <b>{s.titre}</b>
                <small>{s.resume}</small>
              </span>
              <span className="ds-row-end">
                <Icon name="right" size={20} />
              </span>
            </button>
          ))}
        </div>
        {!found.length && <p className="muted">Rien trouvé pour « {q} ».</p>}
        <p className="muted small">
          Reformulé d’après le support de formation « TES M – compétence ASP » (version du 30/05/2023). Les textes SNCF Réseau en vigueur et les
          consignes locales priment toujours.
        </p>
      </div>
    </div>
  );
}
