/** Calcul rapide : délai d'annonce (DD + MS) et distance d'annonce, plus le tableau complet des distances. */
import { useState } from 'react';
import { DA_MIN_GRANDE_VITESSE, distanceAnnonce } from './rules';
import { Pastilles } from './kit';
import { Bloc, Nombre } from './ui';

const VITESSES: [number, string][] = [40, 60, 80, 100, 120, 140, 160, 200, 220].map((v) => [v, String(v)]);
const DELAIS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const LIGNES_TABLEAU = Array.from({ length: 28 }, (_, i) => 30 + i * 10);

/** Onglet « Calcul » : le résultat en haut, les réglages dessous, puis le tableau. */
export function CalculRapide() {
  const [v, setV] = useState<number | null>(160);
  const [dd, setDd] = useState<number | null>(5);
  const [ms, setMs] = useState<number>(5);
  const base = dd === null ? null : dd + ms;
  const da = base === null ? null : v !== null && v > 160 ? Math.max(base, DA_MIN_GRANDE_VITESSE) : base;
  const dist = da !== null && v ? distanceAnnonce(v, da) : null;
  return (
    <div className="ds-page" role="region" aria-label="Calcul rapide">
      <header className="ds-page-head">
        <div>
          <h1>Calcul rapide</h1>
          <p>Vitesse et délai → distance d’annonce</p>
        </div>
      </header>

      <div className="ds-hero ds-calc" aria-live="polite">
        <div className="ds-calc-main">
          <span className="ds-tag">Distance d’annonce</span>
          <span className="ds-calc-num">
            <b>{dist ?? '—'}</b> m
          </span>
        </div>
        <div className="ds-formula">
          <span>
            Vitesse<b>{v ?? '—'} km/h</b>
          </span>
          <i>·</i>
          <span>
            Délai d’annonce<b>{da ?? '—'} s</b>
          </span>
        </div>
        {base !== null && da !== base && <p className="ds-pa-note">Délai porté à {DA_MIN_GRANDE_VITESSE} s : vitesse de plus de 160 km/h.</p>}
        <p className="ds-hint">
          {v ?? '?'} km/h ÷ 3,6 × {da ?? '?'} s = {v && da ? (Math.round((v / 3.6) * da * 10) / 10).toLocaleString('fr-FR') : '?'} m, arrondi à la
          dizaine supérieure.
        </p>
      </div>

      <h2 className="ds-section-title">Vitesse maximale (km/h)</h2>
      <Pastilles scroll label="Vitesse maximale" value={v} options={VITESSES} onChange={setV} />
      <div className="ds-fields" style={{ marginTop: 10 }}>
        <Nombre label="Autre vitesse" unit="km/h" value={v} max={400} onChange={setV} />
      </div>
      <h2 className="ds-section-title">Délai de dégagement</h2>
      <Pastilles
        label="Délai de dégagement"
        value={dd}
        options={[
          [0, 'Nul'],
          [5, '5 s'],
          [10, '10 s'],
          [15, '15 s'],
          [20, '20 s'],
        ]}
        onChange={setDd}
      />
      <h2 className="ds-section-title">Marge de sécurité</h2>
      <Pastilles
        label="Marge de sécurité"
        value={ms}
        options={[
          [5, '5 s'],
          [10, '10 s'],
          [15, '15 s'],
        ]}
        onChange={setMs}
      />

      <h2 className="ds-section-title">Tableau des distances (m)</h2>
      <Bloc>
        <p className="muted small">Ligne : vitesse maximale. Colonne : délai d’annonce. Fais glisser le tableau.</p>
        <div className="asp-table-wrap">
          <table className="asp-table">
            <thead>
              <tr>
                <th>km/h</th>
                {DELAIS.map((d) => (
                  <th key={d} className={d === da ? 'on' : ''}>
                    {d} s
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIGNES_TABLEAU.map((s) => (
                <tr key={s} className={s === v ? 'on' : ''}>
                  <th>{s}</th>
                  {DELAIS.map((d) => (
                    <td key={d} className={s === v && d === da ? 'hit' : ''}>
                      {distanceAnnonce(s, d)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Au-delà de 160 km/h (et jusqu’à 200 km/h, 220 km/h pour les TGV), le délai d’annonce est d’au moins 10 s et seul l’outillage portatif est
          permis sans interdiction.
        </p>
      </Bloc>
    </div>
  );
}
