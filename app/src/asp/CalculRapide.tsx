/** Calcul rapide : délai d'annonce (DD + MS) et distance d'annonce, plus le tableau complet des distances. */
import { useState } from 'react';
import { DA_MIN_GRANDE_VITESSE, distanceAnnonce } from './rules';
import { Bloc, Nombre, ScreenHead } from './ui';

const VITESSES = [40, 60, 80, 100, 120, 140, 160, 200, 220];
const DELAIS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const LIGNES_TABLEAU = Array.from({ length: 28 }, (_, i) => 30 + i * 10);

export function CalculRapide({ onBack }: { onBack: () => void }) {
  const [v, setV] = useState<number | null>(160);
  const [dd, setDd] = useState<number | null>(5);
  const [ms, setMs] = useState<number>(5);
  const base = dd === null ? null : dd + ms;
  const da = base === null ? null : v !== null && v > 160 ? Math.max(base, DA_MIN_GRANDE_VITESSE) : base;
  const dist = da !== null && v ? distanceAnnonce(v, da) : null;
  return (
    <div className="screen asp-screen" role="dialog" aria-label="Calcul rapide">
      <ScreenHead title="Calcul rapide" sub="Distance d’annonce" onBack={onBack} />
      <div className="screen-body asp-body">
        <Bloc>
          <Nombre label="Vitesse maximale" unit="km/h" value={v} max={400} onChange={setV} />
          <div className="chips">
            {VITESSES.map((x) => (
              <button key={x} className={`chip ${v === x ? 'on' : ''}`} onClick={() => setV(x)}>
                {x}
              </button>
            ))}
          </div>
          <Nombre label="Délai de dégagement" unit="s" value={dd} max={120} onChange={setDd} />
          <div className="chips">
            {[0, 5, 10, 15].map((x) => (
              <button key={x} className={`chip ${dd === x ? 'on' : ''}`} onClick={() => setDd(x)}>
                {x === 0 ? 'Nul' : `${x} s`}
              </button>
            ))}
          </div>
          <div className="asp-mini-label">Marge de sécurité</div>
          <div className="chips">
            {[5, 10, 15].map((x) => (
              <button key={x} className={`chip ${ms === x ? 'on' : ''}`} onClick={() => setMs(x)}>
                {x} s
              </button>
            ))}
          </div>
        </Bloc>
        <Bloc className="asp-resultat">
          <div className="asp-kpis">
            <div>
              <small>Délai d’annonce</small>
              <b>{da ?? '—'}</b>
              <span>s</span>
            </div>
            <span className="asp-kpi-op">→</span>
            <div className="asp-kpi-main">
              <small>Distance d’annonce</small>
              <b>{dist ?? '—'}</b>
              <span>m</span>
            </div>
          </div>
          {base !== null && da !== base && <p className="asp-pa-note">Délai porté à {DA_MIN_GRANDE_VITESSE} s : vitesse de plus de 160 km/h.</p>}
          <p className="muted small">
            {v ?? '?'} km/h ÷ 3,6 = {v ? (v / 3.6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '?'} m/s, × {da ?? '?'} s ={' '}
            {v && da ? (Math.round((v / 3.6) * da * 10) / 10).toLocaleString('fr-FR') : '?'} m, arrondi à la dizaine supérieure.
          </p>
        </Bloc>
        <Bloc title="Tableau des distances d’annonce (m)">
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
    </div>
  );
}
