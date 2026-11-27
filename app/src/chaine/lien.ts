/**
 * La chaîne d'annonce reliée par le chantier partagé. L'ASP y partage sa chaîne (A1, R1, S1… à leur PK, avec ce
 * qu'ils surveillent et les points d'annonce à voir) ; chaque agent y prend son poste d'un toucher, son poste suit
 * ensuite ce que l'ASP change, et l'ASP voit qui est en place.
 */
import { useEffect, useMemo } from 'react';
import type { Maillon } from '../partage/donnees';
import { definirMonPartage, monAppareil, useMonPartage, usePartages, useSession, type Partage } from '../partage/session';
import { fmtPk } from '../lib/format';
import { enregistrerPoste, nouveauPoste, posteDuJour, usePostes, type Poste } from './poste';

/** Côté ASP : les agents qui ont pris un poste dans ma chaîne, par code (A1…). */
export function useMaillonsLies(): Map<string, Partage> {
  const { partages } = usePartages();
  return useMemo(() => {
    const moi = monAppareil();
    const m = new Map<string, Partage>();
    for (const p of partages) if (p.activite === 'chaine' && p.donnees.lien?.asp === moi) m.set(p.donnees.lien.code, p);
    return m;
  }, [partages]);
}

/** Côté agent : les chaînes que des ASP partagent sur le chantier partagé. */
export function useChainesPartagees(): Partage[] {
  const { partages } = usePartages();
  return useMemo(() => partages.filter((p) => p.activite === 'asp' && p.appareil !== monAppareil() && (p.donnees.chaine?.length ?? 0) > 0), [partages]);
}

/** Le poste tel que le décrit la chaîne de l'ASP. */
function depuisMaillon(base: Poste, asp: Partage, m: Maillon, session: string): Poste {
  return {
    ...base,
    role: m.role,
    code: m.code,
    chantier: asp.donnees.titre,
    ligne: asp.donnees.ligne,
    pk: m.pk,
    surveille: m.surveille,
    pas: m.pas,
    asp: asp.nom,
    aspTel: asp.tel,
    lien: { asp: asp.appareil, session },
  };
}

/** Prendre un poste dans la chaîne d'un ASP : le poste est créé (ou repris) et partagé, pour que l'ASP voie qui est en place. */
export function prendrePoste(asp: Partage, m: Maillon, session: string, qui: { nom: string; tel: string }, actuel: Poste | null): Poste {
  const p = depuisMaillon(actuel && !actuel.fin ? actuel : nouveauPoste(), asp, m, session);
  enregistrerPoste(p);
  definirMonPartage({ actif: true, activite: 'chaine', id: p.id, nom: qui.nom, tel: qui.tel });
  return p;
}

/** Le poste relié suit la chaîne de l'ASP : le nouveau poste et un message si l'ASP a changé quelque chose. */
export function majPosteLie(p: Poste, partages: Partage[]): { poste: Poste; message: string } | null {
  if (!p.lien || p.fin) return null;
  const asp = partages.find((x) => x.appareil === p.lien!.asp && x.activite === 'asp');
  const m = asp?.donnees.chaine?.find((x) => x.code === p.code);
  if (!asp || !m) return null;
  const n = depuisMaillon(p, asp, m, p.lien.session);
  const cle = (x: Poste) => JSON.stringify([x.pk, x.pas, x.surveille, x.chantier, x.ligne, x.asp, x.aspTel, x.role]);
  if (cle(n) === cle(p)) return null;
  const message =
    n.pk !== p.pk && n.pk !== null
      ? `L’ASP a déplacé ton poste ${p.code} : PK ${fmtPk(n.pk)}.`
      : JSON.stringify(n.pas) !== JSON.stringify(p.pas)
        ? `L’ASP a changé ce que tu dois voir : ${n.pas.map((x) => `${x.titre} au PK ${fmtPk(x.pk)}`).join(', ') || 'plus de point d’annonce'}.`
        : `L’ASP a mis à jour ton poste ${p.code}.`;
  return { poste: n, message };
}

/** Tant que l'appli est ouverte : le poste relié suit la chaîne de l'ASP (message à chaque changement). */
export function useSuiviPoste(onMessage: (m: string) => void) {
  const { partages, lu } = usePartages();
  const postes = usePostes();
  const session = useSession();
  const moi = useMonPartage();
  useEffect(() => {
    if (!session || !lu) return;
    const p = posteDuJour(postes);
    if (!p?.lien || p.lien.session !== session.code) return;
    const maj = majPosteLie(p, partages);
    if (!maj) return;
    enregistrerPoste(maj.poste);
    onMessage(maj.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partages, lu, session, moi]);
}
