/**
 * Mission AP LAM ou AP S9 en cours : l'étape à faire en grand (« Fait à 14:32 », ou la dépêche à noter avec ses
 * numéros), pendant le travail les situations du LAM ou le passage d'un train travaux, le carnet de dépêches et le journal.
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import { fmtLine, fmtPk } from '../lib/format';
import type { Ctx } from '../asp/contexte';
import { Feuille } from '../asp/Fiche';
import { Ecran, Ligne, Section } from '../asp/kit';
import { FeuilleExportPdf } from '../asp/ExportPdf';
import { messageEnvoi, partagerTexte } from '../asp/partage';
import { loadLine } from '../lib/data';
import { useHorloge } from '../pn/horloge';
import { FeuilleDepeche } from './Depeche';
import {
  ajouterEvenement,
  avancementLam,
  cocherGesteTtx,
  cocherLam,
  demarrerTtx,
  depecheTtx,
  enregistrerMissionLam,
  heure,
  journalTexteLam,
  missionLamParId,
  noterDepeche,
  numerosUtilises,
  OUTIL_S9,
  passageTtx,
  phasesLam,
  supprimerMissionLam,
  terminerTtx,
  titreMissionLam,
  ttxPossible,
  TYPE_MISSION,
  useMissionsLam,
  type EtapeLam,
  type Interlocuteur,
  type MissionLam,
} from './mission';

const duree = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
};

/** Situations du LAM pendant le déplacement et le travail : la règle, et une ligne au journal. */
const SITUATIONS: { id: string; titre: string; icon: 'flag' | 'arrow' | 'tracks' | 'people'; regle: string; journal: string }[] = [
  {
    id: 'sam',
    titre: 'Un SAM à franchir',
    icon: 'flag',
    regle: 'Arrête le LAM et appelle le CCh pour le faire retirer. Jamais de ta propre initiative. SAM de repérage d’une autre activité : après entente avec l’agent d’activité ou l’agent PN, si c’est autorisé.',
    journal: 'SAM à franchir : LAM arrêté, CCh appelé',
  },
  {
    id: 'aiguille',
    titre: 'Un appareil de voie',
    icon: 'arrow',
    regle: 'Mets-toi en tête. Vérifie la position et le collage des aiguilles (et le cœur à pointe mobile). Doute : arrêt et appel au CCh. À manœuvrer : demande verbale au CCh, attends son autorisation. Talonnage interdit.',
    journal: 'Appareil de voie vérifié avant franchissement',
  },
  {
    id: 'pn',
    titre: 'Un PN à traverser',
    icon: 'tracks',
    regle: 'Applique les mesures de la consigne LAM ou de la fiche de travail : suis l’agent PN dédié, ou interviens si la consigne t’y autorise, sinon appelle le CCh. Jamais de fermeture par la zone courte avec un LAM.',
    journal: 'Traversée d’un PN selon la consigne LAM',
  },
  {
    id: 'personnel',
    titre: 'Du personnel doit traverser',
    icon: 'people',
    regle: 'Demande et obtiens l’arrêt du LAM avant toute traversée de sa zone d’évolution. Casque obligatoire dans la zone d’évolution.',
    journal: 'Arrêt du LAM pour la traversée du personnel',
  },
];

type FeuilleOuverte = null | 'plus' | 'note' | 'pdf' | { k: 'depeche'; etape?: EtapeLam } | { k: 'situation'; id: string };

