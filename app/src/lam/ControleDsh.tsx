/**
 * « Puis-je poser un DSh ici ? » : ce que la position GPS laisse voir (LGV, signal à moins de 30 m, PN proche),
 * puis les contrôles à faire soi-même. Indicatif : le schéma de ligne et la situation géographique priment.
 */
import { useState } from 'react';
import { Icon } from '../components/parts';
import type { Ctx } from '../asp/contexte';
import { usePositionDirecte } from '../asp/direct';
import { Ecran } from '../asp/kit';
import { fmtLine, fmtPk } from '../lib/format';
import { controleDsh } from './mission';

const A_VERIFIER = [
  'Pas dans la zone d’incertitude de shuntage (cornière dans l’axe de la voie, ou tuyau plastique contre l’âme du rail)',
  'Table de roulement des deux rails non oxydée',
  'DSh en bon état et dans sa date de validité',
  'Sur les rails en service : pas sur un rail de sécurité ni un LRS en attente',
  'Au schéma de ligne : ne ferme pas un PN à SAL, ne perturbe pas une TVP, ne dérange pas les annonces d’un PN gardé',
  'Gants mis',
];

export function ControleDsh(p: { ctx: Ctx; hidden?: boolean }) {
  const { etat, pos } = usePositionDirecte(!p.hidden);
  const [coches, setCoches] = useState<Record<number, boolean>>({});
  const c = etat === 'ok' && pos ? controleDsh({ lgv: pos.lgv, signal: pos.signal, pn: pos.pn }) : null;
  const tout = A_VERIFIER.every((_, k) => coches[k]);
  return (
    <Ecran label="Pose d’un DSh" title="Puis-je poser un DSh ici ?" onBack={p.ctx.back} hidden={p.hidden}>
      {c && pos ? (
        <section className={`ds-verdict ${c.niveau === 'interdit' ? 'fermeture' : c.niveau === 'verifier' ? 'ouverture' : 'normal'}`} aria-label="Ce que dit ta position">
          <span className="ds-tag">
            Ligne {fmtLine(pos.code)} · PK {fmtPk(pos.pk)}
          </span>
          <h2>{c.niveau === 'interdit' ? 'Interdit ici' : c.niveau === 'verifier' ? 'À vérifier' : 'Rien de proche dans les données'}</h2>
          <p>{c.niveau === 'ok' ? 'Ni LGV, ni signal à moins de 30 m, ni PN à moins de 3 km. Fais quand même les contrôles ci-dessous.' : 'Regarde le détail ci-dessous.'}</p>
        </section>
      ) : (
        <section className="ds-verdict quiet" aria-label="Ce que dit ta position">
          <h2>{etat === 'recherche' ? 'Recherche de ta position…' : etat === 'loin' ? 'Aucune ligne à moins de 300 m' : 'Position GPS non autorisée'}</h2>
          <p>{etat === 'arret' || etat === 'erreur' ? 'Autorise la position (bouton « Me repérer » sur la carte) pour les contrôles automatiques. Les contrôles à la main restent valables.' : 'Les contrôles à la main restent valables.'}</p>
        </section>
      )}
      {c && c.points.length > 0 && (
        <ol className="ds-steps" style={{ marginTop: 12 }}>
          {c.points.map((x) => (
            <li key={x.titre}>
              <b>{x.titre}</b> {x.texte}
            </li>
          ))}
        </ol>
      )}
      <h3 className="ds-section-title">À vérifier toi-même</h3>
      <div className="ds-list">
        {A_VERIFIER.map((t, k) => (
          <label key={t} className={`ds-row ds-check ${coches[k] ? 'on' : ''}`}>
            <input type="checkbox" checked={!!coches[k]} onChange={(e) => setCoches({ ...coches, [k]: e.target.checked })} />
            <span className="ds-row-txt">
              <b>{t}</b>
            </span>
          </label>
        ))}
      </div>
      {tout && c?.niveau !== 'interdit' && (
        <div className="ds-alert info" style={{ marginTop: 12 }}>
          <Icon name="check" size={22} />
          <span>
            <b>Contrôles faits</b>
            Pose sur ordre du CCh par dépêche, avec autocontrôle.
          </span>
        </div>
      )}
      <p className="ds-foot">
        Indicatif, d’après les données ouvertes SNCF Réseau : le sens de la voie n’y est pas, et la zone d’annonce d’un PN se lit au schéma de ligne. Le schéma de ligne, la
        situation géographique et la fiche de travail priment.
      </p>
    </Ecran>
  );
}
