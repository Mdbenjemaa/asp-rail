/**
 * Le jour de l'intervention : un bouton pour le prochain moment (arrivée, dispositif en place, début et fin des
 * travaux, dispositif levé), les trains annoncés d'un toucher, les incidents et observations. Quand le dispositif
 * est levé, le compte rendu est proposé (PDF ou message).
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import { duree, heureDans } from '../lib/temps';
import { useHorloge } from '../pn/horloge';
import type { Chantier } from './chantier';
import {
  aHeure,
  ajouterEvenementCr,
  ajouterTrain,
  durees,
  effacerJalon,
  etatIntervention,
  finie,
  JALONS,
  nomSens,
  noterJalon,
  prochainJalon,
  referenceHeure,
  retirerDernierTrain,
  retirerEvenementCr,
  trainsParSens,
  type Deroule,
  type EvenementCr,
  type JalonId,
} from './deroule';
import { Feuille } from './Fiche';
import { Ligne, Section } from './kit';
import type { Resultat } from './rules';

const deux = (n: number) => String(n).padStart(2, '0');
const hhmm = (t: number) => `${deux(new Date(t).getHours())}:${deux(new Date(t).getMinutes())}`;

/** Le déroulé change : enregistré tout de suite ; « Dispositif levé » ouvre la fin de l'intervention. */
type Changer = (d: Deroule, fin?: boolean) => void;

