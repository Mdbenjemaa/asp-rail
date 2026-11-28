/**
 * Fiche d'un chantier, en résumé : le résultat en haut, ce qui reste à régler, le dispositif, la préparation,
 * puis les réglages (chacun rouvre son étape). Partager et Carte restent sous le pouce.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '../components/Sheets';
import { Icon } from '../components/parts';
import { useRetour } from '../lib/back';
import { fmtLine, fmtPk } from '../lib/format';
import { ETAPES, jourTexte, resumeEtape, ROLES_CHAINE } from './etat';
import { alertesVitesse } from './voies';
import {
  calculChantier,
  newId,
  ROLE_LABEL,
  titreChantier,
  zoneTexte,
  type Agent,
  type Chantier,
  type RoleAgent,
} from './chantier';
import { CHECKLISTS, progression } from './checklists';
import type { Ctx, EtapeId } from './contexte';
import { AgentCard } from './Dispositif';
import { annonceurParSens, codesAgents, controlesDispositif, surveilleTexteCourt } from './dispositif';
import { AlertesDs, Annonce, CorrectionDfv, Ecran, Etat, Ligne, Section } from './kit';
import { useLigne } from './lignes';
import { FeuilleExportPdf } from './ExportPdf';
import { derouleVide } from './deroule';
import { compteRenduTexte, messageEnvoi, partagerTexte, resumeTexte, type Envoi } from './partage';
import { FeuilleFinie, SectionIntervention } from './Deroule';
import { LigneCloturer } from '../archive/Cloture';
import { useMaillonsLies } from '../chaine/lien';
import { loadLine } from '../lib/data';
import type { Resultat } from './rules';
import { chantierParId, definirActif, enregistrer, supprimer, useActif, useChantiers } from './store';
import { Champ, Nombre } from './ui';

const ETAPE_ICO: Record<EtapeId, string> = {
  lieu: 'pin',
  type: 'clock',
  voies: 'train',
  vitesses: 'speed',
  outillage: 'tool',
  degagement: 'clock',
  cas: 'sliders',
  resultat: 'check',
};

/** Feuille du bas qui se ferme aussi avec le retour du téléphone. */
export function Feuille(p: { title: string; onClose: () => void; children: ReactNode }) {
  useRetour(true, p.onClose);
  return (
    <Modal title={p.title} onClose={p.onClose}>
      <div className="ds-sheet-body">{p.children}</div>
    </Modal>
  );
}

type FeuilleOuverte =
  | { k: 'agent'; id: string }
  | { k: 'ajouter' }
  | { k: 'equipe' }
  | { k: 'partager' }
  | { k: 'pdf' }
  | { k: 'plus' }
  | { k: 'finie' }
  | { k: 'cr' }
  | null;

