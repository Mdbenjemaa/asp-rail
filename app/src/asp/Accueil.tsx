/**
 * Accueil : « Mon chantier du jour ». Le résultat utile tout de suite (délai, distances, PK d'annonce),
 * un gros bouton pour en créer un, des raccourcis, et les autres chantiers.
 */
import { useMemo, useState } from 'react';
import { loadAccess } from '../access/gate';
import { Icon } from '../components/parts';
import { fmtLine } from '../lib/format';
import { calculChantier, titreChantier, zoneTexte } from './chantier';
import type { Ctx } from './contexte';
import { chantierDuJour, jourTexte, today } from './etat';
import { ListeChantiers } from './Fiche';
import { Annonce, Etat } from './kit';
import { useActif, useChantiers } from './store';

export function Accueil(p: { ctx: Ctx; onNew: () => void; onMenu: () => void; onWhere: () => void; onTab: (t: 'calcul' | 'reviser') => void }) {
  const list = useChantiers();
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

      <h2 className="ds-section-title">Raccourcis</h2>
      <div className="ds-grid">
        <button className="ds-quick" onClick={p.onWhere}>
          <span className="ds-quick-ico">
            <Icon name="locate" />
          </span>
          <span>
            <b>Où suis-je ?</b>
            <small>Ligne et PK au mètre</small>
          </span>
        </button>
        <button className="ds-quick" onClick={() => p.onTab('calcul')}>
          <span className="ds-quick-ico">
            <Icon name="calc" />
          </span>
          <span>
            <b>Calcul rapide</b>
            <small>Vitesse et délai → distance</small>
          </span>
        </button>
        <button className="ds-quick" onClick={() => p.ctx.open({ k: 'memo' })}>
          <span className="ds-quick-ico">
            <Icon name="book" />
          </span>
          <span>
            <b>Mémo ASP</b>
            <small>Les règles, en clair</small>
          </span>
        </button>
        <button className="ds-quick" onClick={() => p.ctx.open({ k: 'quiz' })}>
          <span className="ds-quick-ico">
            <Icon name="sparkle" />
          </span>
          <span>
            <b>Quiz</b>
            <small>10 questions pour réviser</small>
          </span>
        </button>
      </div>

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
    </main>
  );
}