/** Bouton du prochain moment et boutons « +1 train », partagés par la fiche et l'accueil. */
function Actions(p: { c: Chantier; r: Resultat; changer: Changer; compact?: boolean }) {
  const d = p.c.deroule;
  const suivant = prochainJalon(d);
  const sens = p.r.voies.map((v) => `${v.voieId}:${v.sens}`);
  const enCours = !!(d.jalons.enPlace || d.jalons.arrivee) && !finie(d);
  return (
    <>
      {suivant && (
        <button
          className={`ds-btn primary ${p.compact ? 'wide' : 'big wide'}`}
          onClick={() => p.changer(noterJalon(d, suivant.id, Date.now()), suivant.id === 'leve')}
        >
          <Icon name={suivant.id === 'leve' ? 'check' : 'clock'} size={20} />
          {suivant.bouton}
        </button>
      )}
      {enCours && sens.length > 0 && (
        <div className="cr-trains" role="group" aria-label="Noter un train annoncé">
          <span className="cr-compte">
            <b>{d.trains.length}</b> train{d.trains.length > 1 ? 's' : ''} annoncé{d.trains.length > 1 ? 's' : ''}
          </span>
          {sens.map((k) => (
            <button key={k} className="ds-btn" onClick={() => p.changer(ajouterTrain(d, k, Date.now()))} aria-label={`Train annoncé sur ${nomSens(p.c, k)}`}>
              +1 {nomSens(p.c, k)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** Dans la fiche du chantier : le déroulé complet. */
export function SectionIntervention(p: { c: Chantier; r: Resultat; changer: Changer; onCompteRendu: () => void }) {
  const now = useHorloge();
  const d = p.c.deroule;
  const [jalon, setJalon] = useState<JalonId | null>(null);
  const [nouvel, setNouvel] = useState<EvenementCr['type'] | null>(null);
  const [vu, setVu] = useState<EvenementCr | null>(null);
  const h = (t: number) => heureDans(t, p.c.date);
  const dernier = d.trains[d.trains.length - 1];
  const parSens = trainsParSens(p.c, p.r, d);
  return (
    <Section title="Intervention" action={<span className={`ds-status ${finie(d) ? 'ok' : 'todo'}`}>{etatIntervention(p.c, now)}</span>}>
      <div className="cr-actions">
        <Actions c={p.c} r={p.r} changer={p.changer} />
        {prochainJalon(d)?.aide && <p className="ds-hint">{prochainJalon(d)!.aide}</p>}
      </div>
      {JALONS.map((j) => (
        <Ligne
          key={j.id}
          icon={d.jalons[j.id] ? 'check' : 'clock'}
          badgeClass={d.jalons[j.id] ? 'brand' : ''}
          title={j.titre}
          end={d.jalons[j.id] ? h(d.jalons[j.id]!) : '—'}
          endClass={d.jalons[j.id] ? 'ok' : ''}
          onClick={() => setJalon(j.id)}
          label={`${j.titre} : ${d.jalons[j.id] ? `noté à ${h(d.jalons[j.id]!)}, modifier` : 'noter une heure'}`}
        />
      ))}
      {(d.trains.length > 0 || d.jalons.arrivee || d.jalons.enPlace) && (
        <Ligne
          icon="train"
          title={`Trains annoncés : ${d.trains.length}`}
          sub={parSens.length ? parSens.map((x) => `${x.nom} : ${x.heures.length}`).join(' · ') : 'Touche « +1 » à chaque annonce'}
          end={
            dernier ? (
              <button className="ds-btn text" onClick={() => p.changer(retirerDernierTrain(d))} aria-label={`Annuler le dernier train (${h(dernier.t)})`}>
                Annuler
              </button>
            ) : undefined
          }
          chevron={false}
        />
      )}
      {d.evenements.map((e) => (
        <Ligne
          key={e.id}
          icon={e.type === 'incident' ? 'alert' : 'message'}
          badgeClass={e.type === 'incident' ? 'danger' : ''}
          title={`${h(e.t)} · ${e.type === 'incident' ? 'Incident' : 'Observation'}`}
          sub={e.texte}
          onClick={() => setVu(e)}
        />
      ))}
      <div className="ds-row cr-noter">
        <button className="ds-btn" onClick={() => setNouvel('incident')}>
          <Icon name="alert" size={18} />
          Incident
        </button>
        <button className="ds-btn" onClick={() => setNouvel('observation')}>
          <Icon name="message" size={18} />
          Observation
        </button>
      </div>
      <Ligne
        icon="file"
        title="Compte rendu en PDF"
        sub={finie(d) ? 'Horaires, dispositif, trains, incidents, signatures' : 'Possible à tout moment ; complet une fois le dispositif levé'}
        onClick={p.onCompteRendu}
      />

      {jalon && (
        <FeuilleJalon
          key={jalon}
          id={jalon}
          d={d}
          onClose={() => setJalon(null)}
          onSave={(nd) => {
            p.changer(nd, jalon === 'leve' && !d.jalons.leve && !!nd.jalons.leve);
            setJalon(null);
          }}
        />
      )}
      {nouvel && (
        <FeuilleEvenement
          type={nouvel}
          onClose={() => setNouvel(null)}
          onSave={(texte) => {
            p.changer(ajouterEvenementCr(d, nouvel, texte, Date.now()));
            setNouvel(null);
          }}
        />
      )}
      {vu && (
        <Feuille title={`${vu.type === 'incident' ? 'Incident' : 'Observation'} · ${h(vu.t)}`} onClose={() => setVu(null)}>
          <p className="cr-texte">{vu.texte}</p>
          <button className="ds-btn primary wide" onClick={() => setVu(null)}>
            OK
          </button>
          <button
            className="ds-btn text danger"
            onClick={() => {
              p.changer(retirerEvenementCr(d, vu.id));
              setVu(null);
            }}
          >
            Supprimer
          </button>
        </Feuille>
      )}
    </Section>
  );
}

/** Heure d'un moment : la noter maintenant, la corriger, ou l'effacer. */
function FeuilleJalon(p: { id: JalonId; d: Deroule; onClose: () => void; onSave: (d: Deroule) => void }) {
  const j = JALONS.find((x) => x.id === p.id)!;
  const deja = p.d.jalons[p.id];
  const now = useHorloge();
  const [valeur, setValeur] = useState(() => hhmm(deja ?? Date.now()));
  const t = aHeure(valeur, referenceHeure(p.d, p.id, now));
  return (
    <Feuille title={j.titre} onClose={p.onClose}>
      <div className="asp-field">
        <label htmlFor="cr-heure">Heure</label>
        <input id="cr-heure" className="cr-heure" type="time" value={valeur} onChange={(e) => setValeur(e.target.value)} />
      </div>
      <button className="ds-btn primary wide" disabled={t === null} onClick={() => t !== null && p.onSave(noterJalon(p.d, p.id, t))}>
        Enregistrer {valeur}
      </button>
      {!deja && (
        <button className="ds-btn wide" onClick={() => p.onSave(noterJalon(p.d, p.id, Date.now()))}>
          Noter maintenant
        </button>
      )}
      {deja && (
        <button className="ds-btn text danger" onClick={() => p.onSave(effacerJalon(p.d, p.id))}>
          Effacer cette heure
        </button>
      )}
    </Feuille>
  );
}

function FeuilleEvenement(p: { type: EvenementCr['type']; onClose: () => void; onSave: (texte: string) => void }) {
  const now = useHorloge();
  const [texte, setTexte] = useState('');
  return (
    <Feuille title={p.type === 'incident' ? 'Noter un incident' : 'Noter une observation'} onClose={p.onClose}>
      <div className="asp-field">
        <label htmlFor="cr-evt">{p.type === 'incident' ? 'Ce qui s’est passé' : 'Observation'}</label>
        <textarea
          id="cr-evt"
          className="sig-comment"
          rows={3}
          value={texte}
          placeholder={p.type === 'incident' ? 'Ex. : annonce mal perçue sur V2, travaux arrêtés 5 min' : 'Ex. : visite du dirigeant, pluie, retard de l’équipe'}
          onChange={(e) => setTexte(e.target.value)}
        />
      </div>
      <button className="ds-btn primary wide" disabled={!texte.trim()} onClick={() => p.onSave(texte)}>
        Noter à {hhmm(now)}
      </button>
    </Feuille>
  );
}

/** Le dispositif est levé : ce qu'il s'est passé, et le compte rendu. */
export function FeuilleFinie(p: { c: Chantier; r: Resultat; onPdf: () => void; onTexte: () => void; onClose: () => void; onCloturer?: () => void }) {
  const d = p.c.deroule;
  const parSens = trainsParSens(p.c, p.r, d);
  const incidents = d.evenements.filter((e) => e.type === 'incident').length;
  return (
    <Feuille title="Intervention finie" onClose={p.onClose}>
      <dl className="facts">
        {durees(d).map((x) => (
          <div key={x.titre} className="cr-fait">
            <dt>{x.titre}</dt>
            <dd>{duree(x.ms)}</dd>
          </div>
        ))}
        <div className="cr-fait">
          <dt>Trains annoncés</dt>
          <dd>{d.trains.length ? `${d.trains.length} (${parSens.map((x) => `${x.nom} : ${x.heures.length}`).join(', ')})` : 'Aucun noté'}</dd>
        </div>
        <div className="cr-fait">
          <dt>Incidents</dt>
          <dd>{incidents || 'Aucun'}</dd>
        </div>
      </dl>
      {p.onCloturer && (
        <button className="ds-btn primary big wide" onClick={p.onCloturer}>
          <Icon name="check" size={22} />
          Clôturer la mission
        </button>
      )}
      <button className={`ds-btn ${p.onCloturer ? '' : 'primary big '}wide`} onClick={p.onPdf}>
        <Icon name="file" size={22} />
        Compte rendu en PDF
      </button>
      <button className="ds-btn wide" onClick={p.onTexte}>
        <Icon name="message" size={20} />
        Compte rendu par message
      </button>
      <button className="ds-btn text" onClick={p.onClose}>
        Plus tard
      </button>
    </Feuille>
  );
}

/** Sur l'accueil : le prochain moment et les trains, sans ouvrir la fiche ; une fois fini, le compte rendu. */
export function InterventionRapide(p: { c: Chantier; r: Resultat; changer: Changer; onCompteRendu: () => void }) {
  const now = useHorloge();
  const d = p.c.deroule;
  if (finie(d)) {
    return (
      <div className="cr-rapide">
        <span className="ds-status ok">{etatIntervention(p.c, now)}</span>
        <button className="ds-btn primary wide" onClick={p.onCompteRendu}>
          <Icon name="file" size={20} />
          Compte rendu en PDF
        </button>
      </div>
    );
  }
  return (
    <div className="cr-rapide">
      {Object.keys(d.jalons).length > 0 && <span className="ds-status todo">{etatIntervention(p.c, now)}</span>}
      <Actions c={p.c} r={p.r} changer={p.changer} compact />
    </div>
  );
}
