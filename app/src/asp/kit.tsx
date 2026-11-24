/**
 * Briques de la nouvelle interface : écrans plein écran avec barre du haut, tuiles de choix, pastilles,
 * listes de lignes, résultat de l'annonce, alertes. Une seule façon de faire chaque chose, partout.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../components/parts';
import { fmtPk } from '../lib/format';
import { useRetour } from '../lib/back';
import { SENS_FLECHE, type Chantier } from './chantier';
import { aRegler } from './etat';
import type { Alerte, Resultat } from './rules';

/** Écran plein (parcours, fiche…) : barre du haut, contenu qui défile, actions en bas. Le retour du téléphone le ferme. */
export function Ecran(p: {
  label: string;
  title?: ReactNode;
  onBack: () => void;
  backIcon?: 'back' | 'close';
  backLabel?: string;
  center?: ReactNode;
  right?: ReactNode;
  actions?: ReactNode;
  actionsCol?: boolean;
  hidden?: boolean;
  children: ReactNode;
  /** Le retour du téléphone est déjà pris en charge par l'appelant (étapes d'un parcours). */
  retourGere?: boolean;
}) {
  useRetour(!p.hidden && !p.retourGere, p.onBack);
  return (
    <div className="ds-screen" role="dialog" aria-label={p.label} hidden={p.hidden}>
      <header className="ds-topbar">
        <button className="ds-iconbtn" onClick={p.onBack} aria-label={p.backLabel ?? (p.backIcon === 'close' ? 'Fermer' : 'Retour')}>
          <Icon name={p.backIcon ?? 'back'} size={24} />
        </button>
        {p.center ?? <h1>{p.title}</h1>}
        {p.right}
      </header>
      <div className="ds-scroll">{p.children}</div>
      {p.actions && <div className={`ds-actions ${p.actionsCol ? 'col' : ''}`}>{p.actions}</div>}
    </div>
  );
}

/** Choix exclusif en grandes tuiles (icône, titre, explication). */
export function Tuiles<T extends string>(p: {
  label: string;
  value: T | null;
  options: { id: T; title: string; sub?: string; icon?: IconName; art?: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="ds-tiles" role="radiogroup" aria-label={p.label}>
      {p.options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={p.value === o.id} className="ds-tile" onClick={() => p.onChange(o.id)}>
          {(o.icon || o.art) && <span className={`ds-tile-ico ${o.art ? 'voies' : ''}`}>{o.art ?? <Icon name={o.icon!} />}</span>}
          <span className="ds-tile-txt">
            <b>{o.title}</b>
            {o.sub && <small>{o.sub}</small>}
          </span>
          <span className="ds-radio" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
        </button>
      ))}
    </div>
  );
}

