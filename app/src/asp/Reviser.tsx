/** Onglet « Réviser » : mémo, quiz et cas pratiques de l'activité du jour d'abord, puis ceux de l'autre activité. */
import { MEMO_PN } from '../pn/memo';
import { EXERCICES_ORDRE } from '../pn/ordre';
import { useActivite } from './activite';
import type { Ctx } from './contexte';
import { Ligne, Section } from './kit';
import { MEMO } from './memo';
import { useQuizStats } from './quizStats';

function GroupeAsp({ ctx }: { ctx: Ctx }) {
  const s = useQuizStats('asp');
  return (
    <Section title="Annonce · TES M">
      <Ligne icon="book" badgeClass="brand" title="Mémo ASP" sub={`${MEMO.length} fiches : outillage, marges, bruit, AAn, signaux…`} onClick={() => ctx.open({ k: 'memo' })} />
      <Ligne
        icon="sparkle"
        badgeClass="brand"
        title="Quiz"
        sub={s.erreurs ? `${s.erreurs} erreur${s.erreurs > 1 ? 's' : ''} à revoir · ${s.justes}/${s.total} sues` : `${s.total} questions avec explications`}
        onClick={() => ctx.open({ k: 'quiz' })}
      />
      <Ligne icon="calc" badgeClass="brand" title="Cas pratiques" sub="Les 7 exercices « Terrain et CADA », corrigés" onClick={() => ctx.open({ k: 'cas' })} />
    </Section>
  );
}

function GroupePn({ ctx }: { ctx: Ctx }) {
  const s = useQuizStats('pn');
  return (
    <Section title="Agent PN · TES F">
      <Ligne icon="book" badgeClass="brand" title="Mémo PN" sub={`${MEMO_PN.length} fiches : boîtier, Marche-Arrêt, dérangements, missions…`} onClick={() => ctx.open({ k: 'memo', banque: 'pn' })} />
      <Ligne
        icon="sparkle"
        badgeClass="brand"
        title="Quiz PN"
        sub={s.erreurs ? `${s.erreurs} erreur${s.erreurs > 1 ? 's' : ''} à revoir · ${s.justes}/${s.total} sues` : `${s.total} questions avec explications`}
        onClick={() => ctx.open({ k: 'quiz', banque: 'pn' })}
      />
      <Ligne icon="list" badgeClass="brand" title="Cas pratiques PN" sub={`${EXERCICES_ORDRE.length} procédures à remettre dans l’ordre`} onClick={() => ctx.open({ k: 'pn-ordre' })} />
    </Section>
  );
}

export function Reviser({ ctx }: { ctx: Ctx }) {
  const activite = useActivite();
  return (
    <main className="ds-page" aria-label="Réviser">
      <header className="ds-page-head">
        <div>
          <h1>Réviser</h1>
          <p>{activite === 'pn' ? 'D’après le support TES F – intervenant PN' : 'D’après le support TES M – compétence ASP'}</p>
        </div>
      </header>
      {activite === 'pn' ? <GroupePn ctx={ctx} /> : <GroupeAsp ctx={ctx} />}
      <Section title="Les incontournables" flat>
        <div className="ds-card ds-memo-flash">
          {activite === 'pn' ? (
            <>
              <p>
                <b>Feu rouge clignotant</b> : arrêt absolu pour tous les usagers de la route.
              </p>
              <p>
                <b>Ligne BAL</b> : blocage sur FERMETURE avant de mettre une annonce hors service.
              </p>
              <p>
                <b>Mobile travaux</b> : retirer d’abord le SAM le plus éloigné, repositionner d’abord le plus proche.
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </Section>
      {activite === 'pn' ? <GroupeAsp ctx={ctx} /> : <GroupePn ctx={ctx} />}
    </main>
  );
}
