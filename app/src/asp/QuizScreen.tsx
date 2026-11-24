/** Quiz de révision : séries de questions, explication après chaque réponse, et reprise de ses erreurs. */
import { useMemo, useState } from 'react';
import { loadPref, savePref } from '../lib/me';
import { melanger, QUESTIONS, THEMES, type Question } from './quiz';
import { ScreenHead } from './ui';

const KEY = 'asp-quiz-erreurs';

interface Tour {
  q: Question;
  /** Choix dans l'ordre affiché, avec leur index d'origine. */
  ordre: number[];
}

const preparer = (qs: Question[]): Tour[] => melanger(qs).map((q) => ({ q, ordre: melanger(q.choix.map((_, i) => i)) }));

export function QuizScreen({ onBack }: { onBack: () => void }) {
  const [erreurs, setErreurs] = useState<string[]>(() => loadPref<string[]>(KEY, []));
  const [serie, setSerie] = useState<Tour[] | null>(null);
  const [i, setI] = useState(0);
  const [choisi, setChoisi] = useState<number | null>(null);
  const [score, setScore] = useState<{ ok: number; rates: Tour[] }>({ ok: 0, rates: [] });
  const [theme, setTheme] = useState<string | null>(null);

  const garder = (ids: string[]) => {
    setErreurs(ids);
    savePref(KEY, ids);
  };
  const lancer = (qs: Question[]) => {
    setSerie(preparer(qs));
    setI(0);
    setChoisi(null);
    setScore({ ok: 0, rates: [] });
  };
  const pool = useMemo(() => (theme ? QUESTIONS.filter((q) => q.theme === theme) : QUESTIONS), [theme]);

  if (!serie) {
    return (
      <div className="screen asp-screen" role="dialog" aria-label="Quiz">
        <ScreenHead title="Quiz" sub={`${QUESTIONS.length} questions`} onBack={onBack} />
        <div className="screen-body asp-body">
          <div className="asp-mini-label">Thème</div>
          <div className="chips">
            <button className={`chip ${theme === null ? 'on' : ''}`} onClick={() => setTheme(null)}>
              Tous
            </button>
            {THEMES.map((t) => (
              <button key={t} className={`chip ${theme === t ? 'on' : ''}`} onClick={() => setTheme(t)}>
                {t}
              </button>
            ))}
          </div>
          <button className="btn primary wide asp-quiz-start" onClick={() => lancer(melanger(pool).slice(0, 10))}>
            Série de {Math.min(10, pool.length)} questions
          </button>
          <button className="btn wide" onClick={() => lancer(pool)}>
            Toutes les questions{theme ? ` « ${theme} »` : ''} ({pool.length})
          </button>
          <button className="btn wide" disabled={!erreurs.length} onClick={() => lancer(QUESTIONS.filter((q) => erreurs.includes(q.id)))}>
            Revoir mes erreurs ({erreurs.length})
          </button>
          <p className="muted small">Une question bien répondue sort de « mes erreurs ». D’après le support « TES M – compétence ASP ».</p>
        </div>
      </div>
    );
  }

  const fini = i >= serie.length;
  if (fini) {
    return (
      <div className="screen asp-screen" role="dialog" aria-label="Résultat du quiz">
        <ScreenHead title="Résultat" onBack={() => setSerie(null)} />
        <div className="screen-body asp-body">
          <div className="asp-score">
            <b>
              {score.ok}/{serie.length}
            </b>
            <span>{score.ok === serie.length ? 'Sans faute !' : score.ok >= serie.length * 0.8 ? 'Bien joué.' : 'À revoir.'}</span>
          </div>
          {score.rates.map((t) => (
            <div key={t.q.id} className="asp-bloc asp-quiz-rate">
              <b>{t.q.q}</b>
              <p className="ok small">{t.q.choix[t.q.bonne]}</p>
              <p className="small">{t.q.explication}</p>
            </div>
          ))}
          <button className="btn primary wide" onClick={() => setSerie(null)}>
            Nouvelle série
          </button>
        </div>
      </div>
    );
  }

  const t = serie[i];
  const repondu = choisi !== null;
  const juste = repondu && choisi === t.q.bonne;
  const repondre = (idx: number) => {
    if (repondu) return;
    setChoisi(idx);
    if (idx === t.q.bonne) {
      setScore((s) => ({ ...s, ok: s.ok + 1 }));
      if (erreurs.includes(t.q.id)) garder(erreurs.filter((x) => x !== t.q.id));
    } else {
      setScore((s) => ({ ...s, rates: [...s.rates, t] }));
      if (!erreurs.includes(t.q.id)) garder([...erreurs, t.q.id]);
    }
  };
  return (
    <div className="screen asp-screen" role="dialog" aria-label="Quiz">
      <ScreenHead title={`Question ${i + 1}/${serie.length}`} sub={t.q.theme} onBack={() => setSerie(null)} backLabel="Arrêter la série" />
      <div className="screen-body asp-body">
        <div className="asp-progress" aria-hidden="true">
          <div style={{ width: `${(i / serie.length) * 100}%` }} />
        </div>
        <p className="asp-question">{t.q.q}</p>
        <div className="asp-reponses">
          {t.ordre.map((idx) => {
            const etat = !repondu ? '' : idx === t.q.bonne ? 'juste' : idx === choisi ? 'faux' : 'grise';
            return (
              <button key={idx} className={`asp-reponse ${etat}`} onClick={() => repondre(idx)} disabled={repondu && etat === 'grise'}>
                {t.q.choix[idx]}
              </button>
            );
          })}
        </div>
        {repondu && (
          <div className={`asp-explication ${juste ? 'juste' : 'faux'}`} role="status">
            <b>{juste ? 'Bonne réponse.' : 'Pas tout à fait.'}</b> {t.q.explication}
          </div>
        )}
        {repondu && (
          <button
            className="btn primary wide"
            onClick={() => {
              setI(i + 1);
              setChoisi(null);
            }}
          >
            {i + 1 < serie.length ? 'Question suivante' : 'Voir le résultat'}
          </button>
        )}
      </div>
    </div>
  );
}