export function MissionLamScreen(p: { id: string; hidden?: boolean; ctx: Ctx }) {
  const m = useMissionsLam().find((x) => x.id === p.id) ?? null;
  const [feuille, setFeuille] = useState<FeuilleOuverte>(null);
  const [texteNote, setTexteNote] = useState('');
  const now = useHorloge();
  if (!m) {
    return (
      <Ecran label="Mission LAM / S9" title="Mission introuvable" onBack={p.ctx.back} hidden={p.hidden}>
        <p className="ds-hint">Cette mission a été supprimée.</p>
      </Ecran>
    );
  }
  const save = (next: MissionLam) => enregistrerMissionLam(next);
  const av = avancementLam(m);
  const debut = m.journal.length ? Math.min(...m.journal.map((e) => e.t)) : null;
  const avecDefaut: Interlocuteur = m.depeches.at(-1)?.avec ?? (m.type === 's9' ? 'RPTx' : 'CCh');
  const faire = (e: EtapeLam, fait = true) => {
    if (fait && e.depeche) setFeuille({ k: 'depeche', etape: e });
    else save(cocherLam(m, e, fait));
  };
  const partager = () =>
    void partagerTexte(`Journal · ${titreMissionLam(m)}`, journalTexteLam(m)).then((r) =>
      p.ctx.onToast(r === 'partage' ? 'Journal envoyé.' : r === 'copie' ? 'Journal copié : colle-le dans un message.' : 'Envoi annulé.'),
    );
  const prochaine = av.prochaine;
  const situation = feuille && typeof feuille === 'object' && feuille.k === 'situation' ? SITUATIONS.find((s) => s.id === feuille.id) : null;

  return (
    <Ecran
      label={`Mission · ${titreMissionLam(m)}`}
      hidden={p.hidden}
      onBack={p.ctx.back}
      title={
        <>
          {titreMissionLam(m)}
          <small>
            {TYPE_MISSION[m.type]}
            {m.lieu.pk !== null ? ` · PK ${fmtPk(m.lieu.pk)}` : ''}
            {m.lieu.voie ? ` · voie ${m.lieu.voie}` : ''}
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
          <button className="ds-btn danger-tonal" onClick={() => p.ctx.open({ k: 'lam-urgences', id: m.id })}>
            <Icon name="alert" size={20} />
            Urgence
          </button>
        </>
      }
    >
      <section className="ds-hero" aria-label="Où en est la mission">
        <div className="ds-hero-top">
          <span className="ds-tag">{m.fin ? `Terminée à ${heure(m.fin)}` : debut ? `En cours depuis ${duree(now - debut)}` : 'Pas commencée'}</span>
          <span className={`ds-status ${m.fin ? 'ok' : 'todo'}`}>
            {av.faites}/{av.total}
          </span>
        </div>
        <div className="ds-meter" aria-hidden="true">
          <i style={{ width: `${(av.faites / Math.max(1, av.total)) * 100}%` }} />
        </div>
        {av.pendant && m.type === 'lam' && (
          <div className="ds-pendant">
            <p className="ds-pendant-titre">LAM en voie depuis {heure(m.faits['mev'] ?? now)}</p>
            <p className="ds-hint" style={{ margin: '0 0 8px' }}>
              Mode chantier : 30 km/h au plus, klaxon à chaque démarrage, 100 m avec le mobile qui précède. Aucun SAM franchi.
            </p>
            <div className="ds-situations">
              {SITUATIONS.map((s) => (
                <button key={s.id} className="ds-situation" onClick={() => setFeuille({ k: 'situation', id: s.id })}>
                  <Icon name={s.icon} size={20} />
                  {s.titre}
                </button>
              ))}
            </div>
          </div>
        )}
        {av.pendant && m.type === 's9' && (
          <div className="ds-pendant">
            <p className="ds-pendant-titre">
              Bouclage en place depuis {heure(m.faits['confirme-pose'] ?? now)}
              {m.ttx ? ` · ${m.ttx} TTx` : ''}
            </p>
            {m.enCours && (
              <button className="ds-btn primary wide" onClick={() => p.ctx.open({ k: 'lam-ttx', id: m.id })}>
                Reprendre : passage d’un train travaux
              </button>
            )}
            <div className="ds-pendant-btns">
              {ttxPossible(m) && (
                <button
                  className="ds-btn big"
                  onClick={() => {
                    save(demarrerTtx(m));
                    p.ctx.open({ k: 'lam-ttx', id: m.id });
                  }}
                >
                  <Icon name="train" size={22} />
                  Un train travaux doit passer
                </button>
              )}
              <button className="ds-btn big" onClick={() => setFeuille({ k: 'depeche' })}>
                <Icon name="message" size={22} />
                Noter une dépêche
              </button>
            </div>
          </div>
        )}
        {prochaine ? (
          <div className={`ds-next ${av.pendant ? 'quiet' : ''}`}>
            <span className="ds-tag">
              {av.pendant ? (m.type === 'lam' ? 'Quand le travail est fini' : 'Au retrait du bouclage') : 'À faire maintenant'} · {prochaine.phase.titre}
            </span>
            <h2 className="ds-next-texte">{prochaine.texte}</h2>
            {prochaine.aide && <p className="ds-next-aide">{prochaine.aide}</p>}
            {prochaine.id === 'dsh-lieu' && (
              <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'lam-dsh' })}>
                Contrôler avec le GPS
              </button>
            )}
            <button className={`ds-btn ${av.pendant ? 'dark' : 'primary'} big wide`} style={{ marginTop: 14 }} onClick={() => faire(prochaine)}>
              <Icon name={prochaine.depeche ? 'message' : 'check'} size={22} />
              {prochaine.depeche ? 'Noter la dépêche' : `Fait à ${heure(now)}`}
            </button>
          </div>
        ) : (
          <div className="ds-next">
            <h2 className="ds-next-texte">Mission terminée</h2>
            <p className="ds-next-aide">Partage le journal et le carnet de dépêches.</p>
          </div>
        )}
      </section>

      {phasesLam(m).map((ph) => (
        <Section key={ph.id} title={`${ph.titre}${ph.lieu ? ` · ${ph.lieu}` : ''}`}>
          {ph.etapes.map((e) => {
            const t = m.faits[e.id];
            const d = m.depeches.find((x) => x.etape === e.id);
            return (
              <label key={e.id} className={`ds-row ds-check ${t ? 'on' : ''}`}>
                <input type="checkbox" checked={!!t} onChange={(ev) => faire(e, ev.target.checked)} />
                <span className="ds-row-txt">
                  <b>{e.texte}</b>
                  {(t || e.depeche) && (
                    <small>
                      {t ? `Fait à ${heure(t)}` : 'Par dépêche'}
                      {d ? ` · ${d.avec}${d.recu ? ` · reçu ${d.recu}` : ''}${d.donne ? ` · donné ${d.donne}` : ''}` : ''}
                    </small>
                  )}
                </span>
              </label>
            );
          })}
        </Section>
      ))}

      <Section
        title={`Carnet de dépêches · ${m.depeches.length}`}
        action={
          <button className="ds-btn text" onClick={() => setFeuille({ k: 'depeche' })}>
            <Icon name="plus" size={18} />
            Dépêche
          </button>
        }
      >
        {m.depeches.length ? (
          [...m.depeches]
            .sort((a, b) => b.t - a.t)
            .map((d) => (
              <div key={d.id} className="ds-row ds-journal ds-depeche">
                <span className="ds-journal-h">{heure(d.t)}</span>
                <span className="ds-row-txt">
                  <b>{d.objet}</b>
                  <small>{d.avec}</small>
                </span>
                <span className="ds-nums">
                  {d.recu && (
                    <span>
                      <small>reçu</small>
                      {d.recu}
                    </span>
                  )}
                  {d.donne && (
                    <span>
                      <small>donné</small>
                      {d.donne}
                    </span>
                  )}
                </span>
              </div>
            ))
        ) : (
          <div className="ds-row">
            <span className="ds-row-txt">
              <small>Chaque dépêche s’inscrit ici avec son heure, le numéro reçu et le numéro donné.</small>
            </span>
          </div>
        )}
      </Section>

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
                  {e.note && <small>{e.note}</small>}
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

      <Section title="La mission">
        <Ligne
          icon="pin"
          title={m.lieu.ligne ? `Ligne ${fmtLine(m.lieu.ligne)}` : m.lieu.lieu || 'Lieu'}
          sub={[m.lieu.pk !== null ? `PK ${fmtPk(m.lieu.pk)}` : null, m.lieu.voie ? `voie ${m.lieu.voie}` : null, m.lieu.ligne ? m.lieu.lieu || null : null].filter(Boolean).join(' · ') || 'À indiquer'}
          onClick={() => p.ctx.open({ k: 'lam-nouvelle', id: m.id, etape: 'lieu', seule: true })}
        />
        <Ligne
          icon={m.type === 'lam' ? 'train' : 'tool'}
          title={m.type === 'lam' ? `${m.nbLam} LAM` : `Bouclage${m.bouclage.trim() ? ` ${m.bouclage.trim()}` : ''}`}
          sub={m.type === 'lam' ? [m.engins || null, m.pn ? 'mise en voie ou traversée de PN' : null].filter(Boolean).join(' · ') || 'Engins, n° d’agrément' : m.outils.map((o) => OUTIL_S9[o]).join(' · ')}
          onClick={() => p.ctx.open({ k: 'lam-nouvelle', id: m.id, etape: 'detail', seule: true })}
        />
        <Ligne
          icon="people"
          title="Chantier"
          sub={[m.consigne && `${m.type === 'lam' ? 'consigne' : 'fiche'} ${m.consigne}`, m.cch && `CCh ${m.cch}`, m.rptx && `RPTx ${m.rptx}`].filter(Boolean).join(' · ') || 'Consigne, CCh, RPTx'}
          onClick={() => p.ctx.open({ k: 'lam-nouvelle', id: m.id, etape: 'chantier', seule: true })}
        />
      </Section>
      <p className="ds-foot">Aide à la mission, d’après le livret technique AP-LAM / AP-S9 : la consigne LAM, la fiche de travail et la situation géographique priment.</p>

      {feuille && typeof feuille === 'object' && feuille.k === 'depeche' && (
        <FeuilleDepeche
          objet={feuille.etape?.texte ?? ''}
          avec={avecDefaut}
          utilises={numerosUtilises(m)}
          onClose={() => setFeuille(null)}
          onSave={(d) => {
            save(noterDepeche(m, d, feuille.etape));
            setFeuille(null);
            p.ctx.onToast(`Dépêche notée${d.donne ? ` : tu as donné le ${d.donne}` : ''}.`);
          }}
        />
      )}
      {feuille === 'pdf' && (
        <FeuilleExportPdf
          titre={`Journal · ${titreMissionLam(m)}`}
          docId={m.id}
          preparer={async () => {
            const [{ journalLamPdf }, ligne] = await Promise.all([import('./pdf'), m.lieu.ligne ? loadLine(m.lieu.ligne).catch(() => null) : Promise.resolve(null)]);
            return (info) => journalLamPdf(missionLamParId(m.id) ?? m, info, ligne);
          }}
          onClose={() => setFeuille(null)}
          onFini={(e) => {
            setFeuille(null);
            p.ctx.onToast(messageEnvoi(e));
          }}
        />
      )}
      {situation && (
        <Feuille title={situation.titre} onClose={() => setFeuille(null)}>
          <p className="ds-next-aide" style={{ marginTop: 0 }}>
            {situation.regle}
          </p>
          <button
            className="ds-btn primary wide"
            style={{ marginTop: 14 }}
            onClick={() => {
              save(ajouterEvenement(m, situation.journal, 'situation'));
              setFeuille(null);
              p.ctx.onToast('Noté au journal.');
            }}
          >
            Noter au journal à {heure(now)}
          </button>
        </Feuille>
      )}
      {feuille === 'note' && (
        <Feuille title="Ajouter une note au journal" onClose={() => setFeuille(null)}>
          <div className="asp-field">
            <label htmlFor="lam-note">Note</label>
            <textarea id="lam-note" className="sig-comment" rows={3} value={texteNote} placeholder="Ex. : appel du CCh, changement de point de mise en voie…" onChange={(e) => setTexteNote(e.target.value)} />
          </div>
          <button
            className="ds-btn primary wide"
            disabled={!texteNote.trim()}
            onClick={() => {
              save(ajouterEvenement(m, texteNote.trim()));
              setTexteNote('');
              setFeuille(null);
            }}
          >
            Ajouter à {heure(now)}
          </button>
        </Feuille>
      )}
      {feuille === 'plus' && (
        <Feuille title={titreMissionLam(m)} onClose={() => setFeuille(null)}>
          {m.lieu.ligne && m.lieu.pk !== null && (
            <Ligne
              icon="map"
              title="Voir sur la carte"
              chevron={false}
              onClick={() => {
                setFeuille(null);
                p.ctx.onGoPk(m.lieu.ligne!, m.lieu.pk!);
              }}
            />
          )}
          <Ligne icon="file" title="Journal en PDF" chevron={false} onClick={() => setFeuille('pdf')} />
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
              if (!window.confirm('Supprimer cette mission, son carnet de dépêches et son journal du téléphone ?')) return;
              setFeuille(null);
              supprimerMissionLam(m.id);
              p.ctx.back();
            }}
          />
        </Feuille>
      )}
    </Ecran>
  );
}

