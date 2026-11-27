/**
 * Accueil de l'annonce, côté chaîne : l'annonceur, le répétiteur ou la sentinelle voit son poste (où il est, ce qu'il
 * doit voir, son service), le prend dans la chaîne de son ASP (chantier partagé) ou le saisit, et retrouve ses
 * gestes et signaux.
 */
import { Icon } from '../components/parts';
import { useModules } from '../access/entreprise';
import { fmtLine, fmtPk } from '../lib/format';
import { useHorloge } from '../pn/horloge';
import type { Ctx } from '../asp/contexte';
import { metres } from '../asp/dispositif';
import { Ligne } from '../asp/kit';
import { CaseMemo, CaseOu, CaseQuiz } from '../asp/Widgets';
import type { Direct, EtatDirect } from '../asp/direct';
import { usePrendrePoste } from './prendre';
import { codeLibre, ecartPa, enregistrerPoste, etatPoste, nouveauPoste, posteDuJour, ROLE_CHAINE, usePostes, type Poste } from './poste';
import { OuJeSuis, ServicePoste } from './PosteScreen';

export function AccueilChaine(p: { ctx: Ctx; direct: { etat: EtatDirect; pos: Direct | null }; onWhere: () => void }) {
  const modules = useModules();
  const postes = usePostes();
  const poste = posteDuJour(postes);
  const prendre = usePrendrePoste();
  const now = useHorloge();
  const precedents = postes.filter((x) => x.id !== poste?.id && !x.brouillon).sort((a, b) => b.updated - a.updated);
  const nouveau = () => {
    const n = nouveauPoste({ brouillon: true, code: codeLibre('annonceur', []), aspTel: poste?.aspTel ?? '', asp: poste?.asp ?? '' });
    enregistrerPoste(n);
    p.ctx.open({ k: 'poste-edit', id: n.id, nouveau: true });
  };
  const ouvrir = (x: Poste) => p.ctx.open({ k: 'poste', id: x.id });
  const chaines = (
    <div className="ds-list ch-chaines" role="group" aria-label="Chaînes partagées par les ASP">
      {prendre.boutons((x) => {
        p.ctx.onToast(`Poste ${x.code} pris dans la chaîne : ton ASP voit quand tu es en place.`);
        ouvrir(x);
      })}
    </div>
  );

  return (
    <>
      {poste ? (
        (() => {
          const e = etatPoste(poste, now);
          return (
            <section className={`ds-hero ch-hero ${e.niveau}`} aria-label="Mon poste">
              <div className="ds-hero-top">
                <span className="ds-tag">
                  {ROLE_CHAINE[poste.role]} {poste.code} · {poste.horaire === 'nuit' ? 'nuit' : 'jour'}
                </span>
                <span className={`ds-status ${e.niveau === 'en-place' ? 'ok' : 'todo'}`}>{e.texte}</span>
              </div>
              <h2>{poste.chantier || 'Mon poste'}</h2>
              <div className="ds-hero-sub">
                {[poste.ligne ? `Ligne ${fmtLine(poste.ligne)}` : null, poste.pk !== null ? `Mon PK ${fmtPk(poste.pk)}` : 'PK à indiquer', poste.surveille || null].filter(Boolean).join(' · ')}
              </div>
              {poste.pas.map((pa) => {
                const d = ecartPa(poste, pa);
                return (
                  <p key={pa.titre} className="ch-voir">
                    <Icon name="flag" size={18} />
                    {d !== null && d <= 5 ? `${pa.titre} : je suis au point d’annonce` : `Je dois voir jusqu’au PK ${fmtPk(pa.pk)} (${pa.titre})${d !== null ? ` · ${metres(d)}` : ''}`}
                  </p>
                );
              })}
              <OuJeSuis p={poste} actif />
              <ServicePoste p={poste} compact />
              <div className="ds-hero-actions">
                <button className="ds-btn primary" onClick={() => ouvrir(poste)}>
                  Ouvrir mon poste
                </button>
                <button className="ds-btn" onClick={() => poste.ligne && poste.pk !== null && p.ctx.onGoPk(poste.ligne, poste.pk)} disabled={!poste.ligne || poste.pk === null} aria-label="Mon poste sur la carte">
                  <Icon name="map" size={20} />
                  Carte
                </button>
              </div>
            </section>
          );
        })()
      ) : (
        <section className="ds-card ds-empty" aria-label="Prendre mon poste">
          <div className="ds-empty-art">
            <Icon name="flag" size={48} />
          </div>
          <h2>Prends ton poste</h2>
          <p>Annonceur, répétiteur ou sentinelle : ton PK, ce que tu surveilles, jusqu’où tu dois voir arriver les trains, et ton service noté d’un toucher.</p>
          {prendre.chaines.length > 0 && (
            <>
              <p className="ch-chaines-titre">Prends-le dans la chaîne de ton ASP :</p>
              {chaines}
            </>
          )}
          <button className={`ds-btn ${prendre.chaines.length ? '' : 'primary'} big wide`} onClick={nouveau}>
            <Icon name="plus" size={22} />
            Saisir mon poste
          </button>
        </section>
      )}
      {poste && prendre.chaines.length > 0 && !poste.lien && (
        <>
          <h2 className="ds-section-title">Prendre mon poste dans la chaîne de l’ASP</h2>
          {chaines}
        </>
      )}
      {poste && (
        <button className="ds-btn dark big wide ds-new" onClick={nouveau}>
          <Icon name="plus" size={22} />
          Nouveau poste
        </button>
      )}

      <h2 className="ds-section-title">Pour m’aider</h2>
      <div className="ds-list">
        <Ligne icon="book" badgeClass="brand" title="Mes gestes et signaux" sub="Fiche réflexe annonceur, répétiteur, sentinelle" onClick={() => p.ctx.open({ k: 'gestes', role: poste?.role })} />
      </div>
      <div className="ds-grid">
        <CaseOu etat={p.direct.etat} pos={p.direct.pos} onClick={p.onWhere} />
        {modules.memo && <CaseMemo onClick={() => p.ctx.open({ k: 'memo', section: 'placer' })} />}
        {modules.quiz && <CaseQuiz onClick={() => p.ctx.open({ k: 'quiz' })} />}
      </div>

      {precedents.length > 0 && (
        <>
          <h2 className="ds-section-title">Mes postes précédents</h2>
          <div className="ds-list">
            {precedents.slice(0, 3).map((x) => (
              <Ligne key={x.id} badge={x.code} title={x.chantier || `${ROLE_CHAINE[x.role]} ${x.code}`} sub={`${x.date.split('-').reverse().join('/')} · ${etatPoste(x).texte}`} onClick={() => ouvrir(x)} />
            ))}
          </div>
        </>
      )}
      <p className="ds-foot">Aide sur place, jamais une référence de sécurité : les consignes de ton ASP, la fiche CADA et les consignes locales priment.</p>
    </>
  );
}
