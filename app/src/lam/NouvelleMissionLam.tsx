/** Nouvelle mission AP LAM ou AP S9, pas à pas : mission, lieu (GPS ou saisie), engins ou outils, chantier. */
import { useRef, useState } from 'react';
import { Icon } from '../components/parts';
import { useRetour } from '../lib/back';
import { fmtLine, fmtPk } from '../lib/format';
import type { Ctx, EtapeLam } from '../asp/contexte';
import { Bascule, Ecran, Tuiles } from '../asp/kit';
import { Champ, Interrupteur, PkInput } from '../asp/ui';
import { enregistrerMissionLam, OUTIL_S9, supprimerMissionLam, useMissionsLam, type LieuLam, type MissionLam, type OutilS9 } from './mission';

const ETAPES: { id: EtapeLam; titre: string; court: string }[] = [
  { id: 'type', titre: 'Quelle est ta mission ?', court: 'Mission' },
  { id: 'lieu', titre: 'Où ?', court: 'Lieu' },
  { id: 'detail', titre: 'Ce que tu prends en charge', court: 'Détail' },
  { id: 'chantier', titre: 'Le chantier', court: 'Chantier' },
];

export function NouvelleMissionLam(p: { id: string; etape?: EtapeLam; seule?: boolean; hidden?: boolean; ctx: Ctx }) {
  const m = useMissionsLam().find((x) => x.id === p.id) ?? null;
  const [i, setI] = useState(() => Math.max(0, ETAPES.findIndex((e) => e.id === (p.etape ?? 'type'))));
  const touche = useRef(!!p.seule);
  const fermer = () => {
    if (!touche.current) supprimerMissionLam(p.id);
    p.ctx.back();
  };
  const precedent = () => (p.seule || i === 0 ? fermer() : setI(i - 1));
  useRetour(!p.hidden, precedent);
  if (!m) return null;
  const set = (patch: Partial<MissionLam>) => {
    touche.current = true;
    enregistrerMissionLam({ ...m, ...patch, brouillon: false });
  };
  const setLieu = (patch: Partial<LieuLam>) => set({ lieu: { ...m.lieu, ...patch } });
  const etape = ETAPES[i];
  const derniere = i === ETAPES.length - 1;
  const titre = etape.id === 'detail' ? (m.type === 'lam' ? 'Les engins' : 'Le bouclage') : etape.titre;
  return (
    <Ecran
      label={p.seule ? `Modifier : ${etape.court}` : 'Nouvelle mission LAM / S9'}
      hidden={p.hidden}
      retourGere
      onBack={precedent}
      backIcon={p.seule || i === 0 ? 'close' : 'back'}
      backLabel={p.seule || i === 0 ? 'Fermer' : 'Étape précédente'}
      center={
        p.seule ? (
          <h1>Modifier · {etape.court}</h1>
        ) : (
          <div className="ds-progress" role="progressbar" aria-label={`Étape ${i + 1} sur ${ETAPES.length}`} aria-valuemin={1} aria-valuemax={ETAPES.length} aria-valuenow={i + 1}>
            {ETAPES.map((e, k) => (
              <i key={e.id} className={k <= i ? 'done' : ''} />
            ))}
          </div>
        )
      }
      right={
        !p.seule && i > 0 ? (
          <button className="ds-iconbtn" onClick={fermer} aria-label="Fermer">
            <Icon name="close" size={22} />
          </button>
        ) : undefined
      }
      actionsCol
      actions={
        p.seule ? (
          <button className="ds-btn primary big" onClick={p.ctx.back}>
            Enregistrer
          </button>
        ) : (
          <button
            className="ds-btn primary big"
            disabled={etape.id === 'detail' && m.type === 's9' && !m.outils.length}
            onClick={() => {
              touche.current = true;
              if (m.brouillon) enregistrerMissionLam({ ...m, brouillon: false });
              if (derniere) p.ctx.replace({ k: 'lam-mission', id: m.id });
              else setI(i + 1);
            }}
          >
            {derniere ? 'Commencer la mission' : 'Continuer'}
          </button>
        )
      }
    >
      {!p.seule && (
        <p className="ds-tag">
          Étape {i + 1} sur {ETAPES.length} · {etape.court}
        </p>
      )}
      <h2 className="ds-q">{titre}</h2>
      {etape.id === 'type' && (
        <>
          <Tuiles
            label="Mission"
            value={m.type}
            onChange={(type) => set({ type })}
            options={[
              { id: 'lam', title: 'AP LAM', sub: 'Lorry automoteur : vérifications, mise en voie, déplacement, mise hors voie. 1 à 3 engins.', icon: 'train' },
              { id: 's9', title: 'AP S9', sub: 'Bouclage sur ordre par dépêche : DSh, SAM + pétard, commutateur de blocage, observation.', icon: 'tool' },
            ]}
          />
          <p className="ds-hint">Jamais les deux en même temps : les missions de sécurité sont séparées dans le temps.</p>
        </>
      )}
      {etape.id === 'lieu' && <EtapeLieu m={m} setLieu={setLieu} ctx={p.ctx} />}
      {etape.id === 'detail' && m.type === 'lam' && (
        <>
          <span className="ds-label">Nombre de LAM</span>
          <Bascule
            label="Nombre de LAM"
            value={String(m.nbLam) as '1' | '2' | '3'}
            options={[
              ['1', '1 LAM'],
              ['2', '2 LAM'],
              ['3', '3 LAM'],
            ]}
            onChange={(v) => set({ nbLam: Number(v) as 1 | 2 | 3 })}
          />
          <p className="ds-hint">Trois au plus, groupés et toujours dans ton champ de vision.</p>
          <div className="ds-fields" style={{ marginTop: 14 }}>
            <Champ label="Engins (type, n° d’agrément)" value={m.engins} placeholder="Pelle rail-route 123" onChange={(engins) => set({ engins })} />
          </div>
          <div className="ds-list ds-toggles" style={{ marginTop: 14 }}>
            <Interrupteur label="Mise en voie ou traversée d’un PN" hint="Ajoute les mesures vis-à-vis de la route." checked={m.pn} onChange={(pn) => set({ pn })} />
          </div>
        </>
      )}
      {etape.id === 'detail' && m.type === 's9' && (
        <>
          <div className="ds-fields">
            <Champ label="Repère du bouclage" value={m.bouclage} placeholder="A3" onChange={(bouclage) => set({ bouclage })} />
          </div>
          <span className="ds-label">Outils de ta fiche de travail</span>
          <div className="ds-list ds-toggles">
            {(Object.keys(OUTIL_S9) as OutilS9[]).map((o) => (
              <Interrupteur
                key={o}
                label={OUTIL_S9[o]}
                checked={m.outils.includes(o)}
                onChange={(on) => {
                  // Une mission S9 a toujours au moins un outil (sinon il n'y a rien à poser ni à retirer).
                  if (!on && m.outils.length === 1 && m.outils[0] === o) {
                    p.ctx.onToast('Garde au moins un outil de ta fiche de travail.');
                    return;
                  }
                  set({ outils: (Object.keys(OUTIL_S9) as OutilS9[]).filter((x) => (x === o ? on : m.outils.includes(x))) });
                }}
              />
            ))}
          </div>
          {!m.outils.length && <p className="ds-hint error">Choisis au moins un outil.</p>}
          <p className="ds-hint">Seulement ce qui est écrit sur ta fiche de travail.</p>
        </>
      )}
      {etape.id === 'chantier' && (
        <>
          <Bascule
            label="Horaire"
            value={m.horaire}
            options={[
              ['jour', 'De jour', 'sun'],
              ['nuit', 'De nuit', 'moon'],
            ]}
            onChange={(horaire) => set({ horaire })}
          />
          <div className="ds-fields" style={{ marginTop: 18 }}>
            <Champ label="Date" type="date" value={m.date} onChange={(date) => set({ date })} />
            <Champ
              label={m.type === 'lam' ? 'N° de la consigne LAM' : 'Fiche de travail (indice)'}
              value={m.consigne}
              onChange={(consigne) => set({ consigne })}
            />
            <Champ label="Chef de chantier (CCh)" value={m.cch} placeholder="Nom, téléphone" onChange={(cch) => set({ cch })} />
            <Champ label="RPTx" value={m.rptx} placeholder="Nom, téléphone" onChange={(rptx) => set({ rptx })} />
          </div>
          <p className="ds-hint">Tout est facultatif : ça sert au journal et au carnet de dépêches.</p>
        </>
      )}
    </Ecran>
  );
}

