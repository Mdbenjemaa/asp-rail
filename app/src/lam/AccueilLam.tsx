/** Accueil en activité « LAM / S9 » : ma mission du jour, contrôle de pose d'un DSh en direct, urgences, révisions. */
import { Icon } from '../components/parts';
import { useModules } from '../access/entreprise';
import type { Ctx } from '../asp/contexte';
import type { Direct, EtatDirect } from '../asp/direct';
import { CaseDsh, CaseMemo, CaseOu, CaseQuiz, QuestionDuJour } from '../asp/Widgets';
import { REGLES_LAM } from './memo';
import { avancementLam, heure, missionLamDuJour, OUTIL_COURT, titreMissionLam, TYPE_MISSION, useMissionsLam } from './mission';
import { ListeMissionsLam } from './MissionLamScreen';

export function AccueilLam(p: { ctx: Ctx; direct: { etat: EtatDirect; pos: Direct | null }; onNew: () => void; onWhere: () => void }) {
  const modules = useModules();
  const list = useMissionsLam();
  const m = missionLamDuJour(list);
  const autres = list.filter((x) => x.id !== m?.id);
  const av = m ? avancementLam(m) : null;
  return (
    <>
      {m && av ? (
        <section className="ds-hero" aria-label="Ma mission LAM / S9">
          <div className="ds-hero-top">
            <span className="ds-tag">{m.fin ? `Mission terminée à ${heure(m.fin)}` : 'Mission en cours'}</span>
            <span className={`ds-status ${m.fin ? 'ok' : 'todo'}`}>
              {av.faites}/{av.total}
            </span>
          </div>
          <h2>{titreMissionLam(m)}</h2>
          <div className="ds-hero-sub">
            {TYPE_MISSION[m.type]}
            {m.type === 'lam' ? ` · ${m.nbLam} LAM` : ` · ${m.outils.map((o) => OUTIL_COURT[o]).join(', ')}`}
            {m.depeches.length ? ` · ${m.depeches.length} dépêche${m.depeches.length > 1 ? 's' : ''}` : ''}
          </div>
          <div className="ds-meter" aria-hidden="true">
            <i style={{ width: `${(av.faites / Math.max(1, av.total)) * 100}%` }} />
          </div>
          {!m.fin && (
            <div className="ds-next compact">
              <span className="ds-tag">{av.pendant ? (m.type === 'lam' ? 'LAM en voie' : 'Bouclage en place') : 'À faire maintenant'}</span>
              <b className="ds-next-texte">{av.pendant ? (m.type === 'lam' ? 'Mode chantier : 30 km/h, aucun SAM franchi' : `${m.ttx} train(s) travaux passé(s)`) : av.prochaine?.texte}</b>
            </div>
          )}
          <div className="ds-hero-actions">
            <button className="ds-btn primary" onClick={() => p.ctx.open({ k: 'lam-mission', id: m.id })}>
              {m.fin ? 'Voir la mission' : 'Continuer la mission'}
            </button>
            {m.lieu.ligne && m.lieu.pk !== null && (
              <button className="ds-btn" onClick={() => p.ctx.onGoPk(m.lieu.ligne!, m.lieu.pk!)} aria-label="Voir sur la carte">
                <Icon name="map" size={20} />
                Carte
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="ds-card ds-empty" aria-label="Première mission LAM / S9">
          <div className="ds-empty-art">
            <Icon name="train" size={48} />
          </div>
          <h2>Prépare ta mission</h2>
          <p>AP LAM ou AP S9 : l’appli te guide étape par étape, note l’heure de chaque geste et tient ton carnet de dépêches.</p>
          <button className="ds-btn primary big wide" onClick={p.onNew}>
            <Icon name="plus" size={22} />
            Nouvelle mission LAM / S9
          </button>
        </section>
      )}
      {m && (
        <button className="ds-btn dark big wide ds-new" onClick={p.onNew}>
          <Icon name="plus" size={22} />
          Nouvelle mission LAM / S9
        </button>
      )}
      <button className="ds-btn wide ds-new danger-tonal" onClick={() => p.ctx.open({ k: 'lam-urgences', id: m && !m.fin ? m.id : undefined })}>
        <Icon name="alert" size={20} />
        Urgence ou aléa ? Fiches réflexes
      </button>

      <h2 className="ds-section-title">En direct</h2>
      <div className="ds-grid">
        <CaseDsh etat={p.direct.etat} pos={p.direct.pos} onClick={() => p.ctx.open({ k: 'lam-dsh' })} />
        <CaseOu etat={p.direct.etat} pos={p.direct.pos} onClick={p.onWhere} />
        {modules.memo && <CaseMemo regles={REGLES_LAM} titre="Mémo LAM / S9" onClick={() => p.ctx.open({ k: 'memo', banque: 'lam' })} />}
        {modules.quiz && <CaseQuiz banque="lam" onClick={() => p.ctx.open({ k: 'quiz', banque: 'lam' })} />}
      </div>
      {modules.quiz && <QuestionDuJour banque="lam" onQuiz={() => p.ctx.open({ k: 'quiz', banque: 'lam' })} />}

      {autres.length > 0 && (
        <>
          <h2 className="ds-section-title">
            <span>Mes missions LAM / S9</span>
            {autres.length > 3 && (
              <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'lam-missions' })}>
                Voir tout ({list.length})
              </button>
            )}
          </h2>
          <ListeMissionsLam list={autres.slice(0, 3)} ctx={p.ctx} />
        </>
      )}
      <p className="ds-foot">
        Aide à la mission, d’après le livret technique AP-LAM / AP-S9 : la consigne LAM, la fiche de travail, la situation géographique et les textes en vigueur
        priment. Les missions restent sur ce téléphone.
      </p>
    </>
  );
}
