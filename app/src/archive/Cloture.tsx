/**
 * Clôture de fin de mission, côté écrans : la feuille « Clôturer et télécharger » (nom, signatures, dossier PDF),
 * le rappel sur l'accueil, l'archive d'une mission (lecture seule) et la liste « Mes archives ».
 */
import { useMemo, useState } from 'react';
import { Icon } from '../components/parts';
import { useEntreprise } from '../access/entreprise';
import type { Ctx } from '../asp/contexte';
import { jourTexte } from '../asp/etat';
import { FeuilleExportPdf } from '../asp/ExportPdf';
import { Ecran, Ligne, Section } from '../asp/kit';
import { partagerFichier } from '../asp/partage';
import { TYPE_MISSION_LABEL, type TypeMission } from './cloture';
import { fichierDossier, useDossiers, type Dossier } from './dossiers';
import { envoyerDossier } from './envoi';
import { cloturer, preparation, trouver, useACloturer } from './missions';

const ICONE: Record<TypeMission, 'vest' | 'tracks' | 'train' | 'flag'> = { asp: 'vest', pn: 'tracks', lam: 'train', chaine: 'flag' };
const quand = (t: number) => `${new Date(t).toLocaleDateString('fr-FR')} à ${new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

function etatEnvoi(d: Dossier, entreprise: string | null): { texte: string; classe: 'ok' | 'todo' | 'stop' } {
  if (d.envoi === 'envoye') return { texte: `Copie reçue par ${d.entreprise || entreprise || 'ton entreprise'}${d.envoyeLe ? ` le ${quand(d.envoyeLe)}` : ''}`, classe: 'ok' };
  if (d.envoi === 'refuse') return { texte: d.erreur ?? 'Envoi refusé.', classe: 'stop' };
  return { texte: d.erreur ?? `Copie pour ${entreprise || 'ton entreprise'} : en attente de réseau.`, classe: 'todo' };
}

/** Feuille de clôture : le dossier PDF complet, signé, téléchargé ; puis la mission est archivée. */
export function FeuilleCloture(p: { type: TypeMission; id: string; ctx: Ctx; onClose: () => void }) {
  const ent = useEntreprise();
  const prep = useMemo(() => {
    const u = trouver(p.type, p.id);
    return u && !u.x.cloture ? preparation(u) : null;
  }, [p.type, p.id]);
  if (!prep) return null;
  return (
    <FeuilleExportPdf
      titre={`Dossier · ${prep.titre}`}
      docId={prep.docId}
      defautNom={prep.defautNom}
      second={prep.second}
      intro={`${prep.intro} Après le téléchargement, la mission est archivée et verrouillée${ent ? ` ; une copie part à ${ent.nom}` : ''}.`}
      bouton="Clôturer et télécharger"
      cloture
      preparer={prep.preparer}
      onClose={p.onClose}
      onFichier={async (file, x) => {
        await cloturer(p.type, p.id, file, x);
      }}
      onFini={(e) => {
        p.onClose();
        p.ctx.onToast(e === 'annule' ? 'Clôture annulée : rien n’a été archivé.' : 'Mission clôturée et archivée. Retrouve-la dans « Mes archives ».');
      }}
    />
  );
}

/** Rappel sur l'accueil : les missions finies (ou passées) pas encore clôturées. */
export function RappelCloture({ ctx, types }: { ctx: Ctx; types?: TypeMission[] }) {
  const tout = useACloturer();
  const liste = types ? tout.filter((x) => types.includes(x.type)) : tout;
  if (!liste.length) return null;
  return (
    <section className="ds-card cl-rappel" aria-label="Missions à clôturer">
      <div className="cl-rappel-tete">
        <Icon name="warn" size={20} />
        <b>{liste.length === 1 ? 'Une mission à clôturer' : `${liste.length} missions à clôturer`}</b>
      </div>
      <p className="ds-hint" style={{ margin: '4px 0 8px' }}>
        Crée ton dossier de fin de mission : il est téléchargé, archivé, et envoyé à ton entreprise.
      </p>
      {liste.slice(0, 3).map((x) => (
        <div key={`${x.type}-${x.id}`} className="cl-rappel-ligne">
          <span>
            <b>{x.titre}</b>
            <small>
              {TYPE_MISSION_LABEL[x.type]} · {jourTexte(x.date)}
              {x.finie ? ' · finie' : ''}
            </small>
          </span>
          <button className="ds-btn primary" onClick={() => ctx.open({ k: 'cloture', type: x.type, id: x.id })} aria-label={`Clôturer ${x.titre}`}>
            Clôturer
          </button>
        </div>
      ))}
      {liste.length > 3 && <small className="ds-hint">Et {liste.length - 3} de plus, plus anciennes.</small>}
    </section>
  );
}

/** Bouton « Clôturer la mission », dans l'écran de la mission. */
export function LigneCloturer({ ctx, type, id, sub }: { ctx: Ctx; type: TypeMission; id: string; sub?: string }) {
  return (
    <Ligne
      icon="check"
      badgeClass="brand"
      title={type === 'chaine' ? 'Clôturer mon poste' : 'Clôturer la mission'}
      sub={sub ?? 'Dossier PDF complet, signé, téléchargé, archivé et envoyé à ton entreprise'}
      onClick={() => ctx.open({ k: 'cloture', type, id })}
    />
  );
}

/** Lien « Mes archives » de l'accueil (seulement s'il y a des dossiers). */
export function LienArchives({ ctx }: { ctx: Ctx }) {
  const d = useDossiers();
  if (!d?.length) return null;
  const attente = d.filter((x) => x.envoi !== 'envoye').length;
  return (
    <div className="ds-list" style={{ marginTop: 14 }}>
      <Ligne
        icon="history"
        title="Mes archives"
        sub={`${d.length} dossier${d.length > 1 ? 's' : ''} de fin de mission${attente ? ` · ${attente} pas encore envoyé${attente > 1 ? 's' : ''}` : ''}`}
        onClick={() => ctx.open({ k: 'archives' })}
      />
    </div>
  );
}

function DossierCarte({ d, ctx }: { d: Dossier; ctx: Ctx }) {
  const ent = useEntreprise();
  const [busy, setBusy] = useState(false);
  const e = etatEnvoi(d, ent?.nom ?? null);
  const telecharger = async () => {
    const f = await fichierDossier(d.id);
    if (!f) return ctx.onToast('Dossier introuvable sur ce téléphone.');
    const r = await partagerFichier(f, `Dossier · ${d.titre}`);
    if (r === 'telecharge') ctx.onToast('Dossier enregistré dans les téléchargements.');
  };
  const reessayer = async () => {
    setBusy(true);
    try {
      const r = await envoyerDossier(d);
      ctx.onToast(r === 'envoye' ? 'Copie envoyée à ton entreprise.' : r === 'refuse' ? 'Envoi refusé.' : 'Pas encore envoyé : nouvel essai plus tard.');
    } catch {
      ctx.onToast('Pas de réseau : le dossier partira dès qu’il y en aura.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ds-hero cl-archive" aria-label={`Dossier : ${d.titre}`}>
      <div className="ds-hero-top">
        <span className="ds-tag">{TYPE_MISSION_LABEL[d.type]}</span>
        <span className="ds-status ok">Archivée</span>
      </div>
      <h2>{d.titre}</h2>
      <p className="ds-hero-sub">
        {jourTexte(d.date)} · clôturée le {quand(d.cloture)}
        {d.agent ? ` par ${d.agent}` : ''}
      </p>
      <p className={`cl-envoi ${e.classe}`} role="status">
        {e.texte}
      </p>
      <div className="ds-hero-actions">
        <button className="ds-btn primary" onClick={() => void telecharger()}>
          <Icon name="file" size={20} />
          Télécharger le dossier
        </button>
        {d.envoi !== 'envoye' && (
          <button className="ds-btn" disabled={busy} onClick={() => void reessayer()}>
            Renvoyer
          </button>
        )}
      </div>
      <p className="ds-hint" style={{ marginBottom: 0 }}>
        Mission verrouillée : elle ne peut plus être modifiée. Le dossier est le PDF signé au moment de la clôture.
      </p>
    </section>
  );
}

/** Archive d'une mission clôturée : ce qui s'ouvre à la place de l'écran de saisie. */
export function ArchiveEcran(p: { type: TypeMission; id: string; ctx: Ctx; hidden?: boolean }) {
  const dossiers = useDossiers();
  const u = trouver(p.type, p.id);
  const d = dossiers?.find((x) => x.id === u?.x.cloture?.archive) ?? dossiers?.find((x) => x.refId === p.id && x.type === p.type) ?? null;
  return (
    <Ecran label={`Archive : ${u ? (d?.titre ?? 'mission') : 'mission'}`} title="Mission archivée" onBack={p.ctx.back} hidden={p.hidden}>
      {d ? <DossierCarte d={d} ctx={p.ctx} /> : <p className="ds-hint">{dossiers === null ? 'Lecture des archives…' : 'Dossier introuvable sur ce téléphone.'}</p>}
    </Ecran>
  );
}

/** « Mes archives » : tous les dossiers de fin de mission, du plus récent au plus ancien. */
export function ArchivesScreen(p: { ctx: Ctx; hidden?: boolean }) {
  const dossiers = useDossiers();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const parMois = useMemo(() => {
    const m = new Map<string, Dossier[]>();
    for (const d of dossiers ?? []) {
      const k = new Date(d.cloture).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()];
  }, [dossiers]);
  return (
    <Ecran label="Mes archives" title="Mes archives" onBack={p.ctx.back} hidden={p.hidden}>
      {dossiers === null ? (
        <p className="ds-hint">Lecture des archives…</p>
      ) : !dossiers.length ? (
        <p className="ds-hint">Aucune mission clôturée pour le moment.</p>
      ) : (
        parMois.map(([mois, liste]) => (
          <Section key={mois} title={mois.charAt(0).toUpperCase() + mois.slice(1)}>
            <div className="ds-list">
              {liste.map((d) =>
                ouvert === d.id ? null : (
                  <Ligne
                    key={d.id}
                    icon={ICONE[d.type]}
                    title={d.titre}
                    sub={`${TYPE_MISSION_LABEL[d.type]} · ${jourTexte(d.date)}`}
                    end={<span className={`ds-status ${d.envoi === 'envoye' ? 'ok' : d.envoi === 'refuse' ? 'stop' : 'todo'}`}>{d.envoi === 'envoye' ? 'Envoyé' : d.envoi === 'refuse' ? 'Refusé' : 'En attente'}</span>}
                    onClick={() => setOuvert(d.id)}
                    label={`Ouvrir le dossier ${d.titre}`}
                  />
                ),
              )}
            </div>
            {liste.some((d) => d.id === ouvert) && <DossierCarte d={liste.find((d) => d.id === ouvert)!} ctx={p.ctx} />}
          </Section>
        ))
      )}
    </Ecran>
  );
}
