/**
 * Les cases vivantes de l'accueil : position en direct, distance d'annonce à la vitesse de l'endroit,
 * une règle qui défile, la progression au quiz, et la question du jour.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../components/parts';
import { fmtLine, fmtPk } from '../lib/format';
import { loadPref, savePref } from '../lib/me';
import type { Direct, EtatDirect } from './direct';
import { today } from './etat';
import { noterReponse, questionDuJour, useQuizStats, type Banque } from './quizStats';
import { DA_MIN_GRANDE_VITESSE, distanceAnnonce } from './rules';

/** Un compteur qui avance toutes les `ms` millisecondes (pour faire défiler), arrêté si l'écran est caché. */
function useTic(ms: number, actif = true): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!actif) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setN((x) => x + 1);
    }, ms);
    return () => clearInterval(id);
  }, [ms, actif]);
  return n;
}

function EnDirect() {
  return (
    <span className="ds-live">
      <i aria-hidden="true" />
      En direct
    </span>
  );
}

/** « Où suis-je ? » : ligne et PK de l'agent, en direct quand le GPS est autorisé. */
export function CaseOu({ etat, pos, onClick }: { etat: EtatDirect; pos: Direct | null; onClick: () => void }) {
  const frais = pos && etat === 'ok';
  return (
    <button className={`ds-quick live ${frais ? 'on' : ''}`} onClick={onClick} aria-label={frais ? `Où suis-je : ligne ${fmtLine(pos.code)}, PK ${fmtPk(pos.pk)}` : 'Où suis-je ?'}>
      <span className="ds-quick-top">
        <span className="ds-quick-ico">
          <Icon name="locate" />
        </span>
        {frais && <EnDirect />}
      </span>
      {frais ? (
        <span className="ds-quick-val">
          <small>Ligne {fmtLine(pos.code)}</small>
          <b className="ds-quick-big">PK {fmtPk(pos.pk)}</b>
          <small>
            ± {Math.max(1, Math.round(pos.precision))} m{pos.ecart > 30 ? ` · à ${Math.round(pos.ecart)} m des voies` : ''}
          </small>
        </span>
      ) : (
        <span>
          <b>Où suis-je ?</b>
          <small>
            {etat === 'recherche'
              ? 'Recherche du GPS…'
              : etat === 'loin'
                ? 'Aucune ligne à moins de 300 m'
                : etat === 'erreur'
                  ? 'GPS indisponible : touche pour réessayer'
                  : 'Touche pour avoir ligne et PK au mètre'}
          </small>
        </span>
      )}
    </button>
  );
}

/** PN le plus proche de l'agent, sur sa ligne, en direct. */
export function CasePn({ etat, pos, onClick }: { etat: EtatDirect; pos: Direct | null; onClick: (code: string, pk: number) => void }) {
  const pn = etat === 'ok' ? (pos?.pn ?? null) : null;
  return (
    <button
      className={`ds-quick live ${pn ? 'on' : ''}`}
      onClick={() => (pn && pos ? onClick(pos.code, pn.pk) : undefined)}
      disabled={!pn}
      aria-label={pn ? `PN le plus proche : ${pn.nom}, à ${pn.distance} m` : 'PN le plus proche'}
    >
      <span className="ds-quick-top">
        <span className="ds-quick-ico">
          <Icon name="tracks" />
        </span>
        {pn && <EnDirect />}
      </span>
      {pn ? (
        <span className="ds-quick-val">
          <small>PN le plus proche</small>
          <b className="ds-quick-big">{pn.nom}</b>
          <small>
            {pn.distance < 1000 ? `${pn.distance} m` : `${(pn.distance / 1000).toFixed(1).replace('.', ',')} km`} {pn.devant ? '▲' : '▼'}
            {pn.lieu ? ` · ${pn.lieu}` : ''}
          </small>
        </span>
      ) : (
        <span>
          <b>PN le plus proche</b>
          <small>{etat === 'recherche' ? 'Recherche du GPS…' : etat === 'ok' ? 'Aucun PN connu sur cette ligne' : 'Avec ta position GPS'}</small>
        </span>
      )}
    </button>
  );
}

const DEMO = [100, 140, 160, 200];
/** Délai d'annonce le plus courant (5 s de dégagement + 5 s de marge), aussi le minimum au-delà de 160 km/h. */
const DA = DA_MIN_GRANDE_VITESSE;

/** Calcul : distance d'annonce à 10 s pour la vitesse de la ligne là où tu es ; sinon, quelques vitesses qui défilent. */
export function CaseCalcul({ pos, onClick }: { pos: Direct | null; onClick: () => void }) {
  const ici = pos?.vmax ?? null;
  const n = useTic(3500, ici === null);
  const v = ici ?? DEMO[n % DEMO.length];
  const da = DA;
  return (
    <button className="ds-quick live" onClick={onClick} aria-label={`Calcul rapide : ${v} km/h, ${distanceAnnonce(v, da)} m à ${da} s`}>
      <span className="ds-quick-top">
        <span className="ds-quick-ico">
          <Icon name="calc" />
        </span>
        {ici !== null && <EnDirect />}
      </span>
      <span className="ds-quick-val">
        <small>{ici !== null ? `Ici : ${v} km/h` : `À ${v} km/h`}</small>
        <b className="ds-quick-big" key={v}>
          {distanceAnnonce(v, da)} m
        </b>
        <small>Distance à {da} s d’annonce</small>
      </span>
    </button>
  );
}

