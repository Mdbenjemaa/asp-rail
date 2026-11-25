/** Accueil en activité « Agent PN » : ma mission du jour, le PN le plus proche en direct, révisions TES F. */
import { Icon } from '../components/parts';
import type { Ctx } from '../asp/contexte';
import type { Direct, EtatDirect } from '../asp/direct';
import { CaseMemo, CaseOu, CasePn, CaseQuiz, QuestionDuJour } from '../asp/Widgets';
import { REGLES_PN } from './memo';
import { avancement, heure, missionDuJour, ROLE_PN, titreMission, TYPE_PN, useMissions } from './mission';
import { ListeMissions } from './MissionScreen';

export function AccueilPn(p: { ctx: Ctx; direct: { etat: EtatDirect; pos: Direct | null }; onNew: () => void; onWhere: () => void }) {
  const list = useMissions();
  const m = missionDuJour(list);
  const autres = list.filter((x) => x.id !== m?.id);
  const av = m ? avancement(m) : null;
  return (
    <>
      {m && av ? (
        <section className="ds-hero" aria-label="Ma mission PN">
          <div className="ds-hero-top">
            <span className="ds-tag">{m.fin ? `Mission terminée à ${heure(m.fin)}` : 'Mission en cours'}</span>
            <span className={`ds-status ${m.fin ? 'ok' : 'todo'}`}>
              {av.faites}/{av.total}
            </span>
          </div>
          <h2>{titreMission(m)}</h2>
          <div className="ds-hero-sub">
            {ROLE_PN[m.role]}
            {m.pn.type ? ` · ${TYPE_PN[m.pn.type]}` : ''}
            {m.pn.lieu ? ` · ${m.pn.lieu}` : ''}
          </div>
          <div className="ds-meter" aria-hidden="true">
            <i style={{ width: `${(av.faites / Math.max(1, av.total)) * 100}%` }} />
          </div>
          {!m.fin && (
            <div className="ds-next compact">
              <span className="ds-tag">{av.pendant ? 'PN repris en travaux' : 'À faire maintenant'}</span>
              <b className="ds-next-texte">{av.pendant ? `${m.passages} mobile(s) travaux, ${m.lam} LAM passés` : av.prochaine?.texte}</b>
            </div>
          )}
          <div className="ds-hero-actions">
            <button className="ds-btn primary" onClick={() => p.ctx.open({ k: 'pn-mission', id: m.id })}>
              {m.fin ? 'Voir la mission' : 'Continuer la mission'}
            </button>
            {m.pn.ligne && m.pn.pk !== null && (
              <button className="ds-btn" onClick={() => p.ctx.onGoPk(m.pn.ligne!, m.pn.pk!)} aria-label="Voir le PN sur la carte">
                <Icon name="map" size={20} />
                Carte
              </button>
            )}
          </div>
        </section>
      ) : (
        <section className="ds-card ds-empty" aria-label="Première mission PN">
          <div className="ds-empty-art">
            <Icon name="tracks" size={48} />
          </div>
          <h2>Prépare ta mission PN</h2>
          <p>Choisis ton PN (le GPS trouve les plus proches), puis l’appli te guide étape par étape et note l’heure de chaque geste.</p>
          <button className="ds-btn primary big wide" onClick={p.onNew}>
            <Icon name="plus" size={22} />
            Nouvelle mission PN
          </button>
        </section>
      )}
      {m && (
        <button className="ds-btn dark big wide ds-new" onClick={p.onNew}>
          <Icon name="plus" size={22} />
          Nouvelle mission PN
        </button>
      )}
      <button className="ds-btn wide ds-new danger-tonal" onClick={() => p.ctx.open({ k: 'pn-diagnostic', id: m && !m.fin ? m.id : undefined })}>
        <Icon name="alert" size={20} />
        Un PN ne marche pas ? Diagnostic
      </button>

      <h2 className="ds-section-title">En direct</h2>
      <div className="ds-grid">
        <CasePn etat={p.direct.etat} pos={p.direct.pos} onClick={(code, pk) => p.ctx.onGoPk(code, pk)} />
        <CaseOu etat={p.direct.etat} pos={p.direct.pos} onClick={p.onWhere} />
        <CaseMemo regles={REGLES_PN} titre="Mémo PN" onClick={() => p.ctx.open({ k: 'memo', banque: 'pn' })} />
        <CaseQuiz banque="pn" onClick={() => p.ctx.open({ k: 'quiz', banque: 'pn' })} />
      </div>
      <QuestionDuJour banque="pn" onQuiz={() => p.ctx.open({ k: 'quiz', banque: 'pn' })} />

      {autres.length > 0 && (
        <>
          <h2 className="ds-section-title">
            <span>Mes missions PN</span>
            {autres.length > 3 && (
              <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'pn-missions' })}>
                Voir tout ({list.length})
              </button>
            )}
          </h2>
          <ListeMissions list={autres.slice(0, 3)} ctx={p.ctx} />
        </>
      )}
      <p className="ds-foot">
        Aide à la mission, d’après le support TES F : la fiche de travail, la consigne PN et le livret de service priment. Les missions restent sur ce
        téléphone.
      </p>
    </>
  );
}
