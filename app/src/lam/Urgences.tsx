/** Fiches réflexes AP LAM / AP S9 : ce qu'on fait tout de suite, dans l'ordre, et la note au journal de la mission. */
import { useState } from 'react';
import { Icon } from '../components/parts';
import { useModules } from '../access/entreprise';
import type { Ctx } from '../asp/contexte';
import { Ecran, Ligne, Section } from '../asp/kit';
import { ajouterEvenement, enregistrerMissionLam, heure, missionLamParId, titreMissionLam } from './mission';
import { S2B_MOYENS, URGENCES, type FicheUrgence } from './urgences';

export function Urgences(p: { ctx: Ctx; missionId?: string; onglet?: boolean; hidden?: boolean }) {
  const modules = useModules();
  const [fiche, setFiche] = useState<FicheUrgence | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const mission = p.missionId ? missionLamParId(p.missionId) : null;
  const pour = mission?.type ?? null;
  const fiches = URGENCES.filter((f) => !pour || f.pour === 'tous' || f.pour === pour);
  const ouvrir = (f: FicheUrgence | null) => {
    setFiche(f);
    setNote(null);
  };

  const liste = (
    <>
      <div className="ds-alert stop" style={{ marginBottom: 12 }}>
        <Icon name="alert" size={22} />
        <span>
          <b>Gabarit engagé, dérive, SAM franchi : protège d’abord</b>
          Mesures S2B, puis appelle le CCh.
        </span>
      </div>
      <Section title="Urgences">
        {fiches
          .filter((f) => f.genre === 'urgence')
          .map((f) => (
            <Ligne key={f.id} icon="alert" badgeClass="stop" title={f.titre} onClick={() => ouvrir(f)} />
          ))}
      </Section>
      <Section title="Aléas">
        {fiches
          .filter((f) => f.genre === 'alea')
          .map((f) => (
            <Ligne key={f.id} icon="info" title={f.titre} onClick={() => ouvrir(f)} />
          ))}
      </Section>
    </>
  );

  const detail = fiche && (
    <>
      <section className={`ds-verdict ${fiche.genre === 'urgence' ? 'fermeture' : 'ouverture'}`} aria-label="Fiche réflexe">
        <span className="ds-tag">{fiche.genre === 'urgence' ? 'Urgence' : 'Aléa'}</span>
        <h2>{fiche.titre}</h2>
      </section>
      <h3 className="ds-section-title">Ce que tu fais</h3>
      <ol className="ds-steps">
        {fiche.etapes.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ol>
      {fiche.note && <p className="ds-hint">{fiche.note}</p>}
      {fiche.etapes.some((e) => e.includes('S2B')) && (
        <div className="ds-card ds-s2b">
          <b>S2B : arrêter les trains</b>
          <ul>
            {S2B_MOYENS.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {mission && !note && (
        <button
          className="ds-btn primary wide"
          style={{ marginTop: 12 }}
          onClick={() => {
            const next = ajouterEvenement(mission, `${fiche.genre === 'urgence' ? 'Urgence' : 'Aléa'} : ${fiche.titre.charAt(0).toLowerCase()}${fiche.titre.slice(1)}`, 'urgence');
            enregistrerMissionLam(next);
            const t = next.journal.at(-1)!.t;
            setNote(heure(t));
            p.ctx.onToast(`Noté au journal de ${titreMissionLam(mission)} à ${heure(t)}.`);
          }}
        >
          Noter au journal de la mission
        </button>
      )}
      {note && <p className="ds-hint">Noté au journal à {note}.</p>}
      {modules.memo && (
        <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'memo', banque: 'lam', section: fiche.genre === 'urgence' ? 'lam-urgences' : 'lam-aleas' })}>
          Mémo : {fiche.genre === 'urgence' ? 'les urgences' : 'les aléas'}
        </button>
      )}
    </>
  );

  if (p.onglet) {
    return (
      <main className="ds-page" aria-label="Urgences">
        <header className="ds-page-head">
          <div>
            <h1>Urgences</h1>
            <p>Les fiches réflexes AP LAM et AP S9, dans l’ordre.</p>
          </div>
        </header>
        {fiche ? (
          <>
            <button className="ds-btn text" style={{ marginBottom: 8 }} onClick={() => ouvrir(null)}>
              ← Toutes les fiches
            </button>
            {detail}
          </>
        ) : (
          liste
        )}
        <p className="ds-foot">D’après le livret technique AP-LAM / AP-S9. La consigne LAM, la fiche de travail et le CCh priment.</p>
      </main>
    );
  }
  return (
    <Ecran label="Urgences" title={fiche ? fiche.titre : 'Urgences et aléas'} onBack={fiche ? () => ouvrir(null) : p.ctx.back} hidden={p.hidden}>
      {fiche ? detail : liste}
    </Ecran>
  );
}
