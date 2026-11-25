/**
 * Nouveau chantier, pas à pas : une question par écran, de gros choix, des valeurs par défaut sensées.
 * Chaque réponse est gardée tout de suite ; le résultat arrive à la fin. Sert aussi à modifier une seule étape.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/parts';
import { useRetour } from '../lib/back';
import { fmtLine, fmtPk } from '../lib/format';
import type { LineDoc } from '../lib/data';
import { VoieCard } from './Annonce';
import { ETAPES, NB_QUESTIONS } from './etat';
import { alertesVitesse, MODELES, modeleDe } from './voies';
import { calculChantier, nouvelleVoie, SENS_FLECHE, type Chantier } from './chantier';
import type { Ctx, EtapeId } from './contexte';
import { annonceurParSens } from './dispositif';
import { AlertesDs, Annonce, Bascule, CorrectionDfv, Ecran, Etat, Pastilles, Pourquoi, Tuiles } from './kit';
import { proposerVitesses, useLigne, vitesseLigne } from './lignes';
import { SITUATION_LABEL, voiesAnnoncees, type Particularites, type Resultat, type Voie } from './rules';
import { definirActif, enregistrer, supprimer, useChantiers } from './store';
import { GROUPES, OUTILLAGES, PARTICULARITES } from './textes';
import { Champ, Interrupteur, Nombre, PkInput } from './ui';


const round3 = (x: number) => Math.round(x * 1000) / 1000;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function valide(id: EtapeId, c: Chantier): boolean {
  if (id === 'lieu') return !!c.ligne && c.ligne.length === 6 && c.pkDebut !== null;
  if (id === 'vitesses') return voiesAnnoncees(c.voies).every((v) => (v.vitesse ?? 0) > 0);
  if (id === 'degagement') return c.dd !== null;
  return true;
}

type Set = (patch: Partial<Chantier>) => void;
interface StepProps {
  c: Chantier;
  r: Resultat;
  set: Set;
  ctx: Ctx;
  doc: LineDoc | null;
}

export function Assistant(p: { id: string; etape?: EtapeId; seule?: boolean; hidden?: boolean; ctx: Ctx }) {
  const list = useChantiers();
  const c = list.find((x) => x.id === p.id) ?? null;
  const [i, setI] = useState(() => Math.max(0, ETAPES.findIndex((e) => e.id === (p.etape ?? 'lieu'))));
  const touche = useRef(!!p.seule);
  const { doc } = useLigne(c?.ligne ?? null);
  const r = useMemo(() => (c ? calculChantier(c) : null), [c]);
  const scroller = useRef<HTMLDivElement | null>(null);

  const fermer = () => {
    // Ouvert puis refermé sans rien toucher : on ne garde pas de chantier vide.
    if (!touche.current) supprimer(p.id);
    p.ctx.back();
  };
  const aller = (n: number) => {
    setI(n);
    document.querySelector('.ds-screen:not([hidden]) .ds-scroll')?.scrollTo({ top: 0 });
  };
  const precedent = () => (p.seule || i === 0 ? fermer() : aller(i - 1));
  useRetour(!p.hidden, precedent);

  if (!c || !r) return null;
  const set: Set = (patch) => {
    touche.current = true;
    enregistrer({ ...c, ...patch, brouillon: false });
  };
  const etape = ETAPES[i];
  const ok = valide(etape.id, c);
  const sp: StepProps = { c, r, set, ctx: p.ctx, doc };
  const terminer = (avecAnnonceurs: boolean) => {
    enregistrer({ ...(avecAnnonceurs ? annonceurParSens(c, r) : c), brouillon: false });
    definirActif(c.id);
    p.ctx.replace({ k: 'fiche', id: c.id });
  };
  const autresAgents = c.agents.some((a) => a.role !== 'asp');

  let actions;
  if (p.seule) {
    actions = (
      <button className="ds-btn primary big" onClick={p.ctx.back}>
        Enregistrer
      </button>
    );
  } else if (etape.id === 'resultat') {
    actions =
      !autresAgents && r.voies.length > 0 ? (
        <>
          <button className="ds-btn primary big" onClick={() => terminer(true)}>
            <Icon name="flag" size={22} />
            Placer un annonceur par sens
          </button>
          <button className="ds-btn text" onClick={() => terminer(false)}>
            Terminer sans placer d’annonceur
          </button>
        </>
      ) : (
        <button className="ds-btn primary big" onClick={() => terminer(false)}>
          Voir ma fiche
        </button>
      );
  } else {
    actions = (
      <>
        <button className="ds-btn primary big" disabled={!ok} onClick={() => aller(i + 1)}>
          {i === NB_QUESTIONS - 1 ? 'Voir le résultat' : 'Continuer'}
        </button>
        {etape.id === 'lieu' && !ok && (
          <button className="ds-btn text" onClick={() => aller(i + 1)}>
            Je n’ai pas encore la ligne ou le PK
          </button>
        )}
      </>
    );
  }

  return (
    <Ecran
      label={p.seule ? `Modifier : ${etape.court}` : 'Nouveau chantier'}
      hidden={p.hidden}
      retourGere
      onBack={precedent}
      backIcon={p.seule || i === 0 ? 'close' : 'back'}
      backLabel={p.seule || i === 0 ? 'Fermer' : 'Étape précédente'}
      center={
        p.seule ? (
          <h1>Modifier · {etape.court}</h1>
        ) : (
          <div className="ds-progress" role="progressbar" aria-label={`Étape ${Math.min(i + 1, NB_QUESTIONS)} sur ${NB_QUESTIONS}`} aria-valuemin={1} aria-valuemax={NB_QUESTIONS} aria-valuenow={Math.min(i + 1, NB_QUESTIONS)}>
            {ETAPES.slice(0, NB_QUESTIONS).map((e, k) => (
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
      actions={actions}
      actionsCol
    >
      <div ref={scroller}>
        {!p.seule && etape.id !== 'resultat' && (
          <p className="ds-tag">
            Étape {i + 1} sur {NB_QUESTIONS} · {etape.court}
          </p>
        )}
        <h2 className="ds-q">{etape.titre}</h2>
        {etape.id === 'lieu' && <EtapeLieu {...sp} />}
        {etape.id === 'type' && <EtapeType {...sp} />}
        {etape.id === 'voies' && <EtapeVoies {...sp} />}
        {etape.id === 'vitesses' && <EtapeVitesses {...sp} />}
        {etape.id === 'outillage' && <EtapeOutillage {...sp} />}
        {etape.id === 'degagement' && <EtapeDegagement {...sp} />}
        {etape.id === 'cas' && <EtapeCas {...sp} />}
        {etape.id === 'resultat' && <EtapeResultat {...sp} />}
      </div>
    </Ecran>
  );
}

/* ---------- 1. Lieu ---------- */

