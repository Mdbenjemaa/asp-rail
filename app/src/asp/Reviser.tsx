/** Onglet « Réviser » : mémo, quiz et cas pratiques de l'activité du jour d'abord, puis ceux des autres activités. */
import type { ReactNode } from 'react';
import { useModules, type Modules } from '../access/entreprise';
import { MEMO_LAM } from '../lam/memo';
import { EXERCICES_LAM } from '../lam/ordre';
import { MEMO_PN } from '../pn/memo';
import { EXERCICES_ORDRE } from '../pn/ordre';
import { useActivite, type Activite } from './activite';
import type { Ctx } from './contexte';
import { Ligne, Section } from './kit';
import { MEMO } from './memo';
import { useQuizStats, type Banque } from './quizStats';

const progression = (s: { erreurs: number; justes: number; total: number }) =>
  s.erreurs ? `${s.erreurs} erreur${s.erreurs > 1 ? 's' : ''} à revoir · ${s.justes}/${s.total} sues` : `${s.total} questions avec explications`;

function Quiz({ ctx, banque, titre }: { ctx: Ctx; banque: Banque; titre: string }) {
  const s = useQuizStats(banque);
  return <Ligne icon="sparkle" badgeClass="brand" title={titre} sub={progression(s)} onClick={() => ctx.open({ k: 'quiz', banque })} />;
}

/** Mémo, quiz et cas pratiques de chaque activité, selon le contenu de l'entreprise. */
const GROUPES: Record<Activite, (ctx: Ctx, m: Modules) => ReactNode> = {
  asp: (ctx, m) => (
    <Section key="asp" title="Annonce · TES M">
      {m.memo && <Ligne icon="book" badgeClass="brand" title="Mémo ASP" sub={`${MEMO.length} fiches : outillage, marges, bruit, AAn, signaux…`} onClick={() => ctx.open({ k: 'memo' })} />}
      {m.quiz && <Quiz ctx={ctx} banque="asp" titre="Quiz" />}
      {m.quiz && <Ligne icon="calc" badgeClass="brand" title="Cas pratiques" sub="Les 7 exercices « Terrain et CADA », corrigés" onClick={() => ctx.open({ k: 'cas' })} />}
    </Section>
  ),
  pn: (ctx, m) => (
    <Section key="pn" title="Agent PN · TES F">
      {m.memo && <Ligne icon="book" badgeClass="brand" title="Mémo PN" sub={`${MEMO_PN.length} fiches : boîtier, Marche-Arrêt, dérangements, missions…`} onClick={() => ctx.open({ k: 'memo', banque: 'pn' })} />}
      {m.quiz && <Quiz ctx={ctx} banque="pn" titre="Quiz PN" />}
      {m.quiz && <Ligne icon="list" badgeClass="brand" title="Cas pratiques PN" sub={`${EXERCICES_ORDRE.length} procédures à remettre dans l’ordre`} onClick={() => ctx.open({ k: 'pn-ordre' })} />}
    </Section>
  ),
  lam: (ctx, m) => (
    <Section key="lam" title="AP LAM · AP S9">
      {m.memo && <Ligne icon="book" badgeClass="brand" title="Mémo LAM / S9" sub={`${MEMO_LAM.length} fiches : mise en voie, limiteurs, DSh, dépêches, urgences…`} onClick={() => ctx.open({ k: 'memo', banque: 'lam' })} />}
      {m.quiz && <Quiz ctx={ctx} banque="lam" titre="Quiz LAM / S9" />}
      {m.quiz && <Ligne icon="list" badgeClass="brand" title="Cas pratiques LAM / S9" sub={`${EXERCICES_LAM.length} procédures à remettre dans l’ordre`} onClick={() => ctx.open({ k: 'lam-ordre' })} />}
    </Section>
  ),
};

const SOURCE: Record<Activite, string> = {
  asp: 'D’après le support TES M – compétence ASP',
  pn: 'D’après le support TES F – intervenant PN',
  lam: 'D’après le livret technique AP-LAM / AP-S9',
};

const INCONTOURNABLES: Record<Activite, [string, string][]> = {
  asp: [
    ['DA = DD + MS.', 'Au-delà de 160 km/h, au moins 10 s.'],
    ['Distance = vitesse ÷ 3,6 × DA', ', arrondie à la dizaine de mètres supérieure.'],
    ['Marge', ' : 5 s en général sur voie circulée, 15 s pour la 2e catégorie, le soudage ou le meulage, un obstacle masquant, un annonceur pour 2 sens ou l’ASP qui surveille lui-même.'],
  ],
  pn: [
    ['Feu rouge clignotant', ' : arrêt absolu pour tous les usagers de la route.'],
    ['Ligne BAL', ' : blocage sur FERMETURE avant de mettre une annonce hors service.'],
    ['Mobile travaux', ' : retirer d’abord le SAM le plus éloigné, repositionner d’abord le plus proche.'],
  ],
  lam: [
    ['Mode chantier', ' : 30 km/h au plus, klaxon à chaque démarrage, 100 m avec le mobile qui précède.'],
    ['Aucun SAM franchi', ' : arrêt du LAM et appel au CCh. Talonnage des aiguilles interdit.'],
    ['Passage d’un TTx', ' : pinces, pétard, SAM, dépêche ; puis SAM, pétard, pinces, dépêche.'],
  ],
};

export function Reviser({ ctx }: { ctx: Ctx }) {
  const activite = useActivite();
  const m = useModules();
  const ordre: Activite[] = [activite, ...(['asp', 'pn', 'lam'] as Activite[]).filter((a) => a !== activite)];
  return (
    <main className="ds-page" aria-label="Réviser">
      <header className="ds-page-head">
        <div>
          <h1>Réviser</h1>
          <p>{SOURCE[activite]}</p>
        </div>
      </header>
      {GROUPES[activite](ctx, m)}
      {m.memo && (
        <Section title="Les incontournables" flat>
          <div className="ds-card ds-memo-flash">
            {INCONTOURNABLES[activite].map(([b, t]) => (
              <p key={b}>
                <b>{b}</b>
                {t.startsWith(' ') || t.startsWith(',') ? t : ` ${t}`}
              </p>
            ))}
          </div>
        </Section>
      )}
      {ordre.slice(1).map((a) => GROUPES[a](ctx, m))}
    </main>
  );
}
