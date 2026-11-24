/** Réglage fin d'une voie : nom, sens, place, vitesse, interdiction. */
import type { Voie } from './rules';
import { ROLES_VOIE } from './textes';
import { Choix, Interrupteur, Nombre } from './ui';

const SENS_OPTIONS: [Voie['sens'], string][] = [
  ['croissant', '▲ PK croissants'],
  ['decroissant', '▼ PK décroissants'],
  ['deux', '▲▼ 2 sens'],
];

export function VoieCard(p: { v: Voie; suggestion: number | null; onChange: (v: Voie) => void; onRemove: () => void; seule: boolean }) {
  const { v } = p;
  return (
    <div className={`asp-voie ${v.interdite ? 'interdite' : ''} ${v.role === 'hors' ? 'hors' : ''}`}>
      <div className="asp-voie-top">
        <input
          className="asp-input asp-voie-nom"
          value={v.nom}
          aria-label="Nom de la voie"
          placeholder="V1"
          onChange={(e) => p.onChange({ ...v, nom: e.target.value.slice(0, 10) })}
        />
        <span className="asp-voie-etat">{v.interdite ? 'Interdite' : v.role === 'hors' ? 'Pas annoncée' : 'Annoncée'}</span>
        {!p.seule && (
          <button className="icon-btn asp-x" onClick={p.onRemove} aria-label={`Retirer la voie ${v.nom}`}>
            ×
          </button>
        )}
      </div>
      <div className="asp-mini-label">Sens des circulations</div>
      <Choix small label={`Sens des circulations sur ${v.nom}`} value={v.sens} options={SENS_OPTIONS} onChange={(sens) => p.onChange({ ...v, sens })} />
      <div className="asp-mini-label">Place de la voie</div>
      <Choix small label={`Place de ${v.nom}`} value={v.role} options={ROLES_VOIE} onChange={(role) => p.onChange({ ...v, role })} />
      <div className="asp-voie-vitesse">
        <Nombre label="Vitesse maximale" unit="km/h" value={v.vitesse} max={400} placeholder="160" onChange={(vitesse) => p.onChange({ ...v, vitesse })} />
        {p.suggestion !== null && p.suggestion !== v.vitesse && (
          <button className="btn btn-small asp-suggest" onClick={() => p.onChange({ ...v, vitesse: p.suggestion })}>
            Ligne : {p.suggestion} km/h
          </button>
        )}
      </div>
      <Interrupteur
        label="Interdite à la circulation (DFV)"
        hint="Avis de voie interdite reçu, cases S9 : la voie sort du dispositif d’annonce."
        checked={v.interdite}
        onChange={(interdite) => p.onChange({ ...v, interdite })}
      />
    </div>
  );
}
