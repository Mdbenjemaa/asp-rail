/** Prendre son poste dans la chaîne qu'un ASP partage sur le chantier partagé. */
import { useState, type ReactNode } from 'react';
import { loadAccess } from '../access/gate';
import { fmtPk } from '../lib/format';
import { nomAgent } from '../lib/signature';
import { Feuille } from '../asp/Fiche';
import { Ligne } from '../asp/kit';
import { monAppareil, useMonPartage, usePartages, useSession, type Partage } from '../partage/session';
import { prendrePoste, useChainesPartagees } from './lien';
import { posteDuJour, ROLE_CHAINE, usePostes, type Poste } from './poste';

/** Prendre son poste dans la chaîne qu'un ASP partage : la liste des chaînes, puis les postes de la chaîne choisie. */
export function usePrendrePoste(): { chaines: Partage[]; boutons: (onPris: (p: Poste) => void) => ReactNode } {
  const chaines = useChainesPartagees();
  const session = useSession();
  const moi = useMonPartage();
  const postes = usePostes();
  const { partages } = usePartages();
  const [choix, setChoix] = useState<Partage | null>(null);
  const qui = { nom: moi?.nom || nomAgent() || loadAccess()?.nom || '', tel: moi?.tel ?? '' };
  const prisPar = (asp: string, code: string) =>
    partages.find((x) => x.activite === 'chaine' && x.appareil !== monAppareil() && x.donnees.lien?.asp === asp && x.donnees.lien.code === code);
  const boutons = (onPris: (p: Poste) => void) => (
    <>
      {chaines.map((c) => (
        <Ligne
          key={c.appareil}
          icon="vest"
          badgeClass="navy"
          title={`Chaîne de ${c.nom || 'l’ASP'}`}
          sub={`${c.donnees.titre} · ${c.donnees.chaine!.length} poste${c.donnees.chaine!.length > 1 ? 's' : ''}`}
          onClick={() => setChoix(c)}
        />
      ))}
      {choix && session && (
        <Feuille title={`Chaîne de ${choix.nom || 'l’ASP'}`} onClose={() => setChoix(null)}>
          <p className="ds-hint">Touche ton poste : ton PK, ce que tu surveilles et ton point d’annonce viennent de la chaîne, et ton ASP voit quand tu es en place.</p>
          <div className="ds-list">
            {choix.donnees.chaine!.map((m) => {
              const autre = prisPar(choix.appareil, m.code);
              return (
                <Ligne
                  key={m.code}
                  badge={m.code}
                  badgeClass={m.role === 'annonceur' ? 'brand' : ''}
                  title={`${ROLE_CHAINE[m.role]} ${m.code}${autre ? ` · pris par ${autre.nom || 'un agent'}` : ''}`}
                  sub={[m.pk !== null ? `PK ${fmtPk(m.pk)}` : 'PK à indiquer', m.surveille].filter(Boolean).join(' · ')}
                  onClick={() => {
                    const p = prendrePoste(choix, m, session.code, qui, posteDuJour(postes));
                    setChoix(null);
                    onPris(p);
                  }}
                />
              );
            })}
          </div>
        </Feuille>
      )}
    </>
  );
  return { chaines, boutons };
}