const LONGUEURS: [number, string][] = [
  [50, '50 m'],
  [100, '100 m'],
  [200, '200 m'],
  [500, '500 m'],
  [1000, '1 km'],
  [0, 'Autre'],
];

function EtapeLieu({ c, set, ctx }: StepProps) {
  const attente = useRef(false);
  const here = ctx.here;
  const [autre, setAutre] = useState(false);
  const longueurM = c.pkDebut !== null && c.pkFin !== null ? Math.round((c.pkFin - c.pkDebut) * 1000) : null;
  const longueur = autre ? 0 : longueurM !== null && LONGUEURS.some(([l]) => l === longueurM && l > 0) ? longueurM : longueurM === null ? null : 0;
  const lineName = c.ligne ? (ctx.manifest?.lines[c.ligne]?.n ?? null) : null;

  // Position GPS demandée : dès qu'elle arrive, elle remplit la ligne et le PK (et la vitesse de la ligne).
  useEffect(() => {
    if (!attente.current || ctx.locating || !here) return;
    attente.current = false;
    const pk = round3(here.pk);
    const l = longueurM && longueurM > 0 ? longueurM : 50;
    set({ ligne: here.code, ligneNom: here.ligneNom, pkDebut: pk, pkFin: round3(pk + l / 1000) });
    void proposerVitesses(c.id);
  }, [ctx.locating, here, longueurM, set, c.id]);

  const pris = !!here && here.code === c.ligne && c.pkDebut !== null && Math.abs(here.pk - c.pkDebut) < 0.003;
  return (
    <>
      <p className="ds-q-help">La ligne et le PK servent à placer les points d’annonce.</p>
      <button
        className={`ds-gps ${pris && !ctx.locating ? 'done' : ''}`}
        disabled={ctx.locating}
        onClick={() => {
          attente.current = true;
          ctx.onLocate();
        }}
      >
        <span className="ds-tile-ico">
          <Icon name={pris && !ctx.locating ? 'check' : 'locate'} />
        </span>
        <span className="ds-tile-txt">
          <b>{ctx.locating ? 'Recherche de ta position…' : pris ? 'Position prise' : 'Utiliser ma position GPS'}</b>
          <small>
            {ctx.locating
              ? 'Reste dehors, à découvert, quelques secondes.'
              : pris
                ? `Ligne ${fmtLine(c.ligne!)} · PK ${fmtPk(c.pkDebut)}. Vérifie-le sur les poteaux ; touche pour reprendre.`
                : 'La ligne et le PK se remplissent tout seuls.'}
          </small>
        </span>
      </button>
      {ctx.locError && !ctx.locating && <AlertesDs list={[{ niveau: 'attention', texte: ctx.locError }]} />}

      <div className="ds-or">ou saisis-les</div>
      <div className="ds-fields">
        <Champ
          label="Ligne (code à 6 chiffres)"
          value={c.ligne ?? ''}
          placeholder="830000"
          inputMode="numeric"
          onChange={(v) => {
            const code = v.replace(/\D/g, '').slice(0, 6);
            set({ ligne: code || null, ligneNom: (code && ctx.manifest?.lines[code]?.n) || null });
          }}
        />
        {c.ligne && c.ligne.length === 6 && <p className={`ds-hint ${lineName ? '' : 'error'}`}>{lineName ?? 'Ligne inconnue dans les données : vérifie le code.'}</p>}
        <PkInput
          label="PK de début"
          value={c.pkDebut}
          onChange={(pkDebut) => set({ pkDebut, pkFin: pkDebut !== null && longueur ? round3(pkDebut + longueur / 1000) : c.pkFin })}
        />
      </div>
      <span className="ds-label">Longueur de la zone de travail</span>
      <Pastilles
        label="Longueur de la zone de travail"
        value={longueur}
        options={LONGUEURS}
        onChange={(l) => {
          setAutre(l === 0);
          if (l > 0 && c.pkDebut !== null) set({ pkFin: round3(c.pkDebut + l / 1000) });
        }}
      />
      {longueur === 0 && (
        <div className="ds-fields" style={{ marginTop: 14 }}>
          <PkInput label="PK de fin" value={c.pkFin} onChange={(pkFin) => set({ pkFin })} />
        </div>
      )}
      {c.pkDebut !== null && c.pkFin !== null && (
        <p className="ds-hint">
          Zone de travail : PK {fmtPk(Math.min(c.pkDebut, c.pkFin))} → {fmtPk(Math.max(c.pkDebut, c.pkFin))}
        </p>
      )}
    </>
  );
}

