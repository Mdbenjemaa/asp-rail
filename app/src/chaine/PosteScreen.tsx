/**
 * Écrans de l'agent de la chaîne : son poste (où il est, ce qu'il doit voir, son service), la saisie du poste,
 * et ses gestes et signaux.
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import { fmtLine, fmtPk } from '../lib/format';
import { heureDans } from '../lib/temps';
import { useHorloge } from '../pn/horloge';
import { metres } from '../asp/dispositif';
import type { Ctx } from '../asp/contexte';
import { usePositionDirecte } from '../asp/direct';
import { FeuilleExportPdf } from '../asp/ExportPdf';
import { Feuille } from '../asp/Fiche';
import { Ecran, Ligne, Pastilles, Section } from '../asp/kit';
import { messageEnvoi } from '../asp/partage';
import { Champ, PkInput } from '../asp/ui';
import { definirMonPartage, envoyer, useMonPartage } from '../partage/session';
import { GESTES_COMMUNS, GESTES_ROLE } from './gestes';
import {
  ajouterEvenementPoste,
  ajouterTrainPoste,
  codeLibre,
  ecartPa,
  enregistrerPoste,
  etatPoste,
  posteParId,
  retirerDernierTrainPoste,
  retirerEvenementPoste,
  ROLE_CHAINE,
  supprimerPoste,
  titrePoste,
  trainsParPa,
  usePostes,
  type EvenementPoste,
  type Poste,
  type RoleChaine,
} from './poste';
import { Interrupteur } from '../asp/ui';
import { usePrendrePoste } from './prendre';
import { useSession } from '../partage/session';

/** Où je suis par rapport à mon poste, d'après le GPS. */
export function OuJeSuis({ p, actif }: { p: Poste; actif: boolean }) {
  const { etat, pos } = usePositionDirecte(actif && !!p.ligne && p.pk !== null);
  if (!p.ligne || p.pk === null) return null;
  let texte = 'Recherche de ta position…';
  let cls = '';
  if (etat === 'erreur') texte = 'Position indisponible : autorise la localisation pour savoir si tu es à ton poste.';
  else if (etat === 'loin') texte = 'Tu es loin des voies : rapproche-toi de ton poste.';
  else if (pos && pos.code !== p.ligne) {
    texte = `Tu es sur la ligne ${fmtLine(pos.code)}, pas sur celle de ton poste (${fmtLine(p.ligne)}).`;
    cls = 'loin';
  } else if (pos) {
    const d = Math.round(Math.abs(pos.pk - p.pk) * 1000);
    const tol = Math.max(20, Math.round(pos.precision));
    if (d <= tol) {
      texte = `Tu es à ton poste (PK ${fmtPk(pos.pk)}, ± ${Math.round(pos.precision)} m).`;
      cls = 'ok';
    } else {
      texte = `Ton poste est à ${metres(d)}, vers les PK ${p.pk > pos.pk ? 'croissants' : 'décroissants'} (tu es au PK ${fmtPk(pos.pk)}).`;
      cls = 'loin';
    }
  }
  return (
    <p className={`ch-ou ${cls}`} role="status">
      <Icon name="locate" size={18} />
      {texte}
    </p>
  );
}

