/**
 * Tout ce qui passe par-dessus la carte : la page de l'onglet ouvert (Accueil, Calcul, Réviser), puis les écrans
 * ouverts les uns sur les autres (le dernier au-dessus ; ceux du dessous gardent leur état).
 */
import type { Onglet } from '../components/BottomNav';
import { Accueil } from './Accueil';
import { Assistant } from './Assistant';
import { CalculRapide } from './CalculRapide';
import { CasScreen } from './CasScreen';
import type { Ctx, Vue } from './contexte';
import { Chantiers, Checklists, Fiche } from './Fiche';
import { MemoScreen } from './MemoScreen';
import { QuizScreen } from './QuizScreen';
import { Reviser } from './Reviser';
import { enregistrer } from './store';

export function Couche(p: { tab: Onglet; pile: Vue[]; ctx: Ctx; onNew: () => void; onMenu: () => void; onWhere: () => void; onTab: (t: Onglet) => void }) {
  const { ctx } = p;
  const top = p.pile.length - 1;
  return (
    <>
      {p.tab === 'accueil' && <Accueil ctx={ctx} onNew={p.onNew} onMenu={p.onMenu} onWhere={p.onWhere} onTab={p.onTab} />}
      {p.tab === 'calcul' && <CalculRapide />}
      {p.tab === 'reviser' && <Reviser ctx={ctx} />}
      {p.pile.map((v, k) => {
        const hidden = k < top;
        const key = `${k}-${v.k}-${'id' in v ? v.id : ''}`;
        switch (v.k) {
          case 'assistant':
            return <Assistant key={key} id={v.id} etape={v.etape} seule={v.seule} hidden={hidden} ctx={ctx} />;
          case 'fiche':
            return <Fiche key={key} id={v.id} hidden={hidden} ctx={ctx} />;
          case 'checklists':
            return <Checklists key={key} id={v.id} hidden={hidden} ctx={ctx} />;
          case 'chantiers':
            return <Chantiers key={key} hidden={hidden} ctx={ctx} onNew={p.onNew} />;
          case 'memo':
            return <MemoScreen key={key} onBack={ctx.back} section={v.section} />;
          case 'quiz':
            return <QuizScreen key={key} onBack={ctx.back} />;
          case 'cas':
            return (
              <CasScreen
                key={key}
                onBack={ctx.back}
                onEssayer={(c) => {
                  enregistrer(c);
                  ctx.open({ k: 'fiche', id: c.id });
                  ctx.onToast('Cas pratique ouvert comme chantier : modifie-le librement.');
                }}
              />
            );
        }
      })}
    </>
  );
}