/* ---------- 2. Type, horaire, date ---------- */

function EtapeType({ c, set }: StepProps) {
  const [[auj, dem]] = useState(() => [iso(new Date()), iso(new Date(Date.now() + 86_400_000))]);
  const [autreJour, setAutreJour] = useState(c.date !== auj && c.date !== dem);
  const jour = autreJour ? 'autre' : c.date === auj ? 'auj' : c.date === dem ? 'dem' : 'autre';
  return (
    <>
      <Tuiles
        label="Type de chantier"
        value={c.type}
        onChange={(type) => set({ type })}
        options={[
          { id: 'fixe', title: 'Fixe', sub: 'La zone de travail ne bouge pas.', icon: 'pin' },
          { id: 'mobile', title: 'Mobile', sub: 'L’équipe avance sans couper l’annonce (débroussaillage…).', icon: 'arrow' },
          { id: 'itinerant', title: 'Itinérant', sub: 'Petits chantiers successifs ; l’annonce est coupée entre deux.', icon: 'line' },
        ]}
      />
      {c.type === 'mobile' && (
        <>
          <span className="ds-label">Longueur sous annonce</span>
          <Pastilles
            label="Longueur sous annonce"
            value={c.longueurAnnonce}
            options={[
              [50, '50 m'],
              [100, '100 m'],
              [200, '200 m'],
              [500, '500 m'],
            ]}
            onChange={(longueurAnnonce) => set({ longueurAnnonce })}
          />
          <p className="ds-hint">Les points d’annonce suivent l’équipe : tu mettras son PK à jour dans la fiche.</p>
        </>
      )}
      <span className="ds-label">Horaire</span>
      <Bascule
        label="Horaire"
        value={c.horaire}
        options={[
          ['jour', 'De jour', 'sun'],
          ['nuit', 'De nuit', 'moon'],
        ]}
        onChange={(horaire) => set({ horaire })}
      />
      <span className="ds-label">Date</span>
      <Pastilles
        label="Date"
        value={jour}
        options={[
          ['auj', 'Aujourd’hui'],
          ['dem', 'Demain'],
          ['autre', 'Autre jour'],
        ]}
        onChange={(v) => {
          setAutreJour(v === 'autre');
          if (v === 'auj') set({ date: auj });
          if (v === 'dem') set({ date: dem });
        }}
      />
      {jour === 'autre' && (
        <div className="ds-fields" style={{ marginTop: 14 }}>
          <Champ label="Jour du chantier" type="date" value={c.date} onChange={(date) => set({ date })} />
        </div>
      )}
    </>
  );
}

