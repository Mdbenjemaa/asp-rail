/**
 * Mission PN en cours : l'étape suivante en grand avec un bouton « Fait » (l'heure est notée), les passages de
 * mobiles travaux et de LAM pendant les travaux, toutes les étapes par phase, et le journal à partager.
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import { useHorloge } from './horloge';
import { fmtLine, fmtPk } from '../lib/format';
import type { Ctx } from '../asp/contexte';
import { Feuille } from '../asp/Fiche';
import { Ecran, Ligne, Section } from '../asp/kit';
import { FeuilleExportPdf } from '../asp/ExportPdf';
import { messageEnvoi, partagerTexte } from '../asp/partage';
import { loadLine } from '../lib/data';
import {
  ajouterNote,
  avancement,
  cocher,
  cocherGeste,
  demarrerProcedure,
  enregistrerMission,
  heure,
  journalTexte,
  missionParId,
  phases,
  procedure,
  PROCEDURE_TITRE,
  ROLE_PN,
  supprimerMission,
  terminerProcedure,
  titreMission,
  TYPE_PN,
  useMissions,
  type Etape,
  type Mission,
  type Procedure,
} from './mission';

const duree = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
};

export function MissionScreen(p: { id: string; hidden?: boolean; ctx: Ctx }) {
  const m = useMissions().find((x) => x.id === p.id) ?? null;
  const [note, setNote] = useState('');
  const [feuille, setFeuille] = useState<null | 'plus' | 'note' | 'pdf'>(null);
  const [texteNote, setTexteNote] = useState('');
  const now = useHorloge();
  if (!m) {
    return (
      <Ecran label="Mission PN" title="Mission introuvable" onBack={p.ctx.back} hidden={p.hidden}>
        <p className="ds-hint">Cette mission a été supprimée.</p>
      </Ecran>
    );
  }
  const save = (next: Mission) => enregistrerMission(next);
  const av = avancement(m);
  const debut = m.journal.length ? Math.min(...m.journal.map((e) => e.t)) : null;
  const reprise = m.faits['photo'] ?? m.faits['debut-surv'] ?? null;
  const faire = (e: Etape, fait = true) => {
    save(cocher(m, e, fait, fait ? note.trim() : undefined));
    setNote('');
  };
  const ouvrirProcedure = (type: Procedure) => {
    save(demarrerProcedure(m, type));
    p.ctx.open({ k: 'pn-procedure', id: m.id, type });
  };
  const partager = () =>
    void partagerTexte(`Journal · ${titreMission(m)}`, journalTexte(m)).then((r) =>
      p.ctx.onToast(r === 'partage' ? 'Journal envoyé.' : r === 'copie' ? 'Journal copié : colle-le dans un message.' : 'Envoi annulé.'),
    );
  const prochaine = av.prochaine;

  return (
    <Ecran
      label={`Mission PN · ${titreMission(m)}`}
      hidden={p.hidden}
      onBack={p.ctx.back}
      title={
        <>
          {titreMission(m)}
          <small>
            {ROLE_PN[m.role]}
            {m.pn.lieu ? ` · ${m.pn.lieu}` : ''}
          </small>
        </>
      }
      right={
        <button className="ds-iconbtn" onClick={() => setFeuille('plus')} aria-label="Plus d’actions">
          <Icon name="dots" size={22} />
        </button>
      }
      actions={
        <>
          <button className="ds-btn" onClick={() => setFeuille('pdf')}>
            <Icon name="share" size={20} />
            Journal
          </button>
          <button className="ds-btn danger-tonal" onClick={() => p.ctx.open({ k: 'pn-diagnostic', id: m.id })}>
            <Icon name="alert" size={20} />
            Dérangement
          </button>
        </>
      }
    >
      <section className="ds-hero" aria-label="Où en est la mission">
        <div className="ds-hero-top">
          <span className="ds-tag">
            {m.fin ? `Terminée à ${heure(m.fin)}` : debut ? `En cours depuis ${duree(now - debut)}` : 'Pas commencée'}
            {m.pn.type ? ` · ${TYPE_PN[m.pn.type]}` : ''}
          </span>
          <span className={`ds-status ${m.fin ? 'ok' : 'todo'}`}>
            {av.faites}/{av.total}
          </span>
        </div>
        <div className="ds-meter" aria-hidden="true">
          <i style={{ width: `${(av.faites / Math.max(1, av.total)) * 100}%` }} />
        </div>
        {av.pendant && (
          <div className="ds-pendant">
            <p className="ds-pendant-titre">
              PN repris en travaux{reprise ? ` depuis ${heure(reprise)}` : ''}
              {m.passages || m.lam ? ` · ${m.passages} mobile${m.passages > 1 ? 's' : ''}, ${m.lam} LAM` : ''}
            </p>
            {m.enCours && (
              <button className="ds-btn primary wide" onClick={() => p.ctx.open({ k: 'pn-procedure', id: m.id, type: m.enCours!.type })}>
                Reprendre : {PROCEDURE_TITRE[m.enCours.type].toLowerCase()}
              </button>
            )}
            <div className="ds-pendant-btns">
              <button className="ds-btn big" onClick={() => ouvrirProcedure('mobile')}>
                <Icon name="arrow" size={22} />
                Un mobile travaux arrive
              </button>
              <button className="ds-btn big" onClick={() => ouvrirProcedure('lam')}>
                <Icon name="tool" size={22} />
                Mettre en voie un LAM
              </button>
            </div>
          </div>
        )}
        {prochaine ? (
          <div className={`ds-next ${av.pendant ? 'quiet' : ''}`}>
            <span className="ds-tag">
              {av.pendant ? 'Quand les travaux sont finis' : 'À faire maintenant'} · {prochaine.phase.titre}
            </span>
            <h2 className="ds-next-texte">{prochaine.texte}</h2>
            {prochaine.aide && <p className="ds-next-aide">{prochaine.aide}</p>}
            {prochaine.depeche && (
              <div className="ds-fields" style={{ margin: '12px 0 0' }}>
                <div className="asp-field">
                  <label htmlFor="pn-depeche">N° de dépêche (facultatif)</label>
                  <input id="pn-depeche" className="asp-input" value={note} inputMode="numeric" onChange={(e) => setNote(e.target.value)} />
                </div>
              </div>
            )}
            <button className={`ds-btn ${av.pendant ? 'dark' : 'primary'} big wide`} style={{ marginTop: 14 }} onClick={() => faire(prochaine)}>
              <Icon name="check" size={22} />
              Fait à {heure(now)}
            </button>
          </div>
        ) : (
          <div className="ds-next">
            <h2 className="ds-next-texte">Mission terminée</h2>
            <p className="ds-next-aide">Partage le journal ou recopie-le dans le carnet du PN.</p>
          </div>
        )}
      </section>

      {phases(m).map((ph) => (
        <Section key={ph.id} title={`${ph.titre}${ph.lieu ? ` · ${ph.lieu}` : ''}`}>
          {ph.etapes.map((e) => {
            const t = m.faits[e.id];
            return (
              <label key={e.id} className={`ds-row ds-check ${t ? 'on' : ''}`}>
                <input type="checkbox" checked={!!t} onChange={(ev) => faire(e, ev.target.checked)} />
                <span className="ds-row-txt">
                  <b>{e.texte}</b>
                  {(t || e.facultative) && (
                    <small>
                      {t ? `Fait à ${heure(t)}` : ''}
                      {m.depeches[e.id] ? ` · dépêche ${m.depeches[e.id]}` : ''}
                      {!t && e.facultative ? 'Seulement si besoin' : ''}
                    </small>
                  )}
                </span>
              </label>
            );
          })}
        </Section>
      ))}

      <Section
        title={`Journal · ${m.journal.length}`}
        action={
          <button className="ds-btn text" onClick={() => setFeuille('note')}>
            <Icon name="plus" size={18} />
            Note
          </button>
        }
      >
        {m.journal.length ? (
          [...m.journal]
            .sort((a, b) => b.t - a.t)
            .map((e) => (
              <div key={e.id} className="ds-row ds-journal">
                <span className="ds-journal-h">{heure(e.t)}</span>
                <span className="ds-row-txt">
                  <b>{e.texte}</b>
                  {e.note && <small>{e.type === 'etape' ? `Dépêche ${e.note}` : e.note}</small>}
                </span>
              </div>
            ))
        ) : (
          <div className="ds-row">
            <span className="ds-row-txt">
              <small>Chaque étape faite s’inscrit ici avec son heure.</small>
            </span>
          </div>
        )}
      </Section>

      <Section title="Le PN et le chantier">
        <Ligne
          icon="tracks"
          title={titreMission(m)}
          sub={[m.pn.pk !== null ? `PK ${fmtPk(m.pn.pk)}` : null, m.pn.ligne ? `ligne ${fmtLine(m.pn.ligne)}` : null, m.pn.lieu || null].filter(Boolean).join(' · ') || 'À indiquer'}
          onClick={() => p.ctx.open({ k: 'pn-nouvelle', id: m.id, etape: 'pn', seule: true })}
        />
        <Ligne
          icon="sliders"
          title="Équipement"
          sub={[m.pn.type ? TYPE_PN[m.pn.type] : null, m.pn.commande === 'boitier' ? 'boîtier de commutateurs' : 'Marche-Arrêt', m.pn.bal ? 'BAL' : null, m.pn.voies === 'double' ? 'double voie' : 'voie unique'].filter(Boolean).join(' · ')}
          onClick={() => p.ctx.open({ k: 'pn-nouvelle', id: m.id, etape: 'equipement', seule: true })}
        />
        <Ligne
          icon="people"
          title="Chantier"
          sub={[m.contrat && `contrat ${m.contrat}`, m.indice && `indice ${m.indice}`, m.cch && `CCh ${m.cch}`, m.rptx && `RPTx ${m.rptx}`].filter(Boolean).join(' · ') || 'Contrat, indice, CCh, RPTx'}
          onClick={() => p.ctx.open({ k: 'pn-nouvelle', id: m.id, etape: 'chantier', seule: true })}
        />
        <Ligne icon="clock" title="Rôle" sub={ROLE_PN[m.role]} onClick={() => p.ctx.open({ k: 'pn-nouvelle', id: m.id, etape: 'role', seule: true })} />
      </Section>
      <p className="ds-foot">Aide à la mission, d’après le support TES F : la fiche de travail, la consigne PN et le livret de service priment. Le carnet du PN et les dépêches font foi.</p>

      {feuille === 'pdf' && (
        <FeuilleExportPdf
          titre={`Journal · ${titreMission(m)}`}
          docId={m.id}
          preparer={async () => {
            const [{ journalPnPdf }, ligne] = await Promise.all([import('./pdf'), m.pn.ligne ? loadLine(m.pn.ligne).catch(() => null) : Promise.resolve(null)]);
            return (info) => journalPnPdf(missionParId(m.id) ?? m, info, ligne);
          }}
          onClose={() => setFeuille(null)}
          onFini={(e) => {
            setFeuille(null);
            p.ctx.onToast(messageEnvoi(e));
          }}
        />
      )}
      {feuille === 'note' && (
        <Feuille title="Ajouter une note au journal" onClose={() => setFeuille(null)}>
          <div className="asp-field">
            <label htmlFor="pn-note">Note</label>
            <textarea id="pn-note" className="sig-comment" rows={3} value={texteNote} placeholder="Ex. : usager arrêté, appel du CCh…" onChange={(e) => setTexteNote(e.target.value)} />
          </div>
          <button
            className="ds-btn primary wide"
            disabled={!texteNote.trim()}
            onClick={() => {
              save(ajouterNote(m, texteNote.trim()));
              setTexteNote('');
              setFeuille(null);
            }}
          >
            Ajouter à {heure(now)}
          </button>
        </Feuille>
      )}
      {feuille === 'plus' && (
        <Feuille title={titreMission(m)} onClose={() => setFeuille(null)}>
          {m.pn.ligne && m.pn.pk !== null && (
            <Ligne
              icon="map"
              title="Voir le PN sur la carte"
              chevron={false}
              onClick={() => {
                setFeuille(null);
                p.ctx.onGoPk(m.pn.ligne!, m.pn.pk!);
              }}
            />
          )}
          <Ligne
            icon="file"
            title="Journal en PDF"
            chevron={false}
            onClick={() => setFeuille('pdf')}
          />
          <Ligne
            icon="message"
            title="Journal en texte, par message"
            chevron={false}
            onClick={() => {
              setFeuille(null);
              partager();
            }}
          />
          <Ligne
            icon="trash"
            title="Supprimer la mission"
            chevron={false}
            onClick={() => {
              if (!window.confirm('Supprimer cette mission et son journal du téléphone ?')) return;
              setFeuille(null);
              supprimerMission(m.id);
              p.ctx.back();
            }}
          />
        </Feuille>
      )}
    </Ecran>
  );
}

/** Arrivée d'un mobile travaux ou mise en voie d'un LAM : la suite des gestes, cochés un par un. */
export function ProcedureScreen(p: { id: string; type: Procedure; hidden?: boolean; ctx: Ctx }) {
  const m = useMissions().find((x) => x.id === p.id) ?? null;
  if (!m) return null;
  const etapes = procedure(m, p.type);
  const ec = m.enCours?.type === p.type ? m.enCours : { type: p.type, debut: m.updated, faits: {} as Record<string, number> };
  const prochaine = etapes.find((e) => !ec.faits[e.id] && !e.facultative) ?? null;
  const fini = !prochaine;
  const n = (p.type === 'mobile' ? m.passages : m.lam) + 1;
  const terminer = () => {
    const r = terminerProcedure(m, p.type);
    enregistrerMission(r.m);
    p.ctx.back();
    p.ctx.onToast(`${r.texte} : noté au journal.`);
  };
  return (
    <Ecran
      label={PROCEDURE_TITRE[p.type]}
      hidden={p.hidden}
      onBack={p.ctx.back}
      backIcon="close"
      title={
        <>
          {PROCEDURE_TITRE[p.type]} · n° {n}
          <small>{titreMission(m)}</small>
        </>
      }
      actionsCol
      actions={
        <>
          <button className="ds-btn primary big" disabled={!fini} onClick={terminer}>
            {fini ? `Terminé : noter au journal` : `Encore ${etapes.filter((e) => !ec.faits[e.id] && !e.facultative).length} étape(s)`}
          </button>
          <button
            className="ds-btn text"
            onClick={() => {
              enregistrerMission({ ...m, enCours: null });
              p.ctx.back();
            }}
          >
            Annuler ce passage
          </button>
        </>
      }
    >
      <p className="ds-q-help">Touche chaque geste quand il est fait. La consigne PN et la fiche de travail priment.</p>
      <div className="ds-list">
        {etapes.map((e, k) => {
          const t = ec.faits[e.id];
          const actuelle = prochaine?.id === e.id;
          return (
            <label key={e.id} className={`ds-row ds-check ds-step ${t ? 'on' : ''} ${actuelle ? 'now' : ''}`}>
              <span className="ds-step-n" aria-hidden="true">
                {t ? <Icon name="check" size={16} /> : k + 1}
              </span>
              <input
                type="checkbox"
                checked={!!t}
                onChange={(ev) => enregistrerMission(cocherGeste(m, p.type, e.id, ev.target.checked))}
              />
              <span className="ds-row-txt">
                <b>{e.texte}</b>
                {(e.aide || t || e.facultative) && (
                  <small>
                    {t ? `Fait à ${heure(t)}` : e.facultative ? 'Seulement si besoin' : ''}
                    {e.aide ? `${t || e.facultative ? ' · ' : ''}${e.aide}` : ''}
                  </small>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </Ecran>
  );
}

/** Toutes les missions PN gardées sur le téléphone. */
export function MissionsScreen(p: { hidden?: boolean; ctx: Ctx; onNew: () => void }) {
  const list = useMissions();
  return (
    <Ecran
      label="Mes missions PN"
      hidden={p.hidden}
      onBack={p.ctx.back}
      title="Mes missions PN"
      actions={
        <button className="ds-btn primary big" onClick={p.onNew}>
          <Icon name="plus" size={22} />
          Nouvelle mission PN
        </button>
      }
    >
      {list.length ? <ListeMissions list={list} ctx={p.ctx} /> : <p className="ds-hint">Aucune mission pour le moment.</p>}
    </Ecran>
  );
}

export function ListeMissions({ list, ctx }: { list: Mission[]; ctx: Ctx }) {
  return (
    <div className="ds-list pn-missions">
      {list.map((m) => {
        const av = avancement(m);
        return (
          <Ligne
            key={m.id}
            icon="tracks"
            badgeClass="brand"
            title={titreMission(m)}
            sub={`${m.date.split('-').reverse().join('/')} · ${ROLE_PN[m.role]}`}
            end={<span className={`ds-status ${m.fin ? 'ok' : 'todo'}`}>{m.fin ? 'Terminée' : `${av.faites}/${av.total}`}</span>}
            onClick={() => ctx.open({ k: 'pn-mission', id: m.id })}
            label={`Ouvrir ${titreMission(m)}`}
          />
        );
      })}
    </div>
  );
}