/** Passage d'un train travaux (AP S9) : retrait momentané puis remise, dans l'ordre, avec les dépêches. */
export function TtxScreen(p: { id: string; hidden?: boolean; ctx: Ctx }) {
  const m = useMissionsLam().find((x) => x.id === p.id) ?? null;
  const [depeche, setDepeche] = useState<EtapeLam | null>(null);
  if (!m) return null;
  const etapes = passageTtx(m);
  const ec = m.enCours ?? { debut: 0, faits: {} as Record<string, number> };
  const prochaine = etapes.find((e) => !ec.faits[e.id]) ?? null;
  const fini = !prochaine;
  const terminer = () => {
    const r = terminerTtx(m);
    enregistrerMissionLam(r.m);
    p.ctx.back();
    p.ctx.onToast(`${r.texte} : noté au journal.`);
  };
  return (
    <Ecran
      label="Passage d’un train travaux"
      hidden={p.hidden}
      onBack={p.ctx.back}
      backIcon="close"
      title={
        <>
          Passage d’un train travaux · n° {m.ttx + 1}
          <small>{titreMissionLam(m)}</small>
        </>
      }
      actionsCol
      actions={
        <>
          <button className="ds-btn primary big" disabled={!fini} onClick={terminer}>
            {fini ? 'Terminé : noter au journal' : `Encore ${etapes.filter((e) => !ec.faits[e.id]).length} étape(s)`}
          </button>
          <button
            className="ds-btn text"
            onClick={() => {
              enregistrerMissionLam({ ...m, enCours: null });
              p.ctx.back();
            }}
          >
            Annuler ce passage
          </button>
        </>
      }
    >
      <p className="ds-q-help">Retrait : pinces, pétard, SAM, puis dépêche. Remise : SAM, pétard, pinces, puis dépêche. Touche chaque geste quand il est fait.</p>
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
                onChange={(ev) => (ev.target.checked && e.depeche ? setDepeche(e) : enregistrerMissionLam(cocherGesteTtx(m, e.id, ev.target.checked)))}
              />
              <span className="ds-row-txt">
                <b>{e.texte}</b>
                {(t || e.depeche) && <small>{t ? `Fait à ${heure(t)}` : 'Par dépêche'}</small>}
              </span>
            </label>
          );
        })}
      </div>
      {depeche && (
        <FeuilleDepeche
          objet={`TTx n° ${m.ttx + 1} : ${depeche.texte.charAt(0).toLowerCase()}${depeche.texte.slice(1)}`}
          avec={m.depeches.at(-1)?.avec ?? 'RPTx'}
          utilises={numerosUtilises(m)}
          onClose={() => setDepeche(null)}
          onSave={(d) => {
            enregistrerMissionLam(depecheTtx(m, d, depeche.id));
            setDepeche(null);
          }}
        />
      )}
    </Ecran>
  );
}

