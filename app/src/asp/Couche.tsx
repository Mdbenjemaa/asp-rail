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
import { useActivite } from './activite';
import { MEMO_PN } from '../pn/memo';
import { ControleDsh } from '../lam/ControleDsh';
import { MEMO_LAM } from '../lam/memo';
import { MissionLamScreen, MissionsLamScreen, TtxScreen } from '../lam/MissionLamScreen';
import { NouvelleMissionLam } from '../lam/NouvelleMissionLam';
import { EXERCICES_LAM } from '../lam/ordre';
import { Urgences } from '../lam/Urgences';
import { Diagnostic } from '../pn/Diagnostic';
import { MissionScreen, MissionsScreen, ProcedureScreen } from '../pn/MissionScreen';
import { NouvelleMission } from '../pn/NouvelleMission';
import { OrdreScreen } from '../pn/OrdreScreen';
import { PlanningScreen } from '../planning/Planning';

export function Couche(p: {
  tab: Onglet;
  pile: Vue[];
  ctx: Ctx;
  onNew: () => void;
  onNewMission: () => void;
  onNewMissionLam: () => void;
  onMenu: () => void;
  onWhere: () => void;
  onTab: (t: Onglet) => void;
}) {
  const { ctx } = p;
  const activite = useActivite();
  const top = p.pile.length - 1;
  return (
    <>
      {p.tab === 'accueil' && (
        <Accueil ctx={ctx} couvert={p.pile.length > 0} onNew={p.onNew} onNewMission={p.onNewMission} onNewMissionLam={p.onNewMissionLam} onMenu={p.onMenu} onWhere={p.onWhere} onTab={p.onTab} />
      )}
      {p.tab === 'calcul' && (activite === 'pn' ? <Diagnostic ctx={ctx} onglet /> : activite === 'lam' ? <Urgences ctx={ctx} onglet /> : <CalculRapide />)}
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
            return v.banque === 'pn' ? (
              <MemoScreen key={key} onBack={ctx.back} section={v.section} sections={MEMO_PN} titre="Mémo PN" />
            ) : v.banque === 'lam' ? (
              <MemoScreen key={key} onBack={ctx.back} section={v.section} sections={MEMO_LAM} titre="Mémo LAM / S9" />
            ) : (
              <MemoScreen key={key} onBack={ctx.back} section={v.section} />
            );
          case 'quiz':
            return <QuizScreen key={key} onBack={ctx.back} banque={v.banque ?? 'asp'} />;
          case 'pn-nouvelle':
            return <NouvelleMission key={key} id={v.id} etape={v.etape} seule={v.seule} hidden={hidden} ctx={ctx} />;
          case 'pn-mission':
            return <MissionScreen key={key} id={v.id} hidden={hidden} ctx={ctx} />;
          case 'pn-procedure':
            return <ProcedureScreen key={key} id={v.id} type={v.type} hidden={hidden} ctx={ctx} />;
          case 'pn-diagnostic':
            return <Diagnostic key={key} ctx={ctx} missionId={v.id} hidden={hidden} />;
          case 'pn-ordre':
            return <OrdreScreen key={key} ctx={ctx} hidden={hidden} />;
          case 'pn-missions':
            return <MissionsScreen key={key} hidden={hidden} ctx={ctx} onNew={p.onNewMission} />;
          case 'lam-nouvelle':
            return <NouvelleMissionLam key={key} id={v.id} etape={v.etape} seule={v.seule} hidden={hidden} ctx={ctx} />;
          case 'lam-mission':
            return <MissionLamScreen key={key} id={v.id} hidden={hidden} ctx={ctx} />;
          case 'lam-ttx':
            return <TtxScreen key={key} id={v.id} hidden={hidden} ctx={ctx} />;
          case 'lam-urgences':
            return <Urgences key={key} ctx={ctx} missionId={v.id} hidden={hidden} />;
          case 'lam-ordre':
            return <OrdreScreen key={key} ctx={ctx} hidden={hidden} exercices={EXERCICES_LAM} titre="Cas pratiques LAM / S9" source="le livret technique AP-LAM / AP-S9" />;
          case 'lam-missions':
            return <MissionsLamScreen key={key} hidden={hidden} ctx={ctx} onNew={p.onNewMissionLam} />;
          case 'lam-dsh':
            return <ControleDsh key={key} ctx={ctx} hidden={hidden} />;
          case 'planning':
            return <PlanningScreen key={key} ctx={ctx} hidden={hidden} />;
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
