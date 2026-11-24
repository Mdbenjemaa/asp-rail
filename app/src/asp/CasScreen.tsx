/** Cas pratiques : les 7 exercices du support, à calculer soi-même, vérifier, puis voir corrigés. */
import { useMemo, useState } from 'react';
import { Icon } from '../components/parts';
import { fmtPk } from '../lib/format';
import { CAS, type Cas } from './cas';
import { calculChantier, SENS_FLECHE, SENS_LABEL, type Chantier } from './chantier';
import { Choix, Nombre, PkInput, ScreenHead } from './ui';

interface Saisie {
  dd: 'oui' | 'non' | '';
  ms: number | null;
  da: number | null;
  dist: Record<string, number | null>;
  pa: Record<string, number | null>;
}

function Verdict({ ok }: { ok: boolean | null }) {
  if (ok === null) return null;
  return <span className={`asp-verdict ${ok ? 'juste' : 'faux'}`}>{ok ? 'Juste' : 'Faux'}</span>;
}

function CasDetail({ cas, onBack, onEssayer }: { cas: Cas; onBack: () => void; onEssayer: (c: Chantier) => void }) {
  const attendu = useMemo(() => calculChantier(cas.chantier()), [cas]);
  const [s, setS] = useState<Saisie>({ dd: '', ms: null, da: null, dist: {}, pa: {} });
  const [verifie, setVerifie] = useState(false);
  const [correction, setCorrection] = useState(false);
  const ok = (b: boolean) => (verifie ? b : null);
  const cle = (v: { voieId: string; sens: string }) => `${v.voieId}-${v.sens}`;
  return (
    <div className="screen asp-screen" role="dialog" aria-label={cas.titre}>
      <ScreenHead title={cas.titre} sub="Cas pratique" onBack={onBack} backLabel="Retour aux cas pratiques" />
      <div className="screen-body asp-body">
        <div className="asp-bloc">
          <h3 className="asp-bloc-title">Énoncé</h3>
          <ul className="asp-list">
            {cas.enonce.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="muted small">Présente la plateforme, dis si le délai de dégagement est correct, puis calcule la marge, le délai et les distances d’annonce.</p>
        </div>

        <div className="asp-bloc">
          <h3 className="asp-bloc-title">Tes réponses</h3>
          <div className="asp-mini-label">
            Le délai de dégagement donné est-il le bon ? <Verdict ok={ok((s.dd === 'oui') === cas.ddCorrect && s.dd !== '')} />
          </div>
          <Choix label="Le délai de dégagement est-il correct ?" value={s.dd} options={[['oui', 'Oui'], ['non', 'Non']]} onChange={(dd) => setS({ ...s, dd })} />
          <div className="asp-mini-label">
            Marge de sécurité <Verdict ok={ok(s.ms === attendu.ms.valeur)} />
          </div>
          <Choix
            label="Marge de sécurité"
            value={s.ms === null ? '' : String(s.ms)}
            options={[
              ['5', '5 s'],
              ['10', '10 s'],
              ['15', '15 s'],
            ]}
            onChange={(v) => setS({ ...s, ms: Number(v) })}
          />
          <div className="asp-verdict-row">
            <Nombre label="Délai d’annonce" unit="s" value={s.da} onChange={(da) => setS({ ...s, da })} />
            <Verdict ok={ok(s.da === attendu.da)} />
          </div>
          {attendu.voies.map((v) => (
            <div key={cle(v)} className="asp-cas-voie">
              <b>
                {v.voie} {SENS_FLECHE[v.sens]} · {SENS_LABEL[v.sens]} · {v.vitesse} km/h
              </b>
              <div className="asp-verdict-row">
                <Nombre label="Distance d’annonce" unit="m" value={s.dist[cle(v)] ?? null} onChange={(d) => setS({ ...s, dist: { ...s.dist, [cle(v)]: d } })} />
                <Verdict ok={ok(s.dist[cle(v)] === v.distance)} />
              </div>
              <div className="asp-verdict-row">
                <PkInput label="Point d’annonce" value={s.pa[cle(v)] ?? null} onChange={(pk) => setS({ ...s, pa: { ...s.pa, [cle(v)]: pk } })} />
                <Verdict ok={ok(s.pa[cle(v)] !== undefined && s.pa[cle(v)] !== null && Math.abs((s.pa[cle(v)] ?? 0) - (v.pointAnnonce ?? NaN)) < 0.0005)} />
              </div>
            </div>
          ))}
          <button className="btn primary wide" onClick={() => setVerifie(true)}>
            Vérifier mes réponses
          </button>
        </div>

        <button className="btn wide" onClick={() => setCorrection((c) => !c)} aria-expanded={correction}>
          {correction ? 'Cacher la correction' : 'Voir la correction'}
        </button>
        {correction && (
          <div className="asp-bloc asp-correction">
            <h3 className="asp-bloc-title">Correction</h3>
            {cas.correction.map((t) => (
              <p key={t}>{t}</p>
            ))}
            <dl className="facts-list asp-kv">
              <div>
                <dt>Délai d’annonce</dt>
                <dd>
                  {attendu.dd.retenu} + {attendu.ms.valeur} = {attendu.da} s
                </dd>
              </div>
              {attendu.voies.map((v) => (
                <div key={cle(v)}>
                  <dt>
                    {v.voie} {SENS_FLECHE[v.sens]} · {v.vitesse} km/h
                  </dt>
                  <dd>
                    {v.distance} m · point d’annonce PK {fmtPk(v.pointAnnonce)}
                  </dd>
                </div>
              ))}
            </dl>
            <button className="btn wide" onClick={() => onEssayer(cas.chantier())}>
              Ouvrir ce cas comme un chantier
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CasScreen({ onBack, onEssayer }: { onBack: () => void; onEssayer: (c: Chantier) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const cas = CAS.find((c) => c.id === open);
  if (cas) return <CasDetail cas={cas} onBack={() => setOpen(null)} onEssayer={onEssayer} />;
  return (
    <div className="screen asp-screen" role="dialog" aria-label="Cas pratiques">
      <ScreenHead title="Cas pratiques" sub="Exercices « Terrain et CADA »" onBack={onBack} />
      <div className="screen-body asp-body">
        <ul className="results-list">
          {CAS.map((c) => (
            <li key={c.id}>
              <button className="result" onClick={() => setOpen(c.id)}>
                <span className="result-ico">
                  <Icon name="train" size={20} />
                </span>
                <span className="result-main">
                  <b>{c.titre}</b>
                  <small>{c.enonce[1]}</small>
                </span>
                <Icon name="right" size={20} />
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">Les réponses attendues sont calculées par le même moteur que tes chantiers.</p>
      </div>
    </div>
  );
}
