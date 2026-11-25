/**
 * Dérangement d'un PN à SAL : deux questions pour savoir si c'est un raté d'ouverture ou de fermeture,
 * puis la conduite à tenir, d'après le support TES F. Le livret de service du PN prime.
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import type { Ctx } from '../asp/contexte';
import { Ecran, Tuiles } from '../asp/kit';
import { heure, missionParId, enregistrerMission, newId, titreMission } from './mission';

type Quand = 'hors' | 'approche' | 'bris';
type Verdict = 'ouverture' | 'fermeture' | 'normal';

const QUESTIONS: Record<Quand, { titre: string; options: { id: string; title: string; sub?: string; v: Verdict }[] }> = {
  hors: {
    titre: 'Qu’est-ce que tu vois ?',
    options: [
      { id: 'feux', title: 'Des feux rouges allumés', v: 'ouverture' },
      { id: 'barrieres', title: 'Une ou plusieurs barrières restent fermées', v: 'ouverture' },
      { id: 'rien', title: 'Rien d’anormal', sub: 'Feux éteints, barrières levées.', v: 'normal' },
    ],
  },
  approche: {
    titre: 'Qu’est-ce que tu vois ?',
    options: [
      { id: 'feux', title: 'Un ou plusieurs feux rouges éteints', v: 'fermeture' },
      { id: 'barriere', title: 'Une barrière reste ouverte', sub: 'Demi-barrière d’un SAL 2, ou d’entrée d’un SAL 4.', v: 'fermeture' },
      { id: 'feu-bris', title: 'Un feu éteint et une barrière cassée', v: 'fermeture' },
      { id: 'rien', title: 'Tout fonctionne', sub: 'Feux clignotants, sonneries, barrières baissées.', v: 'normal' },
    ],
  },
  bris: {
    titre: 'À l’approche d’un train, les feux routiers…',
    options: [
      { id: 'feux-ok', title: 'Fonctionnent tous', v: 'ouverture' },
      { id: 'feux-ko', title: 'Un ou plusieurs restent éteints', v: 'fermeture' },
    ],
  },
};

const VERDICT: Record<Verdict, { titre: string; texte: string }> = {
  ouverture: { titre: 'Raté d’ouverture', texte: 'Les signaux routiers sont présentés alors qu’aucun train n’arrive, ou une barrière brisée n’arrête plus les usagers alors que les feux fonctionnent.' },
  fermeture: { titre: 'Raté de fermeture', texte: 'À l’approche ou au passage d’un train, les signaux routiers ne protègent pas complètement le PN : c’est le plus dangereux.' },
  normal: { titre: 'Pas de dérangement constaté', texte: 'Le PN fonctionne selon son principe. Au moindre doute, alerte quand même.' },
};

export function Diagnostic(p: { ctx: Ctx; missionId?: string; onglet?: boolean; hidden?: boolean }) {
  const [quand, setQuand] = useState<Quand | null>(null);
  const [vu, setVu] = useState<string | null>(null);
  const [note, setNote] = useState(false);
  const opt = quand && vu ? QUESTIONS[quand].options.find((o) => o.id === vu) : null;
  const verdict = opt?.v ?? null;
  const mission = p.missionId ? missionParId(p.missionId) : null;
  const recommencer = () => {
    setQuand(null);
    setVu(null);
    setNote(false);
  };

  const contenu = (
    <>
      {!verdict && (
        <>
          <h2 className="ds-q">{quand ? QUESTIONS[quand].titre : 'Quand constates-tu l’anomalie ?'}</h2>
          {!quand ? (
            <Tuiles
              label="Quand"
              value={quand}
              onChange={(q) => setQuand(q)}
              options={[
                { id: 'hors', title: 'Aucun train n’arrive', sub: 'Le PN devrait être ouvert.', icon: 'clock' },
                { id: 'approche', title: 'Un train arrive ou passe', sub: 'Le PN devrait être fermé.', icon: 'train' },
                { id: 'bris', title: 'Une barrière est cassée', sub: 'Elle n’arrête plus les usagers.', icon: 'alert' },
              ]}
            />
          ) : (
            <>
              <Tuiles label="Ce que tu vois" value={vu} onChange={setVu} options={QUESTIONS[quand].options.map((o) => ({ id: o.id, title: o.title, sub: o.sub }))} />
              <button className="ds-btn text" style={{ marginTop: 8 }} onClick={() => setQuand(null)}>
                ← Changer la réponse précédente
              </button>
            </>
          )}
        </>
      )}
      {verdict && (
        <>
          <section className={`ds-verdict ${verdict}`} aria-label="Résultat">
            <span className="ds-tag">PN considéré en</span>
            <h2>{VERDICT[verdict].titre}</h2>
            <p>{VERDICT[verdict].texte}</p>
          </section>
          {verdict !== 'normal' && (
            <>
              <h3 className="ds-section-title">Ce que tu fais</h3>
              <ol className="ds-steps">
                <li>
                  <b>Alerte</b> un agent d’une des gares ou d’un des postes qui encadrent le PN (et le CCh en travaux) : numéro du PN, ligne, ce que tu as vu.
                </li>
                <li>
                  <b>En attendant l’astreinte SE</b> : gère le flux avec les banderoles selon la situation et, si besoin, un SAM de nuit type R34.
                </li>
                <li>
                  <b>Dévie les usagers</b> (véhicules, cycles, piétons) vers l’itinéraire de détournement ; explique les informations du téléphone du PN ou du QR code.
                </li>
                <li>
                  <b>S’il faut intervenir</b> et que tu le peux : suis les directives de la 1re page du livret de service du PN.
                </li>
              </ol>
              <div className="ds-alert stop" style={{ marginTop: 12 }}>
                <Icon name="alert" size={22} />
                <span>
                  <b>Risque grave ou imminent</b>
                  Arrêt des trains selon la procédure (RFN-IG-SE 02 B-00-n° 004).
                </span>
              </div>
              <p className="ds-hint">L’Exploitation prend des mesures immédiates, l’agent SE relève le dérangement, l’agent voie rétablit une circulation aussi normale que possible.</p>
              {mission && !note && (
                <button
                  className="ds-btn primary wide"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    const now = Date.now();
                    enregistrerMission({
                      ...mission,
                      journal: [...mission.journal, { id: newId(), t: now, texte: `Dérangement constaté : ${VERDICT[verdict].titre.toLowerCase()} (${opt!.title.toLowerCase()})`, type: 'derangement' }],
                    });
                    setNote(true);
                    p.ctx.onToast(`Noté au journal de ${titreMission(mission)} à ${heure(now)}.`);
                  }}
                >
                  Noter au journal de la mission
                </button>
              )}
            </>
          )}
          <button className="ds-btn wide" style={{ marginTop: 10 }} onClick={recommencer}>
            Recommencer
          </button>
          <button className="ds-btn text" onClick={() => p.ctx.open({ k: 'memo', banque: 'pn', section: 'pn-derangement' })}>
            Mémo : les dérangements
          </button>
        </>
      )}
    </>
  );

  if (p.onglet) {
    return (
      <main className="ds-page" aria-label="Dérangement">
        <header className="ds-page-head">
          <div>
            <h1>Dérangement</h1>
            <p>Raté d’ouverture ou de fermeture ? En deux questions.</p>
          </div>
        </header>
        {contenu}
        <p className="ds-foot">D’après le support TES F. Le livret de service du PN et les consignes priment.</p>
      </main>
    );
  }
  return (
    <Ecran label="Dérangement" title="Dérangement du PN" onBack={p.ctx.back} hidden={p.hidden}>
      {contenu}
    </Ecran>
  );
}
