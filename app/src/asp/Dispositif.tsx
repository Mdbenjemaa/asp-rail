/** Un agent du dispositif (ASP, annonceur, répétiteur, sentinelle) : sa place et ce qu'il surveille. */
import { fmtDist, fmtPk } from '../lib/format';
import { cleSens, SENS_FLECHE, type Agent, type Chantier } from './chantier';
import { ROLES_CHAINE } from './etat';
import { visibilites } from './dispositif';
import type { Resultat } from './rules';
import { Champ, Choix, PkInput } from './ui';

export function AgentCard(p: {
  a: Agent;
  code: string;
  c: Chantier;
  r: Resultat;
  herePk: number | null;
  onChange: (a: Agent) => void;
  /** Bouton « × » pour retirer l'agent (sinon, l'écran qui l'affiche s'en charge). */
  onRemove?: () => void;
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
        {a.role !== 'asp' && p.onRemove && (
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