const REGLES = [
  'DA = DD + MS',
  'Au-delà de 160 km/h : 10 s d’annonce au moins',
  'Distance = vitesse ÷ 3,6 × DA, à la dizaine sup.',
  'Délai de dégagement : 5 s au moins, s’il n’est pas nul',
  '2e catégorie : marge de 15 s, dégagement de 15 s au plus',
  'Soudage ou meulage : marge de 15 s',
  'Un annonceur pour 2 sens : marge de 15 s',
  'Voie interdite, clôture limitative : marge de 5 s',
  'Agent seul : 15 s sur voie circulée, 10 s sur voie interdite',
  'ASP annonceur : 3 agents au plus, chantier fixe',
];

/** Mémo : une règle clé qui change toutes les quelques secondes. */
export function CaseMemo({ onClick, regles = REGLES, titre = 'Mémo ASP' }: { onClick: () => void; regles?: string[]; titre?: string }) {
  const n = useTic(6000);
  const REGLES_ = regles;
  const regle = REGLES_[n % REGLES_.length];
  return (
    <button className="ds-quick live" onClick={onClick} aria-label={titre}>
      <span className="ds-quick-top">
        <span className="ds-quick-ico">
          <Icon name="book" />
        </span>
        <span className="ds-quick-count" aria-hidden="true">
          {(n % REGLES_.length) + 1}/{REGLES_.length}
        </span>
      </span>
      <span className="ds-quick-val">
        <small>{titre}</small>
        <b className="ds-quick-rule" key={n % REGLES_.length} aria-live="off">
          {regle}
        </b>
      </span>
    </button>
  );
}

/** Quiz : anneau de progression (questions sues) et erreurs à revoir. */
export function CaseQuiz({ onClick, banque = 'asp' }: { onClick: () => void; banque?: Banque }) {
  const s = useQuizStats(banque);
  const pct = s.total ? Math.round((s.justes / s.total) * 100) : 0;
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <button className="ds-quick live" onClick={onClick} aria-label={`Quiz : ${pct} % des questions sues, ${s.erreurs} erreurs à revoir`}>
      <span className="ds-quick-top">
        <svg className="ds-ring" viewBox="0 0 42 42" width="42" height="42" aria-hidden="true">
          <circle cx="21" cy="21" r={r} className="ds-ring-bg" />
          {pct > 0 && <circle cx="21" cy="21" r={r} className="ds-ring-fg" strokeDasharray={`${(c * pct) / 100} ${c}`} />}
          <text x="21" y="25" textAnchor="middle">
            {pct}%
          </text>
        </svg>
      </span>
      <span className="ds-quick-val">
        <small>Quiz</small>
        <b>
          {s.justes}/{s.total} sues
        </b>
        <small>{s.erreurs ? `${s.erreurs} erreur${s.erreurs > 1 ? 's' : ''} à revoir` : s.justes ? 'Aucune erreur à revoir' : '10 questions pour commencer'}</small>
      </span>
    </button>
  );
}

/** Question du jour : une question par jour, à laquelle on répond depuis l'accueil. */
export function QuestionDuJour({ onQuiz, banque = 'asp' }: { onQuiz: () => void; banque?: Banque }) {
  const QDJ = banque === 'asp' ? 'asp-question-du-jour' : 'asp-pn-question-du-jour';
  const [jour] = useState(today);
  const { q, ordre } = questionDuJour(banque, jour);
  const [choix, setChoix] = useState<number | null>(() => {
    const s = loadPref<{ jour: string; choix: number } | null>(QDJ, null);
    return s && s.jour === jour ? s.choix : null;
  });
  const repondu = choix !== null;
  const juste = choix === q.bonne;
  return (
    <section className="ds-card ds-qdj" aria-label="Question du jour">
      <div className="ds-hero-top">
        <span className="ds-tag">Question du jour · {q.theme}</span>
        {repondu && <span className={`ds-status ${juste ? 'ok' : 'stop'}`}>{juste ? 'Bonne réponse' : 'À revoir'}</span>}
      </div>
      <h3 className="ds-qdj-q">{q.q}</h3>
      <div className="ds-qdj-choix">
        {ordre.map((idx) => {
          const etat = !repondu ? '' : idx === q.bonne ? 'juste' : idx === choix ? 'faux' : 'grise';
          return (
            <button
              key={idx}
              className={`ds-qdj-btn ${etat}`}
              disabled={repondu}
              onClick={() => {
                setChoix(idx);
                savePref(QDJ, { jour, choix: idx });
                noterReponse(banque, q.id, idx === q.bonne);
              }}
            >
              {etat === 'juste' && <Icon name="check" size={18} />}
              {q.choix[idx]}
            </button>
          );
        })}
      </div>
      {repondu && (
        <>
          <p className="ds-qdj-expl">{q.explication}</p>
          <button className="ds-btn text" style={{ paddingLeft: 0 }} onClick={onQuiz}>
            Continuer avec une série de questions
          </button>
        </>
      )}
    </section>
  );
}