/** Prise de poste, +1 train, incidents, fin de poste. */
export function ServicePoste({ p, compact, onFin }: { p: Poste; compact?: boolean; onFin?: () => void }) {
  const set = (n: Poste) => enregistrerPoste(n);
  const [noter, setNoter] = useState<EvenementPoste['type'] | null>(null);
  const [vu, setVu] = useState<EvenementPoste | null>(null);
  const h = (t: number) => heureDans(t, p.date);
  const dernier = p.trains[p.trains.length - 1];
  const sens = p.pas.length > 1 ? p.pas.map((x) => x.titre) : [null];
  return (
    <div className="cr-actions ch-service">
      {!p.prise && !p.fin && (
        <button className={`ds-btn primary wide ${compact ? '' : 'big'}`} onClick={() => set({ ...p, prise: Date.now() })}>
          <Icon name="check" size={20} />
          Je suis en place
        </button>
      )}
      {p.prise && !p.fin && (
        <>
          <div className="cr-trains" role="group" aria-label="Noter un train annoncé">
            <span className="cr-compte">
              <b>{p.trains.length}</b> train{p.trains.length > 1 ? 's' : ''} annoncé{p.trains.length > 1 ? 's' : ''}
              {dernier && (
                <button className="ds-btn text" onClick={() => set(retirerDernierTrainPoste(p))} aria-label={`Annuler le dernier train (${h(dernier.t)})`}>
                  Annuler
                </button>
              )}
            </span>
            {sens.map((s) => (
              <button key={s ?? 'train'} className="ds-btn" onClick={() => set(ajouterTrainPoste(p, s))} aria-label={s ? `Train annoncé : ${s}` : 'Train annoncé'}>
                +1 {s ?? 'train annoncé'}
              </button>
            ))}
          </div>
          {!compact && (
            <div className="ds-row cr-noter">
              <button className="ds-btn" onClick={() => setNoter('incident')}>
                <Icon name="alert" size={18} />
                Incident
              </button>
              <button className="ds-btn" onClick={() => setNoter('observation')}>
                <Icon name="message" size={18} />
                Observation
              </button>
            </div>
          )}
          {!compact && (
            <button
              className="ds-btn dark wide"
              onClick={() => {
                if (!window.confirm('Fin de poste ? L’heure est notée, puis tu peux faire ton compte rendu.')) return;
                set({ ...p, fin: Date.now() });
                onFin?.();
              }}
            >
              <Icon name="flag" size={20} />
              Fin de poste
            </button>
          )}
        </>
      )}
      {!compact &&
        p.evenements.map((e) => (
          <Ligne
            key={e.id}
            icon={e.type === 'incident' ? 'alert' : 'message'}
            badgeClass={e.type === 'incident' ? 'danger' : ''}
            title={`${h(e.t)} · ${e.type === 'incident' ? 'Incident' : 'Observation'}`}
            sub={e.texte}
            onClick={() => setVu(e)}
          />
        ))}
      {noter && <FeuilleNoter type={noter} onClose={() => setNoter(null)} onSave={(t) => (set(ajouterEvenementPoste(p, noter, t)), setNoter(null))} />}
      {vu && (
        <Feuille title={`${vu.type === 'incident' ? 'Incident' : 'Observation'} · ${h(vu.t)}`} onClose={() => setVu(null)}>
          <p className="cr-texte">{vu.texte}</p>
          <button className="ds-btn primary wide" onClick={() => setVu(null)}>
            OK
          </button>
          <button className="ds-btn text danger" onClick={() => (set(retirerEvenementPoste(p, vu.id)), setVu(null))}>
            Supprimer
          </button>
        </Feuille>
      )}
    </div>
  );
}

function FeuilleNoter(p: { type: EvenementPoste['type']; onClose: () => void; onSave: (texte: string) => void }) {
  const now = useHorloge();
  const [texte, setTexte] = useState('');
  const hhmm = new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return (
    <Feuille title={p.type === 'incident' ? 'Noter un incident' : 'Noter une observation'} onClose={p.onClose}>
      <div className="asp-field">
        <label htmlFor="ch-evt">{p.type === 'incident' ? 'Ce qui s’est passé' : 'Observation'}</label>
        <textarea
          id="ch-evt"
          className="sig-comment"
          rows={3}
          value={texte}
          placeholder={p.type === 'incident' ? 'Ex. : perdu la vue de la sentinelle S1 pendant 2 min (brouillard)' : 'Ex. : vent fort, l’ASP a refait l’essai d’audibilité'}
          onChange={(e) => setTexte(e.target.value)}
        />
      </div>
      <button className="ds-btn primary wide" disabled={!texte.trim()} onClick={() => p.onSave(texte)}>
        Noter à {hhmm}
      </button>
    </Feuille>
  );
}

