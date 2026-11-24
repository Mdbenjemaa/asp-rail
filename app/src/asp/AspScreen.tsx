/**
 * Espace de l'ASP : mes chantiers, calcul rapide, mémo et entraînement. Chargé à la demande (bouton « ASP »).
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import type { Manifest } from '../lib/data';
import { fmtLine } from '../lib/format';
import { CalculRapide } from './CalculRapide';
import { calculChantier, nouveauChantier, titreChantier, zoneTexte, type Chantier } from './chantier';
import { ChantierScreen } from './ChantierScreen';
import { CasScreen } from './CasScreen';
import { MemoScreen } from './MemoScreen';
import { QuizScreen } from './QuizScreen';
import { proposerVitesses } from './lignes';
import { definirActif, enregistrer, useActif, useChantiers } from './store';
import { ScreenHead } from './ui';

/** Où est l'agent (dernier repérage) : pour remplir la ligne et le PK d'un chantier. */
export interface Here {
  code: string;
  pk: number;
  ligneNom: string | null;
}

export type AspView = { k: 'hub' } | { k: 'chantier'; id: string } | { k: 'calcul' } | { k: 'memo'; section?: string } | { k: 'quiz' } | { k: 'cas' };

interface Props {
  manifest: Manifest | null;
  here: Here | null;
  locating: boolean;
  onLocate: () => void;
  onShowChantier: (c: Chantier) => void;
  onGoPk: (code: string, pk: number) => void;
  onClose: () => void;
  initial?: AspView;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export default function AspScreen(p: Props) {
  const [view, setView] = useState<AspView>(p.initial ?? { k: 'hub' });
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? null : cur)), Math.min(12000, Math.max(5000, t.length * 60)));
  };
  const toastEl = toast && (
    <div className="toast asp-toast" role="status" onClick={() => setToast(null)}>
      {toast}
    </div>
  );
  const hub = () => setView({ k: 'hub' });

  if (view.k === 'chantier') {
    return (
      <>
        <ChantierScreen
          id={view.id}
          manifest={p.manifest}
          here={p.here}
          locating={p.locating}
          onLocate={p.onLocate}
          onShowMap={p.onShowChantier}
          onGoPk={p.onGoPk}
          onBack={hub}
          onToast={showToast}
        />
        {toastEl}
      </>
    );
  }
  if (view.k === 'calcul') return <CalculRapide onBack={hub} />;
  if (view.k === 'memo') return <MemoScreen onBack={hub} section={view.section} />;
  if (view.k === 'quiz') return <QuizScreen onBack={hub} />;
  if (view.k === 'cas')
    return (
      <>
        <CasScreen
          onBack={hub}
          onEssayer={(c) => {
            enregistrer(c);
            setView({ k: 'chantier', id: c.id });
            showToast('Cas pratique ouvert comme chantier : modifie-le librement.');
          }}
        />
        {toastEl}
      </>
    );
  return (
    <>
      <Hub {...p} onOpen={setView} />
      {toastEl}
    </>
  );
}

function Hub(p: Props & { onOpen: (v: AspView) => void }) {
  const list = useChantiers();
  const actif = useActif();
  const nouveau = () => {
    const here = p.here;
    const c = nouveauChantier(
      here
        ? { ligne: here.code, ligneNom: here.ligneNom, pkDebut: Math.round(here.pk * 1000) / 1000, pkFin: Math.round((here.pk + 0.05) * 1000) / 1000 }
        : {},
    );
    enregistrer(c);
    if (here) void proposerVitesses(c.id);
    p.onOpen({ k: 'chantier', id: c.id });
  };
  return (
    <div className="screen asp-screen" role="dialog" aria-label="Espace ASP">
      <ScreenHead title="Espace ASP" sub="Chantiers, calculs, mémo" onBack={p.onClose} backLabel="Revenir à la carte" />
      <div className="screen-body asp-body">
        <section className="asp-section">
          <div className="results-head">
            <span>Mes chantiers</span>
            <span>{list.length}</span>
          </div>
          <button className="btn primary wide asp-new" onClick={nouveau}>
            + Nouveau chantier
          </button>
          {p.here && <p className="muted small">Il partira de ta position : ligne {fmtLine(p.here.code)}.</p>}
          {list.length > 0 && (
            <ul className="results-list asp-chantiers">
              {list.map((c) => {
                const r = calculChantier(c);
                const stop = r.dd.erreurs.length + r.alertes.filter((a) => a.niveau === 'stop').length;
                return (
                  <li key={c.id}>
                    <button className="result" onClick={() => p.onOpen({ k: 'chantier', id: c.id })}>
                      <span className={`result-ico asp-ico ${stop ? 'stop' : ''}`}>
                        <Icon name="train" size={22} />
                      </span>
                      <span className="result-main">
                        <b>{titreChantier(c)}</b>
                        <small>
                          {c.ligne ? `Ligne ${fmtLine(c.ligne)} · ` : ''}
                          {zoneTexte(c)} · {fmtDate(c.date)}
                        </small>
                        <small>
                          {r.da !== null ? `Délai d’annonce ${r.da} s` : 'Délai à calculer'}
                          {stop ? ` · ${stop} à régler` : ''}
                          {actif?.id === c.id ? ' · sur la carte' : ''}
                        </small>
                      </span>
                      <Icon name="right" size={20} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {actif && (
            <button className="btn wide" onClick={() => definirActif(null)}>
              Retirer « {titreChantier(actif)} » de la carte
            </button>
          )}
        </section>

        <section className="asp-section">
          <div className="results-head">
            <span>Outils</span>
          </div>
          <div className="asp-tiles">
            <button className="asp-tile" onClick={() => p.onOpen({ k: 'calcul' })}>
              <b>Calcul rapide</b>
              <small>Distance d’annonce selon la vitesse et le délai, et le tableau complet</small>
            </button>
            <button className="asp-tile" onClick={() => p.onOpen({ k: 'memo' })}>
              <b>Mémo ASP</b>
              <small>Règles du support TES M : outillage, marges, AAn, DMVC, signaux…</small>
            </button>
            <button className="asp-tile" onClick={() => p.onOpen({ k: 'quiz' })}>
              <b>Quiz</b>
              <small>Questions de révision avec explications</small>
            </button>
            <button className="asp-tile" onClick={() => p.onOpen({ k: 'cas' })}>
              <b>Cas pratiques</b>
              <small>Les 7 exercices du support, à calculer puis corrigés</small>
            </button>
          </div>
        </section>

        <div className="warn-box small">
          <b>Aide à la préparation.</b> Le calcul suit les règles du support de formation TES M – compétence ASP. Il ne remplace ni les textes
          SNCF Réseau en vigueur, ni les consignes et particularités locales, ni le carnet CADA et l’AAn. PK et vitesses viennent de données
          ouvertes : vérifie-les sur le terrain. L’ASP reste responsable de son dispositif.
        </div>
      </div>
    </div>
  );
}
