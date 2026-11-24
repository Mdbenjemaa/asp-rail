/** Onglet « Réviser » : mémo, quiz et cas pratiques du support TES M – compétence ASP. */
import { loadPref } from '../lib/me';
import type { Ctx } from './contexte';
import { Ligne, Section } from './kit';
import { MEMO } from './memo';
import { QUESTIONS } from './quiz';

export function Reviser({ ctx }: { ctx: Ctx }) {
  const erreurs = loadPref<string[]>('asp-quiz-erreurs', []).length;
  return (
    <main className="ds-page" aria-label="Réviser">
      <header className="ds-page-head">
        <div>
          <h1>Réviser</h1>
          <p>D’après le support TES M – compétence ASP</p>
        </div>
      </header>
      <Section>
        <Ligne icon="book" badgeClass="brand" title="Mémo ASP" sub={`${MEMO.length} fiches : outillage, marges, bruit, AAn, signaux…`} onClick={() => ctx.open({ k: 'memo' })} />
        <Ligne
          icon="sparkle"
          badgeClass="brand"
          title="Quiz"
          sub={erreurs ? `${erreurs} erreur${erreurs > 1 ? 's' : ''} à revoir · ${QUESTIONS.length} questions` : `${QUESTIONS.length} questions avec explications`}
          onClick={() => ctx.open({ k: 'quiz' })}
        />
        <Ligne icon="calc" badgeClass="brand" title="Cas pratiques" sub="Les 7 exercices « Terrain et CADA », corrigés" onClick={() => ctx.open({ k: 'cas' })} />
      </Section>
      <Section title="Les incontournables" flat>
        <div className="ds-card ds-memo-flash">
          <p>
            <b>DA = DD + MS.</b> Au-delà de 160 km/h, au moins 10 s.
          </p>
          <p>
            <b>Distance = vitesse ÷ 3,6 × DA</b>, arrondie à la dizaine de mètres supérieure.
          </p>
          <p>
            <b>Marge</b> : 5 s en général sur voie circulée, 15 s pour la 2e catégorie, le soudage ou le meulage, un obstacle masquant, un annonceur
            pour 2 sens ou l’ASP qui surveille lui-même.
          </p>
        </div>
      </Section>
    </main>
  );
}
