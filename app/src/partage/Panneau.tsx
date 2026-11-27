/**
 * Chantier partagé, côté intervenant : rejoindre avec le code chantier, partager son chantier ou sa mission d'un
 * interrupteur (avec son nom et son téléphone), voir qui partage quoi, l'appeler, le retrouver sur la carte.
 */
import { useState } from 'react';
import { loadAccess } from '../access/gate';
import { chantierDuJour } from '../asp/etat';
import { titreChantier } from '../asp/chantier';
import type { Ctx } from '../asp/contexte';
import { useActif, useChantiers } from '../asp/store';
import { Interrupteur } from '../asp/ui';
import { Icon } from '../components/parts';
import { missionLamDuJour, titreMissionLam, useMissionsLam } from '../lam/mission';
import { nomAgent } from '../lib/signature';
import { useHorloge } from '../pn/horloge';
import { missionDuJour, titreMission, useMissions } from '../pn/mission';
import { posteDuJour, titrePoste, usePostes } from '../chaine/poste';
import { ACTIVITE_LABEL, centreDe, depuis } from './donnees';
import {
  cleanSession,
  definirMonPartage,
  envoyer,
  formatSession,
  monAppareil,
  quitter,
  RAISON_TEXTE,
  rejoindre,
  useMonPartage,
  usePartages,
  useSession,
  type Activite,
} from './session';
import { useEnvoi } from './suivi';

const CE_QUE: Record<Activite, string> = { asp: 'mon chantier', pn: 'ma mission PN', lam: 'ma mission LAM / S9', chaine: 'mon poste' };

/** Le chantier ou la mission que ce téléphone peut partager, pour l'activité choisie. */
function useAPartager(activite: Activite): { id: string; titre: string } | null {
  const chantiers = useChantiers();
  const actif = useActif();
  const missions = useMissions();
  const lams = useMissionsLam();
  const postes = usePostes();
  if (activite === 'chaine') {
    const p = posteDuJour(postes);
    return p ? { id: p.id, titre: titrePoste(p) } : null;
  }
  if (activite === 'asp') {
    const c = chantierDuJour(chantiers, actif);
    return c ? { id: c.id, titre: titreChantier(c) } : null;
  }
  if (activite === 'pn') {
    const m = missionDuJour(missions);
    return m ? { id: m.id, titre: titreMission(m) } : null;
  }
  const m = missionLamDuJour(lams);
  return m ? { id: m.id, titre: titreMissionLam(m) } : null;
}

/** Titre de ce qui est partagé (il peut venir d'une autre activité que celle de l'accueil). */
function useTitrePartage(): string | null {
  const moi = useMonPartage();
  const chantiers = useChantiers();
  const missions = useMissions();
  const lams = useMissionsLam();
  const postes = usePostes();
  if (!moi?.actif) return null;
  if (moi.activite === 'chaine') {
    const p = postes.find((x) => x.id === moi.id);
    return p ? titrePoste(p) : null;
  }
  if (moi.activite === 'asp') {
    const c = chantiers.find((x) => x.id === moi.id);
    return c ? titreChantier(c) : null;
  }
  if (moi.activite === 'pn') {
    const m = missions.find((x) => x.id === moi.id);
    return m ? titreMission(m) : null;
  }
  const m = lams.find((x) => x.id === moi.id);
  return m ? titreMissionLam(m) : null;
}

export function PanneauPartage(p: { ctx: Ctx; activite: Activite; onVoir?: (at: [number, number]) => void }) {
  const session = useSession();
  return session ? <Session ctx={p.ctx} activite={p.activite} onVoir={p.onVoir} /> : <Rejoindre ctx={p.ctx} />;
}

function Rejoindre({ ctx }: { ctx: Ctx }) {
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const ok = cleanSession(code).length === 6;
  return (
    <form
      className="pt-rejoindre"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        setEnvoi(true);
        setErreur(null);
        rejoindre(code).then(
          (raison) => {
            setEnvoi(false);
            if (raison) setErreur(RAISON_TEXTE[raison]);
            else ctx.onToast('Chantier partagé rejoint.');
          },
          () => {
            setEnvoi(false);
            setErreur('Pas de réseau : réessaie dans un moment.');
          },
        );
      }}
    >
      <p className="ds-hint">
        L’administrateur crée un chantier partagé et donne son code aux intervenants (ASP, agent PN, AP LAM / S9). Ceux qui l’ont rejoint voient sur leur
        carte ce que chacun choisit de partager.
      </p>
      <div className="asp-field">
        <label htmlFor="pt-code">Code chantier</label>
        <input
          id="pt-code"
          className="asp-input pt-code"
          value={formatSession(code)}
          placeholder="K7P-3QX"
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          onChange={(e) => setCode(cleanSession(e.target.value))}
        />
      </div>
      {erreur && (
        <p className="ds-hint error" role="alert">
          {erreur}
        </p>
      )}
      <button className="ds-btn primary wide" disabled={!ok || envoi}>
        {envoi ? 'Vérification…' : 'Rejoindre le chantier'}
      </button>
    </form>
  );
}