/* ---------- 3. Voies ---------- */

/** Petit dessin de la plateforme : une ligne par voie, une flèche par sens de circulation. */
function Mini({ voies }: { voies: Voie[] }) {
  const h = 34;
  const pas = h / (voies.length + 1);
  return (
    <svg viewBox={`0 0 40 ${h}`} width="40" height={h} aria-hidden="true">
      {voies.map((v, k) => {
        const y = pas * (k + 1);
        return (
          <g key={k} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d={`M4 ${y}h32`} />
            {v.sens !== 'decroissant' && <path d={`M31 ${y - 3.5}l5 3.5-5 3.5`} />}
            {v.sens !== 'croissant' && <path d={`M9 ${y - 3.5}l-5 3.5 5 3.5`} />}
          </g>
        );
      })}
    </svg>
  );
}

function EtapeVoies({ c, set, doc }: StepProps) {
  const [fin, setFin] = useState(false);
  const modele = modeleDe(c.voies);
  const travail = c.voies.find((v) => v.role === 'travail') ?? null;
  const vitesse = c.voies.find((v) => v.vitesse)?.vitesse ?? vitesseLigne(c, doc);
  const sansSurveillance = c.agents.map((a) => ({ ...a, surveille: [] }));
  return (
    <>
      <p className="ds-q-help">▲ : circulations vers les PK croissants. ▼ : vers les PK décroissants. Vérifie dans les particularités locales.</p>
      <Tuiles
        label="Plateforme"
        value={modele}
        onChange={(id) => {
          const m = MODELES.find((x) => x.id === id)!;
          set({ voies: m.voies().map((v) => ({ ...v, vitesse })), agents: sansSurveillance });
        }}
        options={MODELES.map((m) => ({ id: m.id, title: m.label, sub: m.sub, art: <Mini voies={m.voies()} /> }))}
      />
      {modele === null && <p className="ds-hint">Plateforme réglée à la main : {c.voies.map((v) => `${v.nom} ${SENS_FLECHE[v.sens]}`).join(', ')}.</p>}
      <span className="ds-label">Tu travailles sur quelle voie ?</span>
      <Pastilles
        label="Voie de travail"
        value={travail?.id ?? null}
        options={c.voies.map((v) => [v.id, `${v.nom || '?'} ${SENS_FLECHE[v.sens]}`])}
        onChange={(id) =>
          set({
            voies: c.voies.map((v) => (v.id === id ? { ...v, role: 'travail' } : v.role === 'travail' ? { ...v, role: 'contigue', interdite: false } : v)),
          })
        }
      />
      {travail && (
        <div className="ds-list ds-toggles" style={{ marginTop: 14 }}>
          <Interrupteur
            label={`${travail.nom} est interdite à la circulation`}
            hint="Avis de voie interdite reçu (DFV) : elle sort de l’annonce, on annonce les voies voisines."
            checked={travail.interdite}
            onChange={(interdite) => set({ voies: c.voies.map((v) => (v.id === travail.id ? { ...v, interdite } : v)) })}
          />
        </div>
      )}
      <button className="ds-more" onClick={() => setFin(!fin)} aria-expanded={fin}>
        <Icon name="sliders" size={20} />
        {fin ? 'Masquer les réglages fins' : 'Réglages fins : sens, voies à traverser…'}
      </button>
      {fin && (
        <div style={{ marginTop: 12 }}>
          {c.voies.map((v) => (
            <VoieCard
              key={v.id}
              v={v}
              suggestion={vitesseLigne(c, doc)}
              seule={c.voies.length === 1}
              onChange={(nv) => set({ voies: c.voies.map((x) => (x.id === nv.id ? nv : x)) })}
              onRemove={() =>
                set({
                  voies: c.voies.filter((x) => x.id !== v.id),
                  agents: c.agents.map((a) => ({ ...a, surveille: a.surveille.filter((k) => !k.startsWith(`${v.id}:`)) })),
                })
              }
            />
          ))}
          <button className="ds-btn wide" onClick={() => set({ voies: [...c.voies, nouvelleVoie(`V${c.voies.length + 1}`, 'croissant', 'contigue', vitesse)] })}>
            <Icon name="plus" size={20} />
            Ajouter une voie
          </button>
        </div>
      )}
    </>
  );
}

