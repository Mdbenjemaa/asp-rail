/** Nouvelle mission d'agent PN, pas à pas : rôle, PN (trouvé au GPS ou saisi), équipement, chantier. */
import { useRef, useState } from 'react';
import { Icon } from '../components/parts';
import { useRetour } from '../lib/back';
import { fmtLine, fmtPk } from '../lib/format';
import type { Ctx, EtapePn } from '../asp/contexte';
import { Bascule, Ecran, Pastilles, Tuiles } from '../asp/kit';
import { useLigne } from '../asp/lignes';
import { Champ, Interrupteur, PkInput } from '../asp/ui';
import { enregistrerMission, pnsProches, supprimerMission, TYPE_PN, useMissions, type Mission, type PnInfo, type TypePn } from './mission';

const ETAPES: { id: EtapePn; titre: string; court: string }[] = [
  { id: 'role', titre: 'Quelle est ta mission ?', court: 'Mission' },
  { id: 'pn', titre: 'Quel PN ?', court: 'PN' },
  { id: 'equipement', titre: 'Comment est équipé le PN ?', court: 'Équipement' },
  { id: 'chantier', titre: 'Le chantier', court: 'Chantier' },
];

export function NouvelleMission(p: { id: string; etape?: EtapePn; seule?: boolean; hidden?: boolean; ctx: Ctx }) {
  const m = useMissions().find((x) => x.id === p.id) ?? null;
  const [i, setI] = useState(() => Math.max(0, ETAPES.findIndex((e) => e.id === (p.etape ?? 'role'))));
  const touche = useRef(!!p.seule);
  const fermer = () => {
    if (!touche.current) supprimerMission(p.id);
    p.ctx.back();
  };
  const precedent = () => (p.seule || i === 0 ? fermer() : setI(i - 1));
  useRetour(!p.hidden, precedent);
  if (!m) return null;
  const set = (patch: Partial<Mission>) => {
    touche.current = true;
    enregistrerMission({ ...m, ...patch });
  };
  const setPn = (patch: Partial<PnInfo>) => set({ pn: { ...m.pn, ...patch } });
  const etape = ETAPES[i];
  const derniere = i === ETAPES.length - 1;
  return (
    <Ecran
      label={p.seule ? `Modifier : ${etape.court}` : 'Nouvelle mission PN'}
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
            onClick={() => {
              touche.current = true;
              if (derniere) p.ctx.replace({ k: 'pn-mission', id: m.id });
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
      <h2 className="ds-q">{etape.titre}</h2>
      {etape.id === 'role' && (
        <Tuiles
          label="Mission"
          value={m.role}
          onChange={(role) => set({ role })}
          options={[
            { id: 'travaux', title: 'Agent PN en travaux', sub: 'Tu reprends le PN en travaux (boîtier, SAM, DSh) et tu gères les mobiles travaux.', icon: 'tool' },
            { id: 'franchissement', title: 'Agent franchissement mobile travaux', sub: 'Le PN est déjà repris en travaux : tu gères le passage des mobiles travaux.', icon: 'arrow' },
          ]}
        />
      )}
      {etape.id === 'pn' && <EtapePnChoix m={m} setPn={setPn} ctx={p.ctx} />}
      {etape.id === 'equipement' && (
        <>
          <span className="ds-label">Type de PN</span>
          <Pastilles
            label="Type de PN"
            value={m.pn.type}
            options={(Object.keys(TYPE_PN) as TypePn[]).map((t) => [t, TYPE_PN[t]])}
            onChange={(type) => setPn({ type, commande: type === 'SALFC' || type === 'SAL0' ? 'ma' : m.pn.commande })}
          />
          <span className="ds-label">Commande du PN</span>
          <Tuiles
            label="Commande du PN"
            value={m.pn.commande}
            onChange={(commande) => setPn({ commande, bal: commande === 'ma' ? false : m.pn.bal })}
            options={[
              { id: 'boitier', title: 'Boîtier de commutateurs', sub: 'Voyants, CSR, FntA (et blocage sur ligne BAL).', icon: 'sliders' },
              { id: 'ma', title: 'Commutateur Marche-Arrêt', sub: 'M/A, et Normal-Secours s’il y en a un.', icon: 'sliders' },
            ]}
          />
          {m.pn.commande === 'boitier' && (
            <div className="ds-list ds-toggles" style={{ marginTop: 14 }}>
              <Interrupteur
                label="Ligne équipée en BAL"
                hint="Le PN a des commutateurs de BLOCAGE (clé de Berne)."
                checked={m.pn.bal}
                onChange={(bal) => setPn({ bal })}
              />
            </div>
          )}
          <span className="ds-label">Voies</span>
          <Bascule
            label="Voies"
            value={m.pn.voies}
            options={[
              ['double', 'Double voie'],
              ['unique', 'Voie unique'],
            ]}
            onChange={(voies) => setPn({ voies })}
          />
          <p className="ds-hint">
            {m.pn.voies === 'double' ? 'Un voyant d’annonce par voie (ANNONCE VOIE…).' : 'Un voyant d’annonce par sens (ANNONCE SENS…).'} Étiquette blanche : voie 1 ou sens
            impair ; bleue : voie 2 ou sens pair.
          </p>
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
            <Champ label="N° du contrat de travaux" value={m.contrat} onChange={(contrat) => set({ contrat })} />
            <Champ label="Indice (fiche de travail)" value={m.indice} onChange={(indice) => set({ indice })} />
            <Champ label="Chef de chantier (CCh)" value={m.cch} placeholder="Nom, téléphone" onChange={(cch) => set({ cch })} />
            <Champ label="RPTx" value={m.rptx} placeholder="Nom, téléphone" onChange={(rptx) => set({ rptx })} />
          </div>
          <p className="ds-hint">Tout est facultatif : ça sert au carnet du PN et au journal de la mission.</p>
        </>
      )}
    </Ecran>
  );
}

/** Choix du PN : ceux autour de la position GPS, ou saisie du numéro, de la ligne et du PK. */
function EtapePnChoix({ m, setPn, ctx }: { m: Mission; setPn: (patch: Partial<PnInfo>) => void; ctx: Ctx }) {
  const here = ctx.here;
  const { doc } = useLigne(here?.code ?? null);
  const proches = here && doc ? pnsProches(doc.points, here.pk, 4) : [];
  const [cherche, setCherche] = useState(false);
  const lineName = m.pn.ligne ? (ctx.manifest?.lines[m.pn.ligne]?.n ?? null) : null;
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
          <b>{ctx.locating ? 'Recherche de ta position…' : here && cherche ? 'Reprendre ma position' : 'Trouver les PN autour de moi'}</b>
          <small>{here && cherche ? `Ligne ${fmtLine(here.code)} · PK ${fmtPk(here.pk)}` : 'Avec le GPS et les données ouvertes SNCF Réseau.'}</small>
        </span>
      </button>
      {ctx.locError && !ctx.locating && cherche && <p className="ds-hint error">{ctx.locError}</p>}
      {here && cherche && !ctx.locating && (
        <>
          <span className="ds-label">PN de la ligne {fmtLine(here.code)}, les plus proches</span>
          {proches.length ? (
            <Tuiles
              label="PN proches"
              value={proches.find((x) => x.numero === m.pn.numero && here.code === m.pn.ligne)?.numero ?? null}
              onChange={(num) => {
                const x = proches.find((y) => y.numero === num)!;
                setPn({ numero: x.numero, ligne: here.code, ligneNom: here.ligneNom, pk: x.pk, lieu: x.lieu });
              }}
              options={proches.map((x) => ({
                id: x.numero,
                title: `${x.nom} · ${x.distance < 1000 ? `${x.distance} m` : `${(x.distance / 1000).toFixed(1).replace('.', ',')} km`} ${x.devant ? '▲' : '▼'}`,
                sub: `PK ${fmtPk(x.pk)}${x.lieu ? ` · ${x.lieu}` : ''}`,
                icon: 'tracks',
              }))}
            />
          ) : (
            <p className="ds-hint">Aucun PN connu sur cette ligne dans les données : saisis-le.</p>
          )}
        </>
      )}
      <div className="ds-or">ou saisis-le</div>
      <div className="ds-fields">
        <Champ label="Numéro du PN" value={m.pn.numero} placeholder="11" onChange={(numero) => setPn({ numero: numero.replace(/^PN\s*/i, '') })} />
        <Champ
          label="Ligne (code à 6 chiffres)"
          value={m.pn.ligne ?? ''}
          placeholder="830000"
          inputMode="numeric"
          onChange={(v) => {
            const code = v.replace(/\D/g, '').slice(0, 6);
            setPn({ ligne: code || null, ligneNom: (code && ctx.manifest?.lines[code]?.n) || null });
          }}
        />
        {m.pn.ligne && m.pn.ligne.length === 6 && <p className={`ds-hint ${lineName ? '' : 'error'}`}>{lineName ?? 'Ligne inconnue dans les données : vérifie le code.'}</p>}
        <PkInput label="PK du PN" value={m.pn.pk} onChange={(pk) => setPn({ pk })} />
        <Champ label="Route, commune" value={m.pn.lieu} placeholder="VC · Lieusaint" onChange={(lieu) => setPn({ lieu })} />
      </div>
    </>
  );
}