/** Toutes les missions LAM / S9 gardées sur le téléphone. */
export function MissionsLamScreen(p: { hidden?: boolean; ctx: Ctx; onNew: () => void }) {
  const list = useMissionsLam();
  return (
    <Ecran
      label="Mes missions LAM / S9"
      hidden={p.hidden}
      onBack={p.ctx.back}
      title="Mes missions LAM / S9"
      actions={
        <button className="ds-btn primary big" onClick={p.onNew}>
          <Icon name="plus" size={22} />
          Nouvelle mission
        </button>
      }
    >
      {list.length ? <ListeMissionsLam list={list} ctx={p.ctx} /> : <p className="ds-hint">Aucune mission pour le moment.</p>}
    </Ecran>
  );
}

export function ListeMissionsLam({ list, ctx }: { list: MissionLam[]; ctx: Ctx }) {
  return (
    <div className="ds-list">
      {list.map((m) => {
        const av = avancementLam(m);
        return (
          <Ligne
            key={m.id}
            icon={m.type === 'lam' ? 'train' : 'tool'}
            badgeClass="brand"
            title={titreMissionLam(m)}
            sub={`${m.date.split('-').reverse().join('/')} · ${TYPE_MISSION[m.type]}`}
            end={<span className={`ds-status ${m.fin ? 'ok' : 'todo'}`}>{m.fin ? 'Terminée' : `${av.faites}/${av.total}`}</span>}
            onClick={() => ctx.open({ k: 'lam-mission', id: m.id })}
            label={`Ouvrir ${titreMissionLam(m)}`}
          />
        );
      })}
    </div>
  );
}
