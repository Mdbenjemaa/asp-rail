/** Onglet « Dispositif » : l'ASP, les annonceurs, répétiteurs et sentinelles, leur place et ce qu'ils surveillent. */
import { fmtDist, fmtPk } from '../lib/format';
import { cleSens, effectifAnnonce, newId, ROLE_LABEL, SENS_FLECHE, type Agent, type Chantier, type RoleAgent } from './chantier';
import { codesAgents, controlesDispositif, visibilites } from './dispositif';
import type { Resultat } from './rules';
import { Alertes, Bloc, Champ, Choix, PkInput } from './ui';

const ROLES_CHAINE: [Exclude<RoleAgent, 'asp'>, string][] = [
  ['annonceur', 'Annonceur'],
  ['repetiteur', 'Répétiteur'],
  ['sentinelle', 'Sentinelle'],
];

function AgentCard(p: {
  a: Agent;
  code: string;
  c: Chantier;
  r: Resultat;
  herePk: number | null;
  onChange: (a: Agent) => void;
  onRemove: () => void;
}) {
  const { a, r } = p;
  const vis = visibilites(p.c, r).filter((v) => v.agentId === a.id);
  const toggle = (k: string) => p.onChange({ ...a, surveille: a.surveille.includes(k) ? a.surveille.filter((x) => x !== k) : [...a.surveille, k] });
  const premierPa = r.voies.find((v) => a.surveille.includes(cleSens(v.voieId, v.sens)) && v.pointAnnonce !== null);
  return (
    <div className={`asp-agent role-${a.role}`}>
      <div className="asp-agent-top">
        <span className={`asp-code role-${a.role}`}>{p.code}</span>
        {a.role === 'asp' ? (
          <b className="asp-agent-role">Agent sécurité du personnel</b>
        ) : (
          <Choix small label={`Rôle de ${p.code}`} value={a.role} options={ROLES_CHAINE} onChange={(role) => p.onChange({ ...a, role, surveille: role === 'repetiteur' ? [] : a.surveille })} />
        )}
        {a.role !== 'asp' && (
          <button className="icon-btn asp-x" onClick={p.onRemove} aria-label={`Retirer ${p.code}`}>
            ×
          </button>
        )}
      </div>
      <Champ label="Nom" value={a.nom} onChange={(nom) => p.onChange({ ...a, nom })} placeholder="Nom de l’agent" />
      {a.role !== 'asp' && <Champ label="Entreprise" value={a.entreprise} onChange={(entreprise) => p.onChange({ ...a, entreprise })} />}
      <PkInput label="Position" value={a.pk} onChange={(pk) => p.onChange({ ...a, pk })} />
      <div className="asp-agent-pos">
        <button className="btn btn-small" disabled={p.herePk === null} onClick={() => p.herePk !== null && p.onChange({ ...a, pk: Math.round(p.herePk * 1000) / 1000 })}>
          Ma position
        </button>
        {premierPa && (
          <button className="btn btn-small" onClick={() => p.onChange({ ...a, pk: premierPa.pointAnnonce })}>
            Au point d’annonce {premierPa.voie} {SENS_FLECHE[premierPa.sens]}
          </button>
        )}
      </div>
      {a.role !== 'repetiteur' && r.voies.length > 0 && (
        <>
          <div className="asp-mini-label">{a.role === 'asp' ? 'Surveille lui-même' : 'Surveille'}</div>
          <div className="chips">
            {r.voies.map((v) => {
              const k = cleSens(v.voieId, v.sens);
              return (
                <button key={k} className={`chip ${a.surveille.includes(k) ? 'on' : ''}`} aria-pressed={a.surveille.includes(k)} onClick={() => toggle(k)}>
                  {v.voie} {SENS_FLECHE[v.sens]}
                </button>
              );
            })}
          </div>
        </>
      )}
      {a.role === 'repetiteur' && <p className="asp-hint">Placé au droit du chantier, il répercute l’annonce : il doit percevoir le signal de l’annonceur précédent.</p>}
      {vis.map((v) => (
        <p key={v.cle} className="asp-vis">
          {v.auDela
            ? `Au-delà du point d’annonce de ${v.voie} ${SENS_FLECHE[v.sens]} (PK ${fmtPk(v.pointAnnonce)}).`
            : `Doit voir jusqu’au PK ${fmtPk(v.pointAnnonce)} (${v.voie} ${SENS_FLECHE[v.sens]}) : ${fmtDist(v.aVoir ?? 0)}.`}
        </p>
      ))}
    </div>
  );
}