/* ---------- 4. Vitesses ---------- */

const VITESSES: [number, string][] = [40, 60, 80, 100, 120, 140, 160, 200, 220].map((v) => [v, String(v)]);

function EtapeVitesses({ c, set, doc }: StepProps) {
  const annoncees = voiesAnnoncees(c.voies);
  const suggestion = vitesseLigne(c, doc);
  const memes = annoncees.every((v) => v.vitesse === annoncees[0]?.vitesse);
  const [separe, setSepare] = useState(!memes);
  const setAll = (vitesse: number | null) => set({ voies: c.voies.map((v) => ({ ...v, vitesse })) });
  const setUne = (id: string, vitesse: number | null) => set({ voies: c.voies.map((v) => (v.id === id ? { ...v, vitesse } : v)) });
  if (!annoncees.length) return <p className="ds-q-help">Aucune voie annoncée : toutes sont interdites ou hors annonce. Continue.</p>;
  return (
    <>
      <p className="ds-q-help">Vitesse maximale de chaque voie annoncée, d’après les renseignements techniques. C’est elle qui fixe la distance.</p>
      {suggestion !== null && (
        <div className="ds-found">
          <b>{suggestion} km/h d’après la ligne</b>
          Données ouvertes SNCF Réseau à cet endroit : vérifie-la sur le terrain.
          {annoncees.some((v) => v.vitesse !== suggestion) && (
            <div>
              <button className="ds-btn text" style={{ paddingLeft: 0 }} onClick={() => setAll(suggestion)}>
                Utiliser {suggestion} km/h
              </button>
            </div>
          )}
        </div>
      )}
      {!separe ? (
        <>
          <div className="ds-fields" style={{ marginTop: 16 }}>
            <Nombre label="Vitesse maximale" unit="km/h" value={annoncees[0]?.vitesse ?? null} max={400} placeholder="160" onChange={setAll} />
          </div>
          <span className="ds-label">Vitesses courantes</span>
          <Pastilles scroll label="Vitesses courantes" value={annoncees[0]?.vitesse ?? null} options={VITESSES} onChange={setAll} />
        </>
      ) : (
        <div className="ds-card" style={{ marginTop: 16, paddingTop: 4, paddingBottom: 4 }}>
          {annoncees.map((v) => (
            <div key={v.id} className="ds-voie-row">
              <span className="ds-pa-voie" aria-hidden="true">
                {v.nom}
                <span>{SENS_FLECHE[v.sens]}</span>
              </span>
              <Nombre label={`Vitesse sur ${v.nom}`} unit="km/h" value={v.vitesse} max={400} placeholder="160" onChange={(x) => setUne(v.id, x)} />
            </div>
          ))}
        </div>
      )}
      {annoncees.length > 1 && (
        <button
          className="ds-btn text"
          onClick={() => {
            if (separe) setAll(annoncees[0]?.vitesse ?? null);
            setSepare(!separe);
          }}
        >
          {separe ? 'Même vitesse sur toutes les voies' : 'Vitesses différentes selon la voie'}
        </button>
      )}
    </>
  );
}

