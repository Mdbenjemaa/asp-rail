/**
 * Accueil. À chaque ouverture, l'accueil général : bonjour, mon planning ETF, puis le choix de la mission du
 * jour (annonce, agent PN, AP LAM / S9), chacune avec ce qui est en cours. Une fois la mission choisie, son
 * accueil : pour l'annonce, « Mon chantier du jour » (délai, distances, PK d'annonce), un gros bouton pour en
 * créer un, des raccourcis, et les autres chantiers.
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
import { fermerMission, ouvrirMission, useActivite, useMissionOuverte, type Activite } from './activite';
import { missionLamDuJour, useMissionsLam } from '../lam/mission';
import { missionDuJour, useMissions } from '../pn/mission';
import { donneesChantier, donneesLam, donneesPn } from '../partage/donnees';
import { usePositionDirecte } from './direct';
import { AccueilLam } from '../lam/AccueilLam';
import { AccueilPn } from '../pn/AccueilPn';
import { CartePlanning, type ActivitePlanning } from '../planning/Planning';
import { Annonce, Bascule, Etat } from './kit';
import { CaseCalcul, CaseMemo, CaseOu, CaseQuiz, QuestionDuJour } from './Widgets';
import { enregistrer, useActif, useChantiers } from './store';
import { InterventionRapide } from './Deroule';
import { PanneauPartage } from '../partage/Panneau';
import { AccueilChaine } from '../chaine/AccueilChaine';
import { choisirCote, useCote } from '../chaine/cote';
import { useMaillonsLies } from '../chaine/lien';
import { etatPoste, posteDuJour, titrePoste, usePostes } from '../chaine/poste';
import { useSession } from '../partage/session';

interface AccueilProps {
  ctx: Ctx;
  /** Un écran est ouvert par-dessus : le GPS de l'accueil s'arrête. */
  couvert: boolean;
  onNew: () => void;
  onMenu: () => void;
  onWhere: () => void;
  onTab: (t: 'calcul' | 'reviser') => void;
  onNewMission: () => void;
  onNewMissionLam: () => void;
}

/** Les trois missions, telles qu'on les choisit sur l'accueil général. */
const MISSIONS: { a: Activite; titre: string; sous: string; icon: 'vest' | 'tracks' | 'train' }[] = [
  { a: 'asp', titre: 'Annonce', sous: 'ASP · TES M', icon: 'vest' },
  { a: 'pn', titre: 'Agent PN', sous: 'Passage à niveau · TES F', icon: 'tracks' },
  { a: 'lam', titre: 'AP LAM / S9', sous: 'LAM · protection S9', icon: 'train' },
];
const NOM_MISSION: Record<Activite, string> = { asp: 'Annonce', pn: 'Agent PN', lam: 'AP LAM / S9' };

function Bonjour(p: { titre?: string; sous?: string; onMenu: () => void; onRetour?: () => void }) {
  const [maintenant] = useState(() => new Date());
  const heure = maintenant.getHours();
  const prenom = (loadAccess()?.nom ?? '').split(/\s+/)[0];
  const date = maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const jour = date.charAt(0).toUpperCase() + date.slice(1);
  return (
    <header className="ds-page-head">
      {p.onRetour && (
        <button className="ds-iconbtn ac-retour" onClick={p.onRetour} aria-label="Revenir à l’accueil (changer de mission)">
          <Icon name="back" size={22} />
        </button>
      )}
      <div>
        <h1>{p.titre ?? `${heure >= 18 || heure < 5 ? 'Bonsoir' : 'Bonjour'}${prenom ? ` ${prenom}` : ''}`}</h1>
        <p>{p.sous ? `${p.sous} · ${jour.toLowerCase()}` : jour}</p>
      </div>
      <button className="ds-iconbtn" onClick={p.onMenu} aria-label="Réglages : affichage, installer, à propos">
        <Icon name="dots" size={22} />
      </button>
    </header>
  );
}

export function Accueil(p: AccueilProps) {
  return useMissionOuverte() ? <AccueilMission {...p} /> : <AccueilGeneral {...p} />;
}

/** Ce qui est en cours pour chaque mission, en une ligne : le chantier ou la mission du jour et son état. */
function useEnCours(): Record<Activite, { titre: string; etat: string; niveau: string } | null> {
  const list = useChantiers();
  const actif = useActif();
  const missions = useMissions();
  const lams = useMissionsLam();
  const postes = usePostes();
  const cote = useCote();
  return useMemo(() => {
    const poste = cote === 'chaine' ? posteDuJour(postes) : null;
    const c = chantierDuJour(list, actif);
    const m = missionDuJour(missions);
    const l = missionLamDuJour(lams);
    const d = c ? donneesChantier(c, calculChantier(c), null) : null;
    const dp = m ? donneesPn(m, null) : null;
    const dl = l ? donneesLam(l, null) : null;
    return {
      asp: poste
        ? { titre: `Mon poste · ${titrePoste(poste)}`, etat: etatPoste(poste).texte, niveau: etatPoste(poste).niveau }
        : d && c
          ? { titre: `${c.date === today() ? 'Aujourd’hui' : jourTexte(c.date)} · ${d.titre}`, etat: d.etat, niveau: d.niveau }
          : null,
      pn: dp ? { titre: dp.titre, etat: dp.etat, niveau: dp.niveau } : null,
      lam: dl ? { titre: dl.titre, etat: dl.etat, niveau: dl.niveau } : null,
    };
  }, [list, actif, missions, lams, postes, cote]);
}