export function TabDispositif(p: { c: Chantier; r: Resultat; herePk: number | null; set: (patch: Partial<Chantier>) => void }) {
  const { c, r, set } = p;
  const codes = codesAgents(c.agents);
  const setAgent = (a: Agent) => set({ agents: c.agents.map((x) => (x.id === a.id ? a : x)) });
  const ajouter = (role: Exclude<RoleAgent, 'asp'>) =>
    set({ agents: [...c.agents, { id: newId(), role, nom: '', entreprise: c.entreprise, pk: null, surveille: [] }] });

  /** Un annonceur par sens de circulation, qui surveille toutes les voies de ce sens. */
  const proposer = () => {
    const autres = c.agents.filter((a) => a.role !== 'asp');
    if (autres.length && !window.confirm('Remplacer les annonceurs, répétiteurs et sentinelles par un annonceur par sens ?')) return;
    const asp = c.agents.filter((a) => a.role === 'asp').map((a) => ({ ...a, surveille: [] }));
    const sensPresents = (['croissant', 'decroissant'] as const).filter((s) => r.voies.some((v) => v.sens === s));
    const annonceurs: Agent[] = sensPresents.map((s) => {
      const vs = r.voies.filter((v) => v.sens === s);
      const pa = vs.find((v) => v.pointAnnonce !== null)?.pointAnnonce ?? null;
      return { id: newId(), role: 'annonceur', nom: '', entreprise: c.entreprise, pk: pa, surveille: vs.map((v) => cleSens(v.voieId, v.sens)) };
    });
    set({ agents: [...asp, ...annonceurs], p: { ...c.p, annonceur2Sens: false } });
  };

  return (
    <>
      <Bloc title={`Dispositif d’annonce · ${effectifAnnonce(c)}`}>
        <p className="muted small">
          Chaque voie annoncée, dans chaque sens, doit être surveillée. Place les annonceurs hors ZD, de préférence côté garage, visibles de toi,
          avec la visibilité jusqu’au point d’annonce et un signal audible au chantier.
        </p>
        <button className="btn primary wide" onClick={proposer} disabled={!r.voies.length}>
          Proposer un annonceur par sens
        </button>
      </Bloc>
      {c.agents.map((a) => (
        <AgentCard key={a.id} a={a} code={codes.get(a.id) ?? ''} c={c} r={r} herePk={p.herePk} onChange={setAgent} onRemove={() => set({ agents: c.agents.filter((x) => x.id !== a.id) })} />
      ))}
      <div className="asp-add-row">
        {ROLES_CHAINE.map(([role, label]) => (
          <button key={role} className="btn" onClick={() => ajouter(role)}>
            + {label}
          </button>
        ))}
      </div>
      <Bloc title="Contrôles" id="asp-controles">
        <Alertes list={controlesDispositif(c, r)} />
        {!controlesDispositif(c, r).length && <p className="ok small">Rien à signaler.</p>}
      </Bloc>
      <Bloc title="Rappels de placement">
        <ul className="asp-list">
          <li>
            <b>Annonceur :</b> visibilité jusqu’au point d’annonce pour chaque voie et chaque sens, signal audible au chantier, visible de l’ASP,
            hors ZD de préférence côté garage.
          </li>
          <li>
            <b>Chaîne d’annonceurs</b> (chantier étendu ou bruyant) : des répétiteurs au droit du chantier répercutent l’annonce ; chacun perçoit
            le signal du précédent.
          </li>
          <li>
            <b>Sentinelles :</b> deux sentinelles qui se suivent, et la plus proche du chantier avec l’annonceur, s’aperçoivent et perçoivent le
            signal à tout moment. Chantier bruyant : coup de trompe + drapeau blanc déployé non agité de jour, bâton lumineux la nuit.
          </li>
          <li>
            <b>Même entreprise</b> pour tous les maillons d’une chaîne d’annonce.
          </li>
          <li>
            <b>Bruit :</b> outillage bruyant → avertisseur à grande puissance (Gérard ou Saint-Dizier) à moins de 5 m des agents. Seul l’annonceur
            peut porter un EPICB actif homologué.
          </li>
          <li>
            <b>L’ASP annonceur :</b> dégagé de tout autre travail, autorisé nominativement par le dirigeant local, petite équipe de 3 agents au plus
            groupés, chantier fixe. Jamais sur un chantier mobile.
          </li>
        </ul>
        <p className="muted small">Exemple de chaîne : dans « Mémo », chapitre « Placer le dispositif ».</p>
      </Bloc>
      <p className="muted small asp-legend">
        Codes : {Object.entries(ROLE_LABEL).map(([k, l]) => `${k === 'asp' ? 'ASP' : k === 'annonceur' ? 'A' : k === 'repetiteur' ? 'R' : 'S'} = ${l.toLowerCase()}`).join(', ')}.
      </p>
    </>
  );
}
