/**
 * Noter une dépêche : avec qui, l'objet, le numéro reçu et le numéro donné. L'appli propose un numéro pris au hasard,
 * sans suite avec ceux déjà échangés ; on peut en tirer un autre ou l'écrire soi-même.
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import { Feuille } from '../asp/Fiche';
import { Pastilles } from '../asp/kit';
import { Champ } from '../asp/ui';
import { useHorloge } from '../pn/horloge';
import { heure, INTERLOCUTEURS, numeroLibre, proposerNumero, type Depeche, type Interlocuteur } from './mission';

export function FeuilleDepeche(p: {
  objet: string;
  avec: Interlocuteur;
  utilises: string[];
  onSave: (d: Omit<Depeche, 'id' | 't'>) => void;
  onClose: () => void;
}) {
  const [objet, setObjet] = useState(p.objet);
  const [avec, setAvec] = useState<Interlocuteur>(p.avec);
  const [recu, setRecu] = useState('');
  const [donne, setDonne] = useState(() => proposerNumero(p.utilises));
  const [aLaMain, setALaMain] = useState(false);
  const now = useHorloge();
  const autre = () => {
    setALaMain(false);
    setDonne(proposerNumero([...p.utilises, recu, donne]));
  };
  const chiffres = (v: string) => v.replace(/\D/g, '').slice(0, 3);
  // Le numéro reçu arrive après la proposition : si elle lui fait suite, on en propose une autre (sauf numéro écrit à la main).
  const changerRecu = (v: string) => {
    const r = chiffres(v);
    setRecu(r);
    if (!aLaMain && r && !numeroLibre(donne, [...p.utilises, r])) setDonne(proposerNumero([...p.utilises, r]));
  };
  return (
    <Feuille title="Dépêche" onClose={p.onClose}>
      <p className="ds-hint" style={{ marginTop: 0 }}>
        Fais tout répéter, même le préimprimé ; si c’est correct, échangez les numéros.
      </p>
      <span className="ds-label">Avec</span>
      <Pastilles label="Avec" value={avec} options={INTERLOCUTEURS.map((x) => [x, x])} onChange={setAvec} />
      <div className="ds-fields" style={{ marginTop: 14 }}>
        <Champ label="Objet" value={objet} onChange={setObjet} />
        <Champ label="N° reçu" value={recu} inputMode="numeric" placeholder="93" onChange={changerRecu} />
      </div>
      <div className="ds-numero" aria-live="polite">
        <span>
          <small>N° que tu donnes</small>
          <input
            className="ds-numero-val"
            aria-label="N° que tu donnes"
            inputMode="numeric"
            value={donne}
            onChange={(e) => {
              setALaMain(true);
              setDonne(chiffres(e.target.value));
            }}
          />
        </span>
        <button type="button" className="ds-btn" onClick={autre}>
          <Icon name="sparkle" size={18} />
          Autre numéro
        </button>
      </div>
      <p className="ds-hint">Pris au hasard, sans suite avec le numéro reçu ni ceux déjà échangés dans cette mission.</p>
      <button
        className="ds-btn primary big wide"
        disabled={!objet.trim()}
        onClick={() => p.onSave({ avec, objet: objet.trim(), recu: recu.trim(), donne: donne.trim() })}
      >
        <Icon name="check" size={22} />
        Noter la dépêche à {heure(now)}
      </button>
    </Feuille>
  );
}