/** Accueil général : bonjour, mon planning, et le choix de la mission. */
function AccueilGeneral(p: AccueilProps) {
  const derniere = useActivite();
  const enCours = useEnCours();
  // « Préparer » depuis le planning : la bonne mission, puis la création préremplie.
  const preparer = (a: ActivitePlanning) => {
    ouvrirMission(a);
    if (a === 'asp') p.onNew();
    else if (a === 'pn') p.onNewMission();
    else p.onNewMissionLam();
  };
  return (
    <main className="ds-page" aria-label="Accueil">
      <Bonjour onMenu={p.onMenu} />
      <CartePlanning ctx={p.ctx} activite={derniere} onPreparer={preparer} />
      <h2 className="ds-section-title">Choisis ta mission</h2>
      <div className="ac-missions">
        {MISSIONS.map((m) => {
          const e = enCours[m.a];
          return (
            <button key={m.a} className={`ac-mission ${m.a} ${e?.niveau ?? ''}`} onClick={() => ouvrirMission(m.a)} aria-label={`${m.titre} : ${m.sous}`}>
              <span className="ac-ico">
                <Icon name={m.icon} size={30} />
              </span>
              <span className="ac-texte">
                <b>
                  {m.titre}
                  {m.a === derniere && <span className="ac-derniere">Dernière</span>}
                </b>
                <small>{m.sous}</small>
                {e ? (
                  <span className="ac-encours">
                    <span>{e.titre}</span>
                    <em>{e.etat}</em>
                  </span>
                ) : (
                  <span className="ac-encours vide">Rien de prévu aujourd’hui</span>
                )}
              </span>
              <Icon name="right" size={22} />
            </button>
          );
        })}
      </div>
      <p className="ds-foot">Aide à la préparation, jamais une référence de sécurité : le carnet CADA, l’AAn, les dépêches et les consignes locales priment.</p>
    </main>
  );
}

/** Accueil de la mission choisie. */
function AccueilMission(p: AccueilProps) {
  const activite = useActivite();
  const sessionPartage = useSession();
  const list = useChantiers();
  const direct = usePositionDirecte(!p.couvert && !PREVIEW);
  const actif = useActif();
  const c = chantierDuJour(list, actif);
  const r = useMemo(() => (c ? calculChantier(c) : null), [c]);
  const autres = list.filter((x) => x.id !== c?.id);
  const cote = useCote();
  const chaine = activite === 'asp' && cote === 'chaine';
  const lies = useMaillonsLies();
  return (
    <main className="ds-page" aria-label={`Accueil : ${NOM_MISSION[activite]}`}>
      <Bonjour titre={NOM_MISSION[activite]} sous={MISSIONS.find((m) => m.a === activite)!.sous} onMenu={p.onMenu} onRetour={fermerMission} />
      {activite === 'asp' && (
        <div className="ch-cote">
          <Bascule
            label="Dans l’annonce, je suis"
            value={cote}
            options={[
              ['asp', 'ASP', 'vest'],
              ['chaine', 'Dans la chaîne', 'flag'],
            ]}
            onChange={choisirCote}
          />
          <small>{chaine ? 'Annonceur, répétiteur ou sentinelle : mon poste' : 'Je prépare le chantier et le dispositif'}</small>
        </div>
      )}
      {sessionPartage && (
        <section className="ds-card pt-carte" aria-label="Chantier partagé">
          <PanneauPartage ctx={p.ctx} activite={chaine ? 'chaine' : activite} onVoir={p.ctx.onVoirPoint} />
        </section>
      )}

      {chaine ? (
        <AccueilChaine ctx={p.ctx} direct={direct} onWhere={p.onWhere} />
      ) : activite === 'pn' ? (
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
            {(c.date === today() || Object.keys(c.deroule.jalons).length > 0) && (
              <InterventionRapide
                c={c}
                r={r}
                changer={(deroule, fin) => {
                  enregistrer({ ...c, deroule });
                  if (fin) p.ctx.open({ k: 'fiche', id: c.id, ouvrir: 'fin' });
                }}
                onCompteRendu={() => p.ctx.open({ k: 'fiche', id: c.id, ouvrir: 'compte-rendu' })}
              />
            )}
            {lies.size > 0 && (
              <p className="ch-lies">
                <Icon name="people" size={18} />
                {[...lies.entries()].map(([code, x]) => `${code} ${x.nom || ''} : ${x.donnees.etat.toLowerCase()}`).join(' · ')}
              </p>
            )}
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
