/** Onglet « Annonce » : plateforme (voies, sens, vitesses), travaux (outillage, DD, particularités) et résultat. */
import { fmtPk } from '../lib/format';
import type { LineDoc } from '../lib/data';
import { nouvelleVoie, SENS_FLECHE, SENS_LABEL, type Chantier } from './chantier';
import { vitesseLigne, vmaxEntre } from './lignes';
import { SITUATION_LABEL, type Alerte, type Resultat, type Voie } from './rules';
import { GROUPES, OUTILLAGES, PARTICULARITES, ROLES_VOIE } from './textes';
import { Alertes, Bloc, Choix, Interrupteur, Nombre } from './ui';

const SENS_OPTIONS: [Voie['sens'], string][] = [
  ['croissant', '▲ PK croissants'],
  ['decroissant', '▼ PK décroissants'],
  ['deux', '▲▼ 2 sens'],
];

/** Plateformes types, pour démarrer vite. */
const MODELES: { id: string; label: string; voies: () => Voie[] }[] = [
  { id: 'dv', label: 'Double voie', voies: () => [nouvelleVoie('V1', 'croissant', 'travail'), nouvelleVoie('V2', 'decroissant', 'contigue')] },
  { id: 'vu', label: 'Voie unique', voies: () => [nouvelleVoie('VU', 'deux', 'travail')] },
  { id: 'banal', label: '2 voies banalisées', voies: () => [nouvelleVoie('V1', 'deux', 'travail'), nouvelleVoie('V2', 'deux', 'contigue')] },
  {
    id: 'quatre',
    label: '4 voies',
    voies: () => [
      nouvelleVoie('V1bis', 'croissant', 'contigue'),
      nouvelleVoie('V1', 'croissant', 'travail'),
      nouvelleVoie('V2', 'decroissant', 'contigue'),
      nouvelleVoie('V2bis', 'decroissant', 'hors'),
    ],
  },
];