/** Mon poste : tout ce qu'il faut sur place. */
export function PosteScreen({ id, hidden, ctx }: { id: string; hidden?: boolean; ctx: Ctx }) {
  usePostes();
  const p = posteParId(id);
  const now = useHorloge();
  const moi = useMonPartage();
  const session = useSession();
  const [pdf, setPdf] = useState(false);
  if (!p) return null;
  const e = etatPoste(p, now);
  const parPa = trainsParPa(p);
  const partage = moi?.actif && moi.activite === 'chaine' && moi.id === p.id;
  return (
    <Ecran label={`Mon poste : ${titrePoste(p)}`} title={`${ROLE_CHAINE[p.role]} ${p.code}`} onBack={ctx.back} hidden={hidden}>
      <section className={`ds-hero ch-hero ${e.niveau}`} aria-label="Mon poste">
        <div className="ds-hero-top">
          <span className="ds-tag">
            {ROLE_CHAINE[p.role]} {p.code} · {p.horaire === 'nuit' ? 'nuit' : 'jour'}
          </span>
          <span className={`ds-status ${e.niveau === 'en-place' ? 'ok' : 'todo'}`}>{e.texte}</span>
        </div>
        <h2>{p.chantier || 'Chantier'}</h2>
        <div className="ds-hero-sub">{[p.ligne ? `Ligne ${fmtLine(p.ligne)}` : null, p.pk !== null ? `Mon PK ${fmtPk(p.pk)}` : 'PK à indiquer'].filter(Boolean).join(' · ')}</div>
        <OuJeSuis p={p} actif={!hidden} />
        <ServicePoste p={p} onFin={() => setPdf(true)} />
      </section>

      <Section title="Ce que je surveille">
        {p.surveille && <Ligne icon="tracks" title={p.surveille} sub="Voies et sens que j’annonce" chevron={false} />}
        {p.pas.map((pa) => {
          const d = ecartPa(p, pa);
          return (
            <Ligne
              key={pa.titre}
              icon="flag"
              badgeClass="brand"
              title={d === null ? `${pa.titre} · PK ${fmtPk(pa.pk)}` : d <= 5 ? `${pa.titre} : je suis au point d’annonce` : `Je dois voir jusqu’au PK ${fmtPk(pa.pk)} (${pa.titre})`}
              sub={d !== null && d > 5 ? `${metres(d)} à voir : à vérifier sur place` : `PK ${fmtPk(pa.pk)}`}
              onClick={p.ligne ? () => ctx.onGoPk(p.ligne!, pa.pk) : undefined}
            />
          );
        })}
        {!p.pas.length && !p.surveille && <p className="ds-hint">Demande à ton ASP ce que tu surveilles et ton point d’annonce, puis complète ton poste.</p>}
      </Section>

      <Section title="Mon ASP">
        <Ligne icon="vest" badgeClass="navy" title={p.asp || 'ASP'} sub={p.lien ? 'Poste pris dans sa chaîne (chantier partagé)' : 'Saisi à la main'} chevron={false} />
        {p.aspTel && (
          <a className="ds-btn primary wide ch-appeler" href={`tel:${p.aspTel.replace(/[^0-9+]/g, '')}`}>
            <Icon name="phone" size={20} />
            Appeler mon ASP · {p.aspTel}
          </a>
        )}
        {session && (
          <div className="ds-row">
            <Interrupteur
              checked={!!partage}
              onChange={(on) => {
                if (on) definirMonPartage({ actif: true, activite: 'chaine', id: p.id, nom: moi?.nom ?? '', tel: moi?.tel ?? '' });
                else {
                  if (moi) definirMonPartage({ ...moi, actif: false });
                  void envoyer(null).catch(() => undefined);
                }
              }}
              label="Partager mon poste"
              hint={p.lien ? 'Ton ASP voit si tu es en place' : 'Visible par les intervenants du chantier partagé'}
            />
          </div>
        )}
      </Section>

      <Section title="Mon service">
        <Ligne icon="clock" title="Prise de poste" end={p.prise ? heureDans(p.prise, p.date) : '—'} chevron={false} />
        <Ligne icon="flag" title="Fin de poste" end={p.fin ? heureDans(p.fin, p.date) : '—'} chevron={false} />
        <Ligne icon="train" title={`Trains annoncés : ${p.trains.length}`} sub={parPa.map((x) => `${x.nom} : ${x.heures.length}`).join(' · ') || undefined} chevron={false} />
        <Ligne icon="file" title="Compte rendu de poste en PDF" sub="Poste, horaires, trains, incidents, signatures" onClick={() => setPdf(true)} />
      </Section>

      <Section title="Pour m’aider">
        <Ligne icon="book" title="Mes gestes et signaux" sub={`Fiche réflexe ${ROLE_CHAINE[p.role].toLowerCase()}`} onClick={() => ctx.open({ k: 'gestes', role: p.role })} />
        {p.ligne && p.pk !== null && <Ligne icon="map" title="Mon poste sur la carte" onClick={() => ctx.onGoPk(p.ligne!, p.pk!)} />}
        <Ligne icon="edit" title="Modifier mon poste" onClick={() => ctx.open({ k: 'poste-edit', id: p.id })} />
        <Ligne
          icon="trash"
          title="Supprimer ce poste"
          onClick={() => {
            if (!window.confirm('Supprimer ce poste et son service ?')) return;
            supprimerPoste(p.id);
            ctx.back();
          }}
        />
      </Section>
      <p className="ds-foot">Aide sur place, jamais une référence de sécurité : les consignes de l’ASP, la fiche CADA et les consignes locales priment.</p>

      {pdf && (
        <FeuilleExportPdf
          titre={`Compte rendu · ${titrePoste(p)}`}
          docId={`${p.id}:cr`}
          defautNom=""
          second={{ titre: 'ASP', defautNom: p.asp }}
          intro={p.fin ? 'Compte rendu de ton poste, créé sur le téléphone. Ton ASP peut signer ici aussi.' : 'Le poste n’est pas encore fini : la fin de poste restera « non notée ».'}
          preparer={async () => {
            const { compteRenduPostePdf } = await import('./pdf');
            return (info) => compteRenduPostePdf(posteParId(p.id) ?? p, info);
          }}
          onClose={() => setPdf(false)}
          onFini={(envoi) => {
            setPdf(false);
            ctx.onToast(messageEnvoi(envoi));
          }}
        />
      )}
    </Ecran>
  );
}