/* ---------- 5. Outillage ---------- */

const OUTIL_ICO = { aucun: 'people', cat1: 'tool', cat2: 'tool', cat3: 'alert' } as const;

function EtapeOutillage({ c, set }: StepProps) {
  return (
    <>
      <p className="ds-q-help">Le plus lourd utilisé sur le chantier.</p>
      <Tuiles
        label="Catégorie d’outillage"
        value={c.outillage}
        onChange={(outillage) => set({ outillage })}
        options={OUTILLAGES.map((o) => ({ id: o.id, title: o.label, sub: o.hint, icon: OUTIL_ICO[o.id] }))}
      />
    </>
  );
}

/* ---------- 6. Délai de dégagement ---------- */

const DD_CHOIX = [5, 10, 15, 20, 30];

function EtapeDegagement({ c, r, set }: StepProps) {
  const [autre, setAutre] = useState(c.dd !== null && c.dd !== 0 && !DD_CHOIX.includes(c.dd));
  return (
    <>
      <p className="ds-q-help">Le temps pour prendre les mesures techniques, débarrasser la voie et se garer. Choisis-le avec le chef de chantier, puis teste-le.</p>
      <Pastilles
        big
        label="Délai de dégagement"
        value={autre ? -1 : c.dd}
        options={[...DD_CHOIX.map((s) => [s, `${s} s`] as [number, string]), [-1, 'Autre']]}
        onChange={(v) => {
          setAutre(v === -1);
          if (v !== -1) set({ dd: v });
        }}
      />
      {autre && (
        <div className="ds-fields" style={{ marginTop: 14 }}>
          <Nombre label="Délai de dégagement" unit="s" value={c.dd} max={120} placeholder="25" onChange={(dd) => set({ dd })} />
        </div>
      )}
      <div className="ds-found" style={{ marginTop: 18 }}>
        <b>Délai nul ?</b>
        Seulement si la zone dangereuse n’est engagée que par inadvertance, ou derrière une clôture limitative. Jamais pour le soudage ni le meulage.
        <div style={{ marginTop: 10 }}>
          <button
            className="ds-chip"
            aria-pressed={c.dd === 0}
            onClick={() => {
              setAutre(false);
              set({ dd: 0 });
            }}
          >
            Délai nul
          </button>
        </div>
      </div>
      <AlertesDs list={r.dd.erreurs.map((texte) => ({ niveau: 'stop' as const, texte }))} />
    </>
  );
}