function Session({ ctx, activite, onVoir }: { ctx: Ctx; activite: Activite; onVoir?: (at: [number, number]) => void }) {
  const session = useSession()!;
  const moi = useMonPartage();
  const { partages, lu, erreur } = usePartages();
  const envoi = useEnvoi();
  const now = useHorloge();
  const aPartager = useAPartager(activite);
  const titrePartage = useTitrePartage();
  const autres = partages.filter((x) => x.appareil !== monAppareil());
  const nomDefaut = moi?.nom || nomAgent() || loadAccess()?.nom || '';

  const basculer = (on: boolean) => {
    if (on) {
      if (!aPartager) return;
      definirMonPartage({ actif: true, activite, id: aPartager.id, nom: moi?.nom || nomDefaut, tel: moi?.tel ?? '' });
      ctx.onToast(`Partagé : les intervenants du chantier voient ${CE_QUE[activite].replace(/^m(on|a) /, (x) => (x === 'mon ' ? 'ton ' : 'ta '))} sur leur carte.`);
    } else {
      if (moi) definirMonPartage({ ...moi, actif: false });
      void envoyer(null).catch(() => undefined);
      ctx.onToast('Partage arrêté : les autres ne te voient plus.');
    }
  };

  return (
    <div className="pt-session">
      <div className="pt-tete">
        <span className="ds-tag">Chantier partagé · {formatSession(session.code)}</span>
        <h2>{session.nom}</h2>
        <small>
          Jusqu’au {new Date(session.fin).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </small>
      </div>

      {moi?.actif ? (
        <>
          <Interrupteur
            checked
            onChange={basculer}
            label={`Je partage ${CE_QUE[moi.activite]}`}
            hint={`${titrePartage ?? 'Introuvable'} · ${envoi.erreur ?? (envoi.t ? `envoyé ${depuis(envoi.t, now)}` : 'envoi…')}`}
          />
          <div className="pt-moi">
            <div className="asp-field">
              <label htmlFor="pt-nom">Mon nom</label>
              <input id="pt-nom" className="asp-input" value={moi.nom} placeholder="Prénom NOM" onChange={(e) => definirMonPartage({ ...moi, nom: e.target.value.slice(0, 60) })} />
            </div>
            <div className="asp-field">
              <label htmlFor="pt-tel">Mon téléphone</label>
              <input
                id="pt-tel"
                className="asp-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={moi.tel}
                placeholder="06 12 34 56 78"
                onChange={(e) => definirMonPartage({ ...moi, tel: e.target.value.replace(/[^0-9+ .]/g, '').slice(0, 20) })}
              />
            </div>
          </div>
        </>
      ) : aPartager ? (
        <Interrupteur checked={false} onChange={basculer} label={`Partager ${CE_QUE[activite]}`} hint={`${aPartager.titre} : visible par les intervenants de ce chantier`} />
      ) : (
        <p className="ds-hint">{activite === 'chaine' ? 'Prends d’abord ton poste (ci-dessous) pour le partager.' : `Crée d’abord ${CE_QUE[activite].replace(/^mon /, 'ton ').replace(/^ma /, 'ta ')} pour pouvoir la partager.`.replace(/ton (chantier) pour pouvoir la/, 'ton $1 pour pouvoir le')}</p>
      )}

      <div className="pt-liste" aria-label="Intervenants qui partagent">
        {!autres.length && <p className="ds-hint">{lu ? 'Personne d’autre ne partage pour l’instant.' : 'Lecture du chantier partagé…'}</p>}
        {autres.map((x) => {
          const centre = centreDe(x);
          return (
            <div key={x.appareil} className={`pt-autre ${x.donnees.niveau}`}>
              <span className={`pt-badge ${x.activite}`}>{x.activite === 'asp' ? 'ASP' : x.activite === 'pn' ? 'PN' : x.activite === 'lam' ? 'LAM' : (x.donnees.lien?.code ?? 'Chaîne')}</span>
              <div className="pt-texte">
                <b>
                  {x.nom || 'Sans nom'} · {x.donnees.titre}
                </b>
                <span className="pt-etat">{x.donnees.etat}</span>
                <small>
                  {ACTIVITE_LABEL[x.activite]} · mis à jour {depuis(x.maj, now)}
                </small>
              </div>
              <div className="pt-actions">
                {centre && onVoir && (
                  <button className="ds-btn" onClick={() => onVoir(centre)} aria-label={`Voir ${x.nom || 'l’intervenant'} sur la carte`}>
                    <Icon name="map" size={18} />
                  </button>
                )}
                {x.tel && (
                  <a className="ds-btn primary" href={`tel:${x.tel.replace(/[^0-9+]/g, '')}`} aria-label={`Appeler ${x.nom || 'l’intervenant'}`}>
                    <Icon name="phone" size={18} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {erreur && <p className="ds-hint error">{erreur}</p>}
      <p className="ds-hint pt-avertir">Information entre intervenants, à titre indicatif : les dépêches, l’AAn et les annonces font foi.</p>
      <button
        className="ds-btn text"
        onClick={() => {
          if (!window.confirm('Quitter ce chantier partagé ? Ce que tu partages sera retiré.')) return;
          void quitter();
        }}
      >
        Quitter le chantier partagé
      </button>
    </div>
  );
}