/** Saisir ou modifier son poste. */
export function PosteEdit({ id, nouveau, hidden, ctx }: { id: string; nouveau?: boolean; hidden?: boolean; ctx: Ctx }) {
  const postes = usePostes();
  const base = posteParId(id);
  const [p, setP] = useState<Poste | null>(base);
  const prendre = usePrendrePoste();
  if (!p) return null;
  const set = (patch: Partial<Poste>) => setP({ ...p, ...patch });
  const pris = postes.filter((x) => x.id !== p.id && !x.fin).map((x) => x.code);
  const enregistrer = () => {
    enregistrerPoste({ ...p, brouillon: false });
    if (nouveau) {
      ctx.back();
      ctx.open({ k: 'poste', id: p.id });
    } else ctx.back();
  };
  return (
    <Ecran
      label={nouveau ? 'Nouveau poste' : 'Modifier mon poste'}
      title={nouveau ? 'Nouveau poste' : 'Modifier mon poste'}
      backIcon="close"
      onBack={() => {
        if (nouveau && base?.brouillon) supprimerPoste(p.id);
        ctx.back();
      }}
      hidden={hidden}
      actions={
        <button className="ds-btn primary big wide" onClick={enregistrer}>
          {nouveau ? 'Prendre ce poste' : 'Enregistrer'}
        </button>
      }
    >
      {nouveau && prendre.chaines.length > 0 && (
        <Section title="Dans la chaîne de ton ASP">
          <p className="ds-hint">Ton ASP partage sa chaîne : prends ton poste dedans, ton PK et ce que tu dois voir viennent de lui.</p>
          {prendre.boutons((poste) => {
            if (base?.brouillon) supprimerPoste(p.id);
            ctx.back();
            ctx.open({ k: 'poste', id: poste.id });
          })}
        </Section>
      )}
      <Section title="Mon rôle">
        <div className="ds-row">
          <Pastilles
            label="Rôle dans la chaîne"
            big
            value={p.role}
            options={(Object.keys(ROLE_CHAINE) as RoleChaine[]).map((r) => [r, ROLE_CHAINE[r]])}
            onChange={(role) => set({ role, code: /^[ARS]\d+$/.test(p.code) ? codeLibre(role, pris) : p.code })}
          />
        </div>
        <div className="ds-fields">
          <Champ label="Mon code dans la chaîne" value={p.code} placeholder="A1" onChange={(code) => set({ code: code.toUpperCase().slice(0, 4) })} />
          <Champ label="Chantier" value={p.chantier} placeholder="Ex. : Remplacement traverses" onChange={(chantier) => set({ chantier })} />
        </div>
      </Section>
      <Section title="Où je suis">
        {ctx.here && (
          <div className="ds-row">
            <button className="ds-btn wide" onClick={() => set({ ligne: ctx.here!.code, ligneNom: ctx.here!.ligneNom, pk: ctx.here!.pk })}>
              <Icon name="locate" size={20} />
              Ma position : ligne {fmtLine(ctx.here.code)}, PK {fmtPk(ctx.here.pk)}
            </button>
          </div>
        )}
        <div className="ds-fields">
          <Champ label="Ligne (code à 6 chiffres)" value={p.ligne ?? ''} inputMode="numeric" placeholder="830000" onChange={(v) => set({ ligne: v.replace(/\D/g, '').slice(0, 6) || null })} />
          <PkInput label="Mon PK" value={p.pk} onChange={(pk) => set({ pk })} />
        </div>
      </Section>
      <Section title="Ce que je surveille">
        <div className="ds-fields">
          <Champ label="Voies et sens" value={p.surveille} placeholder="Ex. : V1 ▲ (vers les PK croissants)" onChange={(surveille) => set({ surveille })} />
          <PkInput
            label="Je dois voir jusqu’au PK (point d’annonce)"
            value={p.pas[0]?.pk ?? null}
            onChange={(pk) => set({ pas: pk === null ? [] : [{ titre: p.pas[0]?.titre ?? 'PA', pk }, ...p.pas.slice(1)] })}
          />
        </div>
      </Section>
      <Section title="Mon ASP">
        <div className="ds-fields">
          <Champ label="Nom de l’ASP" value={p.asp} placeholder="Prénom NOM" onChange={(asp) => set({ asp })} />
          <Champ label="Téléphone de l’ASP" value={p.aspTel} type="tel" inputMode="tel" placeholder="06 12 34 56 78" onChange={(aspTel) => set({ aspTel: aspTel.replace(/[^0-9+ .]/g, '').slice(0, 20) })} />
        </div>
      </Section>
    </Ecran>
  );
}

/** Mes gestes et signaux : fiche réflexe du rôle, puis ce qui vaut pour tous. */
export function GestesScreen({ role, hidden, ctx }: { role?: RoleChaine; hidden?: boolean; ctx: Ctx }) {
  const [r, setR] = useState<RoleChaine>(role ?? 'annonceur');
  return (
    <Ecran label="Mes gestes et signaux" title="Gestes et signaux" onBack={ctx.back} hidden={hidden}>
      <div className="ds-row">
        <Pastilles label="Rôle" value={r} options={(Object.keys(ROLE_CHAINE) as RoleChaine[]).map((x) => [x, ROLE_CHAINE[x]])} onChange={setR} />
      </div>
      {[...GESTES_ROLE[r], ...GESTES_COMMUNS].map((b) => (
        <Section key={b.titre} title={b.titre}>
          <ul className={`ch-gestes ${b.important ? 'important' : ''}`}>
            {b.points.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Section>
      ))}
      <p className="ds-foot">D’après le mémo de l’appli (annonce, dispositif, bruit, signalisation). Les consignes de ton ASP, la fiche CADA et les consignes locales priment.</p>
    </Ecran>
  );
}