/* ---------- 7. Cas particuliers ---------- */

const FREQUENTS: (keyof Particularites)[] = [
  'soudageMeulage',
  'obstacleMasquant',
  'zoneBruyante',
  'chantierBruyant',
  'annonceur2Sens',
  'aspAnnonceLuiMeme',
  'banaliseVutTct',
  'tunnel',
  'garageDifficile',
];

function EtapeCas({ c, set }: StepProps) {
  const autres = PARTICULARITES.filter((x) => !FREQUENTS.includes(x.key));
  const [tous, setTous] = useState(autres.some((x) => c.p[x.key]));
  const setP = (key: keyof Particularites, v: boolean) => set({ p: { ...c.p, [key]: v } });
  const n = PARTICULARITES.filter((x) => c.p[x.key]).length;
  return (
    <>
      <p className="ds-q-help">
        Active seulement ce qui s’applique. Rien de spécial ? Continue.
        {c.horaire === 'nuit' ? ' Le travail de nuit est déjà pris en compte.' : ''}
      </p>
      <div className="ds-list ds-toggles">
        {PARTICULARITES.filter((x) => FREQUENTS.includes(x.key)).map((x) => (
          <Interrupteur key={x.key} label={x.label} hint={x.hint} checked={c.p[x.key]} onChange={(v) => setP(x.key, v)} />
        ))}
      </div>
      <button className="ds-more" onClick={() => setTous(!tous)} aria-expanded={tous}>
        <Icon name={tous ? 'chevup' : 'down'} size={20} />
        {tous ? 'Masquer les autres cas' : `Voir les autres cas (${autres.length})`}
      </button>
      {tous &&
        GROUPES.map((g) => {
          const items = autres.filter((x) => x.group === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id}>
              <h3 className="ds-section-title">{g.title}</h3>
              <div className="ds-list ds-toggles">
                {items.map((x) => (
                  <Interrupteur key={x.key} label={x.label} hint={x.hint} checked={c.p[x.key]} onChange={(v) => setP(x.key, v)} />
                ))}
              </div>
            </section>
          );
        })}
      {n > 0 && (
        <p className="ds-hint">
          {n} cas activé{n > 1 ? 's' : ''}.
        </p>
      )}
    </>
  );
}

/* ---------- 8. Résultat ---------- */

function EtapeResultat({ c, r, ctx, doc, set }: StepProps) {
  const alertes = [...r.dd.erreurs.map((texte) => ({ niveau: 'stop' as const, texte })), ...r.alertes, ...alertesVitesse(r, doc)];
  return (
    <>
      <div className="ds-hero">
        <div className="ds-hero-top">
          <span className="ds-tag">{SITUATION_LABEL[r.situation]}</span>
          <Etat c={c} r={r} calculSeul />
        </div>
        <Annonce r={r} onGo={c.ligne ? (pk) => ctx.onGoPk(c.ligne!, pk) : undefined} manquePk={c.pkDebut === null} />
      </div>
      <AlertesDs list={alertes} />
      <CorrectionDfv c={c} r={r} set={set} />
      <h3 className="ds-section-title">Pourquoi ces valeurs</h3>
      <div className="ds-card">
        <Pourquoi r={r} />
      </div>
      <p className="ds-foot">Aide à la préparation : le carnet CADA, l’AAn et les consignes locales priment. Vérifie les PK sur le terrain.</p>
    </>
  );
}