export function Fiche(p: { id: string; hidden?: boolean; ctx: Ctx; ouvrir?: 'compte-rendu' | 'fin' }) {
  const c = useChantiers().find((x) => x.id === p.id) ?? null;
  const actif = useActif();
  const r = useMemo(() => (c ? calculChantier(c) : null), [c]);
  const { doc } = useLigne(c?.ligne ?? null);
  const [feuille, setFeuille] = useState<FeuilleOuverte>(p.ouvrir === 'compte-rendu' ? { k: 'cr' } : p.ouvrir === 'fin' ? { k: 'finie' } : null);
  const [rappels, setRappels] = useState(false);
  const lies = useMaillonsLies();

  if (!c || !r) {
    return (
      <Ecran label="Chantier" title="Chantier introuvable" onBack={p.ctx.back} hidden={p.hidden}>
        <p className="ds-hint">Ce chantier a été supprimé.</p>
      </Ecran>
    );
  }
  const set = (patch: Partial<Chantier>) => {
    enregistrer({ ...c, ...patch });
  };
  const codes = codesAgents(c.agents);
  const controles = controlesDispositif(c, r);
  const alertes = [...r.dd.erreurs.map((texte) => ({ niveau: 'stop' as const, texte })), ...r.alertes, ...alertesVitesse(r, doc), ...controles];
  const importantes = alertes.filter((a) => a.niveau !== 'info');
  const infos = alertes.filter((a) => a.niveau === 'info');
  const autres = c.agents.filter((a) => a.role !== 'asp');
  const total = CHECKLISTS.reduce((s, l) => s + progression(c.checks, l)[1], 0);
  const coches = CHECKLISTS.reduce((s, l) => s + progression(c.checks, l)[0], 0);
  const surCarte = actif?.id === c.id;

  const envoi = (e: Envoi, quoi: string) =>
    p.ctx.onToast(
      e === 'partage'
        ? `${quoi} envoyé.`
        : e === 'telecharge'
          ? `${quoi} enregistré dans les téléchargements.`
          : e === 'copie'
            ? 'Partage indisponible ici : le résumé est copié, colle-le dans un message.'
            : 'Envoi annulé.',
    );
  const ajouter = (role: Exclude<RoleAgent, 'asp'>) => {
    const a: Agent = { id: newId(), role, nom: '', entreprise: c.entreprise, pk: null, surveille: [] };
    set({ agents: [...c.agents, a] });
    setFeuille({ k: 'agent', id: a.id });
  };
  const agentOuvert = feuille?.k === 'agent' ? (c.agents.find((a) => a.id === feuille.id) ?? null) : null;

  return (
    <Ecran
      label={`Fiche chantier · ${titreChantier(c)}`}
      hidden={p.hidden}
      onBack={p.ctx.back}
      title={
        <>
          {titreChantier(c)}
          <small>{c.ligne ? `Ligne ${fmtLine(c.ligne)} · ${zoneTexte(c)}` : zoneTexte(c)}</small>
        </>
      }
      right={
        <button className="ds-iconbtn" onClick={() => setFeuille({ k: 'plus' })} aria-label="Plus d’actions">
          <Icon name="dots" size={22} />
        </button>
      }
      actions={
        <>
          <button className="ds-btn" onClick={() => setFeuille({ k: 'partager' })}>
            <Icon name="share" size={20} />
            Partager
          </button>
          <button className="ds-btn primary" onClick={() => p.ctx.onShowMap(c)} disabled={!c.ligne || c.pkDebut === null} aria-label="Voir le chantier sur la carte">
            <Icon name="map" size={20} />
            Carte
          </button>
        </>
      }
    >
      <div className="ds-hero">
        <div className="ds-hero-top">
          <span className="ds-tag">
            {jourTexte(c.date)} · {c.horaire === 'nuit' ? 'de nuit' : 'de jour'}
          </span>
          <Etat c={c} r={r} />
        </div>
        <Annonce r={r} onGo={c.ligne ? (pk) => p.ctx.onGoPk(c.ligne!, pk) : undefined} manquePk={c.pkDebut === null} />
      </div>
      <AlertesDs list={importantes} />
      <CorrectionDfv c={c} r={r} set={set} />
      {infos.length > 0 && (
        <>
          <button className="ds-more" onClick={() => setRappels(!rappels)} aria-expanded={rappels}>
            <Icon name="info" size={20} />
            {rappels ? 'Masquer les rappels' : `${infos.length} rappel${infos.length > 1 ? 's' : ''} pour ce chantier`}
          </button>
          {rappels && <AlertesDs list={infos} />}
        </>
      )}

      <SectionIntervention
        c={c}
        r={r}
        changer={(deroule, fin) => {
          set({ deroule });
          if (fin) setFeuille({ k: 'finie' });
        }}
        onCompteRendu={() => setFeuille({ k: 'cr' })}
      />

      <Section title="Fin de mission">
        <LigneCloturer ctx={p.ctx} type="asp" id={c.id} />
      </Section>

      <Section
        title={`Dispositif · 1 + ${autres.length}`}
        action={
          <button className="ds-btn text" onClick={() => setFeuille({ k: 'ajouter' })}>
            <Icon name="plus" size={18} />
            Ajouter
          </button>
        }
      >
        {c.agents.map((a) => {
          const code = codes.get(a.id) ?? '';
          // Agent qui a pris ce poste dans ma chaîne (chantier partagé) : son nom et s'il est en place.
          const lie = lies.get(code);
          return (
            <Ligne
              key={a.id}
              badge={code}
              badgeClass={a.role === 'asp' ? 'navy' : a.role === 'annonceur' ? 'brand' : ''}
              title={`${ROLE_LABEL[a.role]}${a.nom ? ` · ${a.nom}` : lie?.nom ? ` · ${lie.nom}` : ''}`}
              sub={[
                a.pk !== null ? `PK ${fmtPk(a.pk)}` : a.role === 'asp' ? 'Au chantier' : 'Place à indiquer',
                surveilleTexteCourt(c, a),
                lie ? lie.donnees.etat : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              end={lie ? <span className={`ds-status ${lie.donnees.niveau === 'en-place' ? 'ok' : 'todo'}`}>{lie.donnees.niveau === 'en-place' ? 'En place' : lie.donnees.niveau === 'fini' ? 'Fini' : 'Pas en place'}</span> : undefined}
              onClick={() => setFeuille({ k: 'agent', id: a.id })}
              label={`${code} : ${ROLE_LABEL[a.role]}`}
            />
          );
        })}
        {!autres.length && r.voies.length > 0 && (
          <div className="ds-row">
            <button className="ds-btn primary wide" onClick={() => enregistrer(annonceurParSens(c, r))}>
              <Icon name="flag" size={20} />
              Placer un annonceur par sens
            </button>
          </div>
        )}
      </Section>

      <Section title="Préparation">
        <Ligne
          icon="list"
          title="Check-lists"
          sub={coches ? `${coches} cases cochées sur ${total}` : 'Documents, briefing, pendant et fin de chantier'}
          end={`${coches}/${total}`}
          endClass={coches === total ? 'ok' : ''}
          onClick={() => p.ctx.open({ k: 'checklists', id: c.id })}
        />
        <Ligne
          icon="people"
          title="Équipe et notes"
          sub={[c.entreprise, c.responsable && `Resp. ${c.responsable}`, c.effectif && `${c.effectif} agents`].filter(Boolean).join(' · ') || 'Nom du chantier, entreprise, responsable, notes'}
          onClick={() => setFeuille({ k: 'equipe' })}
        />
      </Section>

      <Section title="Réglages du chantier">
        {ETAPES.filter((e) => e.id !== 'resultat').map((e) => (
          <Ligne
            key={e.id}
            icon={ETAPE_ICO[e.id]}
            title={e.court}
            sub={resumeEtape(c, e.id)}
            onClick={() => p.ctx.open({ k: 'assistant', id: c.id, etape: e.id, seule: true })}
            label={`Modifier : ${e.court}`}
          />
        ))}
      </Section>
      <p className="ds-foot">
        Aide à la préparation, d’après le support TES M – compétence ASP. Le carnet CADA, l’AAn et les consignes locales priment. PK et vitesses
        viennent de données ouvertes : vérifie-les sur le terrain.
      </p>

      {agentOuvert && (
        <Feuille title={`${codes.get(agentOuvert.id) ?? ''} · ${ROLE_LABEL[agentOuvert.role]}`} onClose={() => setFeuille(null)}>
          <AgentCard
            a={agentOuvert}
            code={codes.get(agentOuvert.id) ?? ''}
            c={c}
            r={r}
            herePk={p.ctx.here && p.ctx.here.code === c.ligne ? p.ctx.here.pk : null}
            onChange={(a) => set({ agents: c.agents.map((x) => (x.id === a.id ? a : x)) })}
          />
          <button className="ds-btn primary wide" onClick={() => setFeuille(null)}>
            OK
          </button>
          {agentOuvert.role !== 'asp' && (
            <button
              className="ds-btn text danger"
              onClick={() => {
                set({ agents: c.agents.filter((x) => x.id !== agentOuvert.id) });
                setFeuille(null);
              }}
            >
              Retirer {codes.get(agentOuvert.id)} du dispositif
            </button>
          )}
        </Feuille>
      )}
      {feuille?.k === 'ajouter' && (
        <Feuille title="Ajouter au dispositif" onClose={() => setFeuille(null)}>
          {ROLES_CHAINE.map(([role, label]) => (
            <Ligne
              key={role}
              icon={role === 'annonceur' ? 'flag' : role === 'repetiteur' ? 'share' : 'people'}
              title={label}
              sub={
                role === 'annonceur'
                  ? 'Surveille l’arrivée des trains depuis le point d’annonce.'
                  : role === 'repetiteur'
                    ? 'Au droit du chantier, répercute l’annonce.'
                    : 'Relaie l’annonce sur un chantier étendu ou bruyant.'
              }
              onClick={() => ajouter(role)}
            />
          ))}
        </Feuille>
      )}
      {feuille?.k === 'equipe' && (
        <Feuille title="Équipe et notes" onClose={() => setFeuille(null)}>
          <Equipe c={c} set={set} />
          <button className="ds-btn primary wide" onClick={() => setFeuille(null)}>
            OK
          </button>
        </Feuille>
      )}
      {feuille?.k === 'pdf' && (
        <FeuilleExportPdf
          titre={`Fiche CADA · ${titreChantier(c)}`}
          docId={c.id}
          defautNom={c.asp}
          preparer={async () => {
            const [{ fichePdf }, ligne] = await Promise.all([import('./pdf'), c.ligne ? loadLine(c.ligne).catch(() => null) : Promise.resolve(null)]);
            return (info) => fichePdf(c, r, info, ligne);
          }}
          onClose={() => setFeuille(null)}
          onFini={(e) => {
            setFeuille(null);
            p.ctx.onToast(messageEnvoi(e));
          }}
        />
      )}
      {feuille?.k === 'finie' && (
        <FeuilleFinie
          c={c}
          r={r}
          onCloturer={() => {
            setFeuille(null);
            p.ctx.open({ k: 'cloture', type: 'asp', id: c.id });
          }}
          onClose={() => setFeuille(null)}
          onPdf={() => setFeuille({ k: 'cr' })}
          onTexte={() =>
            void partagerTexte(`Compte rendu · ${titreChantier(c)}`, compteRenduTexte(c, r)).then((e) => {
              envoi(e, 'Compte rendu');
              setFeuille(null);
            })
          }
        />
      )}
      {feuille?.k === 'cr' && (
        <FeuilleExportPdf
          titre={`Compte rendu · ${titreChantier(c)}`}
          docId={`${c.id}:cr`}
          defautNom={c.asp}
          second={{ titre: 'Responsable du chantier', defautNom: c.responsable }}
          intro={
            c.deroule.jalons.leve
              ? 'Compte rendu de l’intervention, créé sur le téléphone. Le responsable du chantier peut signer ici aussi.'
              : 'Le dispositif n’est pas encore levé : les heures manquantes resteront « non noté ».'
          }
          preparer={async () => {
            const [{ compteRenduPdf }, ligne] = await Promise.all([import('./pdf'), c.ligne ? loadLine(c.ligne).catch(() => null) : Promise.resolve(null)]);
            return (info) => {
              // Le nom du responsable tapé ici sert aussi à la fiche, s'il manquait.
              if (info.second?.nom && !c.responsable) set({ responsable: info.second.nom });
              return compteRenduPdf(chantierParId(c.id) ?? c, r, info, ligne);
            };
          }}
          onClose={() => setFeuille(null)}
          onFini={(e) => {
            setFeuille(null);
            p.ctx.onToast(messageEnvoi(e));
          }}
        />
      )}
      {feuille?.k === 'partager' && (
        <Feuille title="Partager" onClose={() => setFeuille(null)}>
          <Ligne icon="file" title="Fiche CADA en PDF" sub="Avec le plan de situation et ta signature" onClick={() => setFeuille({ k: 'pdf' })} />
          <Ligne
            icon="file"
            title="Compte rendu d’intervention en PDF"
            sub="Horaires, trains annoncés, incidents, signatures"
            onClick={() => setFeuille({ k: 'cr' })}
          />
          <Ligne
            icon="message"
            title="Résumé par message"
            sub="WhatsApp, SMS, mail…"
            onClick={() =>
              void partagerTexte(`Fiche CADA · ${titreChantier(c)}`, resumeTexte(c, r)).then((e) => {
                envoi(e, 'Résumé');
                setFeuille(null);
              })
            }
          />
          <p className="ds-hint">Une aide : le carnet CADA et l’AAn restent les documents officiels.</p>
        </Feuille>
      )}
      {feuille?.k === 'plus' && (
        <Feuille title={titreChantier(c)} onClose={() => setFeuille(null)}>
          <Ligne
            icon="map"
            title={surCarte ? 'Retirer de la carte' : 'Afficher sur la carte'}
            chevron={false}
            onClick={() => {
              definirActif(surCarte ? null : c.id);
              setFeuille(null);
            }}
          />
          <Ligne
            icon="copy"
            title="Dupliquer"
            sub="Pour un chantier qui ressemble à celui-ci"
            chevron={false}
            onClick={() => {
              const copie: Chantier = { ...structuredClone(c), id: newId(), created: Date.now(), nom: `${titreChantier(c)} (copie)`, checks: {}, deroule: derouleVide() };
              enregistrer(copie);
              setFeuille(null);
              p.ctx.replace({ k: 'fiche', id: copie.id });
              p.ctx.onToast('Chantier dupliqué.');
            }}
          />
          <Ligne
            icon="trash"
            title="Supprimer"
            chevron={false}
            onClick={() => {
              if (!window.confirm('Supprimer ce chantier du téléphone ?')) return;
              setFeuille(null);
              supprimer(c.id);
              p.ctx.back();
            }}
          />
        </Feuille>
      )}
    </Ecran>
  );
}

function Equipe({ c, set }: { c: Chantier; set: (patch: Partial<Chantier>) => void }) {
  return (
    <div className="ds-fields">
      <Champ label="Nom du chantier" value={c.nom} placeholder="Ex. : remplacement de traverses" onChange={(nom) => set({ nom })} />
      <Champ label="Entreprise" value={c.entreprise} onChange={(entreprise) => set({ entreprise, agents: c.agents.map((a) => (a.entreprise === c.entreprise ? { ...a, entreprise } : a)) })} />
      <Champ
        label="ASP"
        value={c.asp}
        placeholder="Ton nom"
        onChange={(asp) => set({ asp, agents: c.agents.map((a) => (a.role === 'asp' && (a.nom === c.asp || !a.nom) ? { ...a, nom: asp } : a)) })}
      />
      <Champ label="Responsable du chantier (RCE, chef de chantier)" value={c.responsable} onChange={(responsable) => set({ responsable })} />
      <Nombre label="Effectif travaux" value={c.effectif} placeholder="6" onChange={(effectif) => set({ effectif })} max={500} />
      <div className="asp-field">
        <label htmlFor="asp-notes">Notes</label>
        <textarea id="asp-notes" className="sig-comment" rows={3} value={c.notes} placeholder="Particularités locales, garages, accès…" onChange={(e) => set({ notes: e.target.value })} />
      </div>
    </div>
  );
}

/** Check-lists du chantier, cochées au fil de la préparation. */
export function Checklists(p: { id: string; hidden?: boolean; ctx: Ctx }) {
  const c = useChantiers().find((x) => x.id === p.id) ?? null;
  if (!c) return null;
  const set = (checks: Record<string, boolean>) => enregistrer({ ...c, checks });
  return (
    <Ecran
      label="Check-lists"
      hidden={p.hidden}
      onBack={p.ctx.back}
      title={
        <>
          Check-lists<small>{titreChantier(c)}</small>
        </>
      }
      actions={
        <button
          className="ds-btn"
          onClick={() => {
            if (window.confirm('Décocher toutes les cases de ce chantier ?')) set({});
          }}
        >
          Tout décocher
        </button>
      }
    >
      {CHECKLISTS.map((l) => {
        const [n, total] = progression(c.checks, l);
        return (
          <Section
            key={l.id}
            title={l.title}
            action={
              <span className={`asp-check-count ${n === total ? 'done' : ''}`} aria-label={`${n} sur ${total}`}>
                {n}/{total}
              </span>
            }
          >
            {l.items.map((i) => (
              <label key={i.id} className={`ds-row ds-check ${c.checks[i.id] ? 'on' : ''}`}>
                <input type="checkbox" checked={!!c.checks[i.id]} onChange={(e) => set({ ...c.checks, [i.id]: e.target.checked })} />
                <span className="ds-row-txt">
                  <b>{i.text}</b>
                  {i.hint && <small>{i.hint}</small>}
                </span>
              </label>
            ))}
          </Section>
        );
      })}
    </Ecran>
  );
}

/** Tous les chantiers gardés sur le téléphone. */
export function Chantiers(p: { hidden?: boolean; ctx: Ctx; onNew: () => void }) {
  const list = useChantiers();
  return (
    <Ecran
      label="Mes chantiers"
      hidden={p.hidden}
      onBack={p.ctx.back}
      title="Mes chantiers"
      actions={
        <button className="ds-btn primary big" onClick={p.onNew}>
          <Icon name="plus" size={22} />
          Nouveau chantier
        </button>
      }
    >
      {list.length ? <ListeChantiers list={list} ctx={p.ctx} /> : <p className="ds-hint">Aucun chantier pour le moment.</p>}
    </Ecran>
  );
}

export function ListeChantiers({ list, ctx }: { list: Chantier[]; ctx: Ctx }) {
  return (
    <div className="ds-list asp-chantiers">
      {list.map((c) => (
        <LigneChantier key={c.id} c={c} r={calculChantier(c)} onClick={() => ctx.open({ k: 'fiche', id: c.id })} />
      ))}
    </div>
  );
}

function LigneChantier({ c, r, onClick }: { c: Chantier; r: Resultat; onClick: () => void }) {
  return (
    <Ligne
      icon="vest"
      badgeClass="brand"
      title={titreChantier(c)}
      sub={`${jourTexte(c.date)}${c.ligne ? ` · Ligne ${fmtLine(c.ligne)}` : ''}${r.da !== null ? ` · ${r.da} s` : ''}`}
      end={<Etat c={c} r={r} />}
      onClick={onClick}
      label={`Ouvrir ${titreChantier(c)}`}
    />
  );
}

