/**
 * Accueil : « Mon chantier du jour ». Le résultat utile tout de suite (délai, distances, PK d'annonce),
 * un gros bouton pour en créer un, des raccourcis, et les autres chantiers.
 */
import { useMemo, useState } from 'react';
import { loadAccess } from '../access/gate';
import { Icon } from '../components/parts';
import { PREVIEW } from '../lib/env';
import { fmtLine } from '../lib/format';
import { calculChantier, titreChantier, zoneTexte } from './chantier';
import type { Ctx } from './contexte';
import { chantierDuJour, jourTexte, today } from './etat';
import { ListeChantiers } from './Fiche';
import { choisirActivite, useActivite } from './activite';
import { usePositionDirecte } from './direct';
import { AccueilLam } from '../lam/AccueilLam';
import { AccueilPn } from '../pn/AccueilPn';
import { Annonce, Bascule, Etat } from './kit';
import { CaseCalcul, CaseMemo, CaseOu, CaseQuiz, QuestionDuJour } from './Widgets';
import { useActif, useChantiers } from './store';

export function Accueil(p: {
  ctx: Ctx;
  /** Un écran est ouvert par-dessus : le GPS de l'accueil s'arrête. */
  couvert: boolean;
  onNew: () => void;
  onMenu: () => void;
  onWhere: () => void;
  onTab: (t: 'calcul' | 'reviser') => void;
  onNewMission: () => void;
  onNewMissionLam: () => void;
}) {
  const activite = useActivite();
  const list = useChantiers();
  const direct = usePositionDirecte(!p.couvert && !PREVIEW);
  const actif = useActif();
  const c = chantierDuJour(list, actif);
  const r = useMemo(() => (c ? calculChantier(c) : null), [c]);
  const autres = list.filter((x) => x.id !== c?.id);
  const [maintenant] = useState(() => new Date());
  const heure = maintenant.getHours();
  const prenom = (loadAccess()?.nom ?? '').split(/\s+/)[0];
  const date = maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main className="ds-page" aria-label="Accueil">
      <header className="ds-page-head">
        <div>
          <h1>
            {heure >= 18 || heure < 5 ? 'Bonsoir' : 'Bonjour'}
            {prenom ? ` ${prenom}` : ''}
          </h1>
          <p>{date.charAt(0).toUpperCase() + date.slice(1)}</p>
        </div>
        <button className="ds-iconbtn" onClick={p.onMenu} aria-label="Réglages : affichage, installer, à propos">
          <Icon name="dots" size={22} />
        </button>
      </header>
      <Bascule
        label="Activité"
        value={activite}
        options={[
          ['asp', 'Annonce', 'vest'],
          ['pn', 'Agent PN', 'tracks'],
          ['lam', 'LAM / S9', 'train'],
        ]}
        onChange={choisirActivite}
      />
      <div className="ds-activite-gap" />

      {activite === 'pn' ? (
        <AccueilPn ctx={p.ctx} direct={direct} onNew={p.onNewMission} onWhere={p.onWhere} />
      ) : activite === 'lam' ? (
        <AccueilLam ctx={p.ctx} direct={direct} onNew={p.onNewMissionLam} onWhere={p.onWhere} />
      ) : (
        <>
        {c && r ? (
          <section className="ds-hero" aria-label="Mon chantier">
            <div className="ds-hero-top">
              <span className="ds-tag">
                {c.date === today() ? 'Chantier du jour' : jourTexte(c.date)} · {c.horaire === 'nuit' ? 'nuit' : 'jour'}
              </span>
              <Etat c={c} r={r} onClick={() => p.ctx.open({ k: 'fiche', id: c.id })} />
            </div>
            <h2>{titreChantier(c)}</h2>
            <div className="ds-hero-sub">{c.ligne ? `Ligne ${fmtLine(c.ligne)} · ${zoneTexte(c)}` : zoneTexte(c)}</div>
            <Annonce r={r} onGo={c.ligne ? (pk) => p.ctx.onGoPk(c.ligne!, pk) : undefined} manquePk={c.pkDebut === null} />
            <div className="ds-hero-actions">
              <button className="ds-btn primary" onClick={() => p.ctx.open({ k: 'fiche', id: c.id })}>
                Ouvrir la fiche
              </button>
              <button className="ds-btn" onClick={() => p.ctx.onShowMap(c)} disabled={!c.ligne || c.pkDebut === null} aria-label="Voir sur la carte">
                <Icon name="map" size={20} />
                Carte
              </button>
            </div>
          </section>
        ) : (
          <section className="ds-card ds-empty" aria-label="Premier chantier">
            <div className="ds-empty-art">
              <Icon name="vest" size={48} />
            </div>
            <h2>Prépare ton chantier</h2>
            <p>Réponds à quelques questions : l’appli calcule le délai, la distance d’annonce et les PK où placer tes annonceurs.</p>
            <button className="ds-btn primary big wide" onClick={p.onNew}>
              <Icon name="plus" size={22} />
              Nouveau chantier
            </button>
          </section>
        )}
        {c && (
          <button className="ds-btn dark big wide ds-new" onClick={p.onNew}>
            <Icon name="plus" size={22} />
            Nouveau chantier
          </button>
        )}

        <h2 className="ds-section-title">En direct</h2>
        <div className="ds-grid">
          <CaseOu etat={direct.etat} pos={direct.pos} onClick={p.onWhere} />
          <CaseCalcul pos={direct.etat === 'ok' ? direct.pos : null} onClick={() => p.onTab('calcul')} />
          <CaseMemo onClick={() => p.ctx.open({ k: 'memo' })} />
          <CaseQuiz onClick={() => p.ctx.open({ k: 'quiz' })} />
        </div>
        <QuestionDuJour onQuiz={() => p.ctx.open({ k: 'quiz' })} />

        {autres.length > 0 && (
          <>
            <h2 className="ds-section-title">
              <span>Mes chantiers</span>
              {autres.length > 3 && (
                <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'chantiers' })}>
                  Voir tout ({list.length})
                </button>
              )}
            </h2>
            <ListeChantiers list={autres.slice(0, 3)} ctx={p.ctx} />
          </>
        )}
        <p className="ds-foot">
          Aide à la préparation, jamais une référence de sécurité : le carnet CADA, l’AAn et les consignes locales priment. Les chantiers restent sur ce
          téléphone.
        </p>
        </>
      )}
    </main>
  );
}