/** Choix exclusif en pastilles (valeurs courtes : 5 s, 160 km/h…). */
export function Pastilles<T extends string | number>(p: {
  label: string;
  value: T | null;
  options: [T, string][];
  onChange: (v: T) => void;
  big?: boolean;
  scroll?: boolean;
}) {
  return (
    <div className={`ds-chips ${p.scroll ? 'scroll' : ''}`} role="radiogroup" aria-label={p.label}>
      {p.options.map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={p.value === v} className={`ds-chip ${p.big ? 'big' : ''}`} onClick={() => p.onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Deux choix côte à côte (jour / nuit). */
export function Bascule<T extends string>(p: { label: string; value: T; options: [T, string, IconName?][]; onChange: (v: T) => void }) {
  return (
    <div className="ds-seg" role="radiogroup" aria-label={p.label}>
      {p.options.map(([v, l, ic]) => (
        <button key={v} type="button" role="radio" aria-checked={p.value === v} onClick={() => p.onChange(v)}>
          {ic && <Icon name={ic} size={20} />}
          {l}
        </button>
      ))}
    </div>
  );
}

/** Ligne de liste (comme les réglages du téléphone) : icône, titre, précision, valeur ou flèche. */
export function Ligne(p: {
  icon?: IconName;
  badge?: ReactNode;
  badgeClass?: string;
  title: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
  endClass?: string;
  onClick?: () => void;
  label?: string;
  chevron?: boolean;
}) {
  const inner = (
    <>
      {(p.icon || p.badge) && <span className={`ds-row-ico ${p.badgeClass ?? ''}`}>{p.badge ?? <Icon name={p.icon!} size={22} />}</span>}
      <span className="ds-row-txt">
        <b>{p.title}</b>
        {p.sub && <small>{p.sub}</small>}
      </span>
      {(p.end || p.chevron !== false) && (
        <span className={`ds-row-end ${p.endClass ?? ''}`}>
          {p.end}
          {p.onClick && p.chevron !== false && <Icon name="right" size={20} />}
        </span>
      )}
    </>
  );
  return p.onClick ? (
    <button className="ds-row" onClick={p.onClick} aria-label={p.label}>
      {inner}
    </button>
  ) : (
    <div className="ds-row">{inner}</div>
  );
}

export function Section(p: { title?: ReactNode; action?: ReactNode; children: ReactNode; flat?: boolean }) {
  return (
    <section>
      {p.title && (
        <h2 className="ds-section-title">
          <span>{p.title}</span>
          {p.action}
        </h2>
      )}
      {p.flat ? p.children : <div className="ds-list">{p.children}</div>}
    </section>
  );
}

const NIVEAU_TITRE = { stop: 'À régler', attention: 'À vérifier', info: 'Rappel' } as const;
const NIVEAU_ICO = { stop: 'alert', attention: 'warn', info: 'info' } as const;

/** Alertes du calcul et du dispositif, les plus graves d'abord. */
export function AlertesDs({ list, max }: { list: Alerte[]; max?: number }) {
  if (!list.length) return null;
  const ordre = { stop: 0, attention: 1, info: 2 };
  const tri = [...list].sort((a, b) => ordre[a.niveau] - ordre[b.niveau]).slice(0, max ?? list.length);
  return (
    <ul className="ds-alerts">
      {tri.map((a, i) => (
        <li key={i} className={`ds-alert ${a.niveau}`}>
          <Icon name={NIVEAU_ICO[a.niveau]} size={22} />
          <span>
            <b>{NIVEAU_TITRE[a.niveau]}</b>
            {a.texte}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Etat({ c, r, onClick, calculSeul }: { c: Chantier; r: Resultat; onClick?: () => void; calculSeul?: boolean }) {
  const n = calculSeul ? r.dd.erreurs.length + r.alertes.filter((a) => a.niveau === 'stop').length : aRegler(c, r).length;
  const complet = r.da !== null && r.voies.length > 0 && r.voies.every((v) => v.pointAnnonce !== null);
  const cls = n ? 'stop' : complet ? 'ok' : 'todo';
  const txt = n ? `${n} à régler` : complet ? 'Prêt' : 'À compléter';
  const content = (
    <>
      <Icon name={n ? 'alert' : complet ? 'check' : 'edit'} size={16} />
      {txt}
    </>
  );
  return onClick ? (
    <button className={`ds-status ${cls}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <span className={`ds-status ${cls}`}>{content}</span>
  );
}

/** Délai d'annonce en gros, puis pour chaque voie et chaque sens : distance et PK du point d'annonce. */
export function Annonce(p: { r: Resultat; onGo?: (pk: number) => void; manquePk?: boolean }) {
  const { r } = p;
  return (
    <>
      <div className="ds-da">
        <span className="ds-da-num" aria-label={r.da === null ? 'Délai d’annonce à calculer' : `Délai d’annonce ${r.da} secondes`}>
          {r.da ?? '—'}
          <small>s</small>
        </span>
        <span className="ds-da-txt">
          <b>Délai d’annonce</b>
          {r.dd.retenu !== null ? `${r.dd.retenu} s de dégagement + ${r.ms.valeur} s de marge` : 'Délai de dégagement à corriger'}
        </span>
      </div>
      {r.voies.map((v) => {
        const go = p.onGo && v.pointAnnonce !== null ? () => p.onGo!(v.pointAnnonce!) : undefined;
        const body = (
          <>
            <span className="ds-pa-voie" aria-hidden="true">
              {v.voie}
              <span>{SENS_FLECHE[v.sens]}</span>
            </span>
            <span className="ds-pa-main">
              <span className="ds-pa-dist">{v.distance ? `${v.distance} m` : '— m'}</span>
              <small>
                {v.pointAnnonce !== null ? (
                  <>
                    Point d’annonce <b>PK&nbsp;{fmtPk(v.pointAnnonce)}</b>
                  </>
                ) : !v.vitesse ? (
                  'Vitesse à indiquer'
                ) : p.manquePk ? (
                  'Indique le PK du chantier'
                ) : (
                  'Point d’annonce à calculer'
                )}
                {v.vitesse ? ` · ${v.vitesse} km/h` : ''}
              </small>
            </span>
            {go && (
              <span className="ds-pa-go" aria-hidden="true">
                <Icon name="go" size={22} />
              </span>
            )}
          </>
        );
        const label = `${v.voie} ${SENS_FLECHE[v.sens]} : ${v.distance ?? '?'} m${v.pointAnnonce !== null ? `, point d’annonce PK ${fmtPk(v.pointAnnonce)}` : ''}`;
        return (
          <div key={`${v.voieId}-${v.sens}`}>
            {go ? (
              <button className="ds-pa" onClick={go} aria-label={`${label} : y aller`}>
                {body}
              </button>
            ) : (
              <div className="ds-pa" aria-label={label}>
                {body}
              </div>
            )}
            {v.note && <p className="ds-pa-note">{v.note}</p>}
          </div>
        );
      })}
      {!r.voies.length && <p className="ds-hint">Aucune voie annoncée : toutes les voies sont interdites ou hors annonce.</p>}
    </>
  );
}

/** Pourquoi ces valeurs : DD + MS = DA, et les raisons de la marge. */
export function Pourquoi({ r }: { r: Resultat }) {
  return (
    <>
      <div className="ds-formula" aria-label="Calcul du délai d’annonce">
        <span>
          Dégagement<b>{r.dd.retenu ?? '—'} s</b>
        </span>
        <i>+</i>
        <span>
          Marge<b>{r.ms.valeur} s</b>
        </span>
        <i>=</i>
        <span>
          Annonce<b>{r.da ?? '—'} s</b>
        </span>
      </div>
      <ul className="ds-why">
        {r.ms.raisons.map((t) => (
          <li key={t}>Marge : {t}</li>
        ))}
        {r.dd.conseils.map((t) => (
          <li key={t}>{t}</li>
        ))}
        <li>Distance = vitesse ÷ 3,6 × délai d’annonce, arrondie à la dizaine de mètres supérieure.</li>
      </ul>
    </>
  );
}

/** Interdiction de circulation obligatoire : en un toucher, la voie de travail passe « interdite » (avis reçu). */
export function CorrectionDfv({ c, r, set }: { c: Chantier; r: Resultat; set: (patch: Partial<Chantier>) => void }) {
  const travail = c.voies.filter((v) => v.role === 'travail' && !v.interdite);
  if (!r.dfv.length || r.situation !== 'circulee' || !travail.length) return null;
  return (
    <button className="ds-btn wide ds-fix" onClick={() => set({ voies: c.voies.map((v) => (v.role === 'travail' ? { ...v, interdite: true } : v)) })}>
      <Icon name="check" size={20} />
      J’ai l’avis de voie interdite pour {travail.map((v) => v.nom).join(', ')}
    </button>
  );
}