/** Lieu : la position GPS en un toucher, ou ligne, PK, voie et lieu saisis. */
function EtapeLieu({ m, setLieu, ctx }: { m: MissionLam; setLieu: (patch: Partial<LieuLam>) => void; ctx: Ctx }) {
  const here = ctx.here;
  const [cherche, setCherche] = useState(false);
  const lineName = m.lieu.ligne ? (ctx.manifest?.lines[m.lieu.ligne]?.n ?? null) : null;
  const pris = here && m.lieu.ligne === here.code && m.lieu.pk === here.pk;
  return (
    <>
      <button
        className="ds-gps"
        disabled={ctx.locating}
        onClick={() => {
          setCherche(true);
          ctx.onLocate();
        }}
      >
        <span className="ds-tile-ico">
          <Icon name="locate" />
        </span>
        <span className="ds-tile-txt">
          <b>{ctx.locating ? 'Recherche de ta position…' : here && cherche ? 'Reprendre ma position' : 'Utiliser ma position GPS'}</b>
          <small>{here && cherche ? `Ligne ${fmtLine(here.code)} · PK ${fmtPk(here.pk)}` : 'Ligne et PK au mètre, d’après les données ouvertes.'}</small>
        </span>
      </button>
      {ctx.locError && !ctx.locating && cherche && <p className="ds-hint error">{ctx.locError}</p>}
      {here && cherche && !ctx.locating && (
        <Tuiles
          label="Position trouvée"
          value={pris ? 'ici' : null}
          onChange={() => setLieu({ ligne: here.code, ligneNom: here.ligneNom, pk: here.pk })}
          options={[{ id: 'ici', title: `Ligne ${fmtLine(here.code)} · PK ${fmtPk(here.pk)}`, sub: here.ligneNom ?? 'Prendre cette position', icon: 'pin' }]}
        />
      )}
      <div className="ds-or">ou saisis-le</div>
      <div className="ds-fields">
        <Champ
          label="Ligne (code à 6 chiffres)"
          value={m.lieu.ligne ?? ''}
          placeholder="830000"
          inputMode="numeric"
          onChange={(v) => {
            const code = v.replace(/\D/g, '').slice(0, 6);
            setLieu({ ligne: code || null, ligneNom: (code && ctx.manifest?.lines[code]?.n) || null });
          }}
        />
        {m.lieu.ligne && m.lieu.ligne.length === 6 && <p className={`ds-hint ${lineName ? '' : 'error'}`}>{lineName ?? 'Ligne inconnue dans les données : vérifie le code.'}</p>}
        <PkInput label={m.type === 'lam' ? 'PK du point de mise en voie' : 'PK du bouclage'} value={m.lieu.pk} onChange={(pk) => setLieu({ pk })} />
        <Champ label="Voie" value={m.lieu.voie} placeholder="1, 2, V1B…" onChange={(voie) => setLieu({ voie })} />
        <Champ label={m.type === 'lam' ? 'Point de mise en voie' : 'Lieu'} value={m.lieu.lieu} placeholder="PN 26, plateforme…" onChange={(lieu) => setLieu({ lieu })} />
      </div>
    </>
  );
}