function VoieCard(p: { v: Voie; suggestion: number | null; onChange: (v: Voie) => void; onRemove: () => void; seule: boolean }) {
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

export function TabAnnonce(p: { c: Chantier; r: Resultat; doc: LineDoc | null; set: (patch: Partial<Chantier>) => void; onGoPk: (pk: number) => void; onMap: () => void }) {
  const { c, r, doc, set } = p;
  const suggestion = vitesseLigne(c, doc);
  const setVoie = (v: Voie) => set({ voies: c.voies.map((x) => (x.id === v.id ? v : x)) });
  const setP = (key: keyof Chantier['p'], val: boolean) => set({ p: { ...c.p, [key]: val } });
  const outil = OUTILLAGES.find((o) => o.id === c.outillage)!;

  return (
    <>
      <Bloc title="Plateforme">
        <p className="muted small">
          Sens : là où vont les circulations par rapport aux PK. Sur les lignes au départ de Paris, V1 va en général vers les PK
          croissants et V2 vers les PK décroissants : vérifie dans les particularités locales.
        </p>
        <div className="asp-modeles">
          {MODELES.map((m) => (
            <button
              key={m.id}
              className="chip"
              onClick={() => {
                if (c.voies.length && !window.confirm(`Remplacer les voies par « ${m.label} » ?`)) return;
                const voies = m.voies().map((v) => ({ ...v, vitesse: suggestion }));
                set({ voies, agents: c.agents.map((a) => ({ ...a, surveille: [] })) });
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {c.voies.map((v) => (
          <VoieCard
            key={v.id}
            v={v}
            suggestion={suggestion}
            seule={c.voies.length === 1}
            onChange={setVoie}
            onRemove={() => set({ voies: c.voies.filter((x) => x.id !== v.id), agents: c.agents.map((a) => ({ ...a, surveille: a.surveille.filter((k) => !k.startsWith(`${v.id}:`)) })) })}
          />
        ))}
        <button className="btn wide" onClick={() => set({ voies: [...c.voies, nouvelleVoie(`V${c.voies.length + 1}`, 'croissant', 'contigue', suggestion)] })}>
          + Ajouter une voie
        </button>
        {suggestion !== null && (
          <p className="muted small">
            Vitesse de la ligne à cet endroit d’après les données ouvertes SNCF Réseau : {suggestion} km/h. Vérifie la vitesse de chaque voie
            et de chaque sens (renseignements techniques, carte des vitesses) : c’est elle qui fixe la distance.
          </p>
        )}
      </Bloc>

      <Bloc title="Travaux">
        <div className="asp-mini-label">Catégorie d’outillage</div>
        <Choix label="Catégorie d’outillage" value={c.outillage} options={OUTILLAGES.map((o) => [o.id, o.court] as [typeof o.id, string])} onChange={(outillage) => set({ outillage })} />
        <p className="asp-hint">
          <b>{outil.label}.</b> {outil.hint}
        </p>
        <Nombre label="Délai de dégagement (DD)" unit="s" value={c.dd} max={120} placeholder="5" onChange={(dd) => set({ dd })} />
        <div className="chips asp-dd-chips">
          {[0, 5, 10, 15].map((s) => (
            <button key={s} className={`chip ${c.dd === s ? 'on' : ''}`} onClick={() => set({ dd: s })}>
              {s === 0 ? 'Nul' : `${s} s`}
            </button>
          ))}
        </div>
        <p className="asp-hint">Choisi par le chef de chantier avec toi, puis testé : prendre les mesures techniques, débarrasser la voie, se garer.</p>
      </Bloc>

      {GROUPES.map((g) => (
        <Bloc key={g.id} title={g.title}>
          {PARTICULARITES.filter((x) => x.group === g.id).map((x) => (
            <Interrupteur key={x.key} label={x.label} hint={x.hint} checked={c.p[x.key]} onChange={(v) => setP(x.key, v)} />
          ))}
          {g.id === 'conditions' && <p className="muted small">Chantier de nuit : choisis « De nuit » dans l’onglet Chantier.</p>}
        </Bloc>
      ))}

      <Resultats c={c} r={r} doc={doc} onGoPk={p.onGoPk} onMap={p.onMap} />
    </>
  );
}

/** Contrôle de la vitesse : entre le point d'annonce et le chantier, prendre la vitesse la plus importante. */
function alertesVitesse(r: Resultat, doc: LineDoc | null): Alerte[] {
  if (!doc) return [];
  const out: Alerte[] = [];
  for (const v of r.voies) {
    if (v.pointAnnonce === null || v.limiteAmont === null) continue;
    const max = vmaxEntre(doc, v.pointAnnonce, v.limiteAmont);
    if (max !== null && max > v.vitesse) {
      out.push({
        niveau: 'attention',
        texte: `${v.voie} ${SENS_FLECHE[v.sens]} : la ligne monte à ${max} km/h entre le point d’annonce et le chantier (données ouvertes). En cas de rupture de vitesse, prends la vitesse la plus importante.`,
      });
    }
  }
  return out;
}

export function Resultats(p: { c: Chantier; r: Resultat; doc: LineDoc | null; onGoPk: (pk: number) => void; onMap: () => void }) {
  const { c, r } = p;
  const alertes: Alerte[] = [...r.dd.erreurs.map((t) => ({ niveau: 'stop' as const, texte: t })), ...r.alertes, ...alertesVitesse(r, p.doc)];
  return (
    <Bloc title="Résultat" id="asp-resultat" className="asp-resultat">
      <p className="asp-situation">{SITUATION_LABEL[r.situation]}</p>
      <div className="asp-kpis">
        <div>
          <small>Dégagement</small>
          <b>{r.dd.retenu ?? '—'}</b>
          <span>s</span>
        </div>
        <span className="asp-kpi-op">+</span>
        <div>
          <small>Marge</small>
          <b>{r.ms.valeur}</b>
          <span>s</span>
        </div>
        <span className="asp-kpi-op">=</span>
        <div className="asp-kpi-main">
          <small>Délai d’annonce</small>
          <b>{r.da ?? '—'}</b>
          <span>s</span>
        </div>
      </div>
      <ul className="asp-raisons">
        {r.ms.raisons.map((t) => (
          <li key={t}>Marge : {t}</li>
        ))}
        {r.dd.conseils.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <Alertes list={alertes} />
      {r.voies.length > 0 && (
        <ul className="asp-pa-list">
          {r.voies.map((v) => (
            <li key={`${v.voieId}-${v.sens}`} className="asp-pa">
              <div className="asp-pa-head">
                <span className="asp-pa-voie">
                  {v.voie} {SENS_FLECHE[v.sens]}
                </span>
                <span className="asp-pa-sub">
                  {SENS_LABEL[v.sens]} · {v.vitesse || '?'} km/h · {v.da} s
                </span>
              </div>
              <div className="asp-pa-main">
                <b className="asp-pa-dist">{v.distance ? `${v.distance} m` : '—'}</b>
                <span className="asp-pa-pk">
                  {v.pointAnnonce !== null ? (
                    <>
                      Point d’annonce
                      <b>PK {fmtPk(v.pointAnnonce)}</b>
                    </>
                  ) : c.pkDebut === null ? (
                    'Indique la zone de travail (PK)'
                  ) : (
                    'Complète les données'
                  )}
                </span>
              </div>
              {v.note && <p className="asp-pa-note">{v.note}</p>}
              {v.pointAnnonce !== null && c.ligne && (
                <div className="asp-pa-actions">
                  <button className="btn btn-small" onClick={p.onMap}>
                    Voir sur la carte
                  </button>
                  <button className="btn btn-small" onClick={() => p.onGoPk(v.pointAnnonce!)}>
                    Y aller
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        Distance = vitesse ÷ 3,6 × délai d’annonce, arrondie à la dizaine de mètres supérieure, comme dans les tableaux. Repère le point
        d’annonce sur les poteaux kilométriques et hectométriques, pas sur les poteaux caténaires.
      </p>
    </Bloc>
  );
}
