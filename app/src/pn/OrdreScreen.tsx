/** Cas pratiques PN : remettre dans l'ordre les gestes d'une procédure, puis vérifier. */
import { useState } from 'react';
import { Icon } from '../components/parts';
import { melanger } from '../asp/quiz';
import type { Ctx } from '../asp/contexte';
import { Ecran, Ligne, Section } from '../asp/kit';
import { EXERCICES_ORDRE, type ExerciceOrdre } from './ordre';

export function OrdreScreen(p: { ctx: Ctx; hidden?: boolean }) {
  const [ex, setEx] = useState<ExerciceOrdre | null>(null);
  if (ex) return <Exercice key={ex.id} ex={ex} hidden={p.hidden} onBack={() => setEx(null)} />;
  return (
    <Ecran label="Cas pratiques PN" title="Cas pratiques PN" onBack={p.ctx.back} hidden={p.hidden}>
      <p className="ds-q-help">Remets les gestes dans le bon ordre, comme sur le terrain. D’après le support TES F.</p>
      <Section>
        {EXERCICES_ORDRE.map((e) => (
          <Ligne key={e.id} icon="list" badgeClass="brand" title={e.titre} sub={`${e.etapes.length} gestes · ${e.contexte}`} onClick={() => setEx(e)} />
        ))}
      </Section>
    </Ecran>
  );
}

function Exercice({ ex, onBack, hidden }: { ex: ExerciceOrdre; onBack: () => void; hidden?: boolean }) {
  const [pioche, setPioche] = useState(() => melanger(ex.etapes.map((_, i) => i)));
  const [ordre, setOrdre] = useState<number[]>([]);
  const [verifie, setVerifie] = useState(false);
  const [solution, setSolution] = useState(false);
  const justes = ordre.filter((v, k) => v === k).length;
  const complet = ordre.length === ex.etapes.length;
  const recommencer = () => {
    setPioche(melanger(ex.etapes.map((_, i) => i)));
    setOrdre([]);
    setVerifie(false);
    setSolution(false);
  };
  return (
    <Ecran
      label={ex.titre}
      title={
        <>
          {ex.titre}
          <small>Cas pratique PN</small>
        </>
      }
      onBack={onBack}
      hidden={hidden}
      actionsCol
      actions={
        verifie ? (
          <button className="ds-btn primary big" onClick={recommencer}>
            Recommencer
          </button>
        ) : (
          <button className="ds-btn primary big" disabled={!complet} onClick={() => setVerifie(true)}>
            {complet ? 'Vérifier mon ordre' : `Encore ${ex.etapes.length - ordre.length} geste(s) à placer`}
          </button>
        )
      }
    >
      <p className="ds-q-help">{ex.contexte} Touche les gestes dans l’ordre ; touche un geste placé pour le retirer.</p>
      {verifie && (
        <section className={`ds-verdict ${justes === ex.etapes.length ? 'normal' : 'fermeture'}`} aria-label="Résultat">
          <h2>{justes === ex.etapes.length ? 'Tout est dans le bon ordre' : `${justes} geste${justes > 1 ? 's' : ''} sur ${ex.etapes.length} à la bonne place`}</h2>
          <p>{ex.explication}</p>
        </section>
      )}
      <h3 className="ds-section-title">Ton ordre</h3>
      <ol className="ds-order">
        {ordre.map((v, k) => (
          <li key={v}>
            <button
              className={`ds-order-item ${verifie ? (v === k ? 'juste' : 'faux') : ''}`}
              disabled={verifie}
              onClick={() => {
                setOrdre(ordre.filter((x) => x !== v));
                setPioche([...pioche, v]);
              }}
            >
              <span className="ds-step-n">{verifie ? <Icon name={v === k ? 'check' : 'close'} size={16} /> : k + 1}</span>
              {ex.etapes[v]}
            </button>
          </li>
        ))}
        {!ordre.length && <li className="ds-hint">Touche le premier geste ci-dessous.</li>}
      </ol>
      {!verifie && pioche.length > 0 && (
        <>
          <h3 className="ds-section-title">Gestes à placer</h3>
          <div className="ds-pioche">
            {pioche.map((v) => (
              <button
                key={v}
                className="ds-pioche-item"
                onClick={() => {
                  setPioche(pioche.filter((x) => x !== v));
                  setOrdre([...ordre, v]);
                }}
              >
                {ex.etapes[v]}
              </button>
            ))}
          </div>
        </>
      )}
      {verifie && justes < ex.etapes.length && (
        <>
          <button className="ds-btn text" onClick={() => setSolution(!solution)}>
            {solution ? 'Masquer la bonne réponse' : 'Voir la bonne réponse'}
          </button>
          {solution && (
            <ol className="ds-order solution">
              {ex.etapes.map((t, k) => (
                <li key={k}>
                  <span className="ds-order-item juste">
                    <span className="ds-step-n">{k + 1}</span>
                    {t}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Ecran>
  );
}
