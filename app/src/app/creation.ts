/**
 * « Nouveau chantier », « Nouvelle mission PN », « Nouvelle mission LAM / S9 » : crée un brouillon gardé sur le
 * téléphone (retiré au prochain lancement s'il reste vide) et rend l'écran de création à ouvrir.
 * Si le planning ETF importé prévoit un service maintenant, la date, l'horaire, le chantier et le lieu sont
 * préremplis (modifiables).
 */
import type { Vue } from '../asp/contexte';
import { nouveauChantier } from '../asp/chantier';
import { enregistrer } from '../asp/store';
import { enregistrerMissionLam, nouvelleMissionLam } from '../lam/mission';
import { garderDurablement } from '../lib/collection';
import { enregistrerMission, nouvelleMission } from '../pn/mission';
import { horaireTexte, resume, serviceDuMoment, travaille, type JourPlanning } from '../planning/jour';
import { jourDans, lireSemaines } from '../planning/store';

export interface Creation {
  vue: Vue;
  /** Ce qui vient du planning (« RGI EXEMPLE · 21h00-04h00 »), si quelque chose a été prérempli. */
  prerempli: string | null;
}

function serviceActuel(): JourPlanning | null {
  try {
    const s = serviceDuMoment((d) => jourDans(lireSemaines(), d));
    return travaille(s) ? s : null;
  } catch {
    return null;
  }
}

export function creer(quoi: 'chantier' | 'pn' | 'lam'): Creation {
  // Première chose à garder : on demande au navigateur de ne pas effacer les données de l'appli.
  garderDurablement();
  const s = serviceActuel();
  const horaire = s ? (s.nuit ? 'nuit' : 'jour') : undefined;
  const notes = s ? `Planning ETF : ${resume(s)}` : '';
  const prerempli = s ? [s.chantier, horaireTexte(s)].filter(Boolean).join(' · ') || resume(s) : null;
  if (quoi === 'chantier') {
    const c = nouveauChantier({ brouillon: true, ...(s ? { nom: s.chantier, date: s.date, horaire, notes } : {}) });
    enregistrer(c);
    return { vue: { k: 'assistant', id: c.id }, prerempli };
  }
  if (quoi === 'pn') {
    const m = nouvelleMission({ brouillon: true, ...(s ? { date: s.date, horaire, notes } : {}) });
    if (s) m.pn = { ...m.pn, lieu: s.lieu || s.ps };
    enregistrerMission(m);
    return { vue: { k: 'pn-nouvelle', id: m.id }, prerempli };
  }
  const poste = s?.poste.toUpperCase() ?? '';
  const m = nouvelleMissionLam({
    brouillon: true,
    ...(s ? { date: s.date, horaire, type: /S9/.test(poste) && !/LAM/.test(poste) ? 's9' : 'lam' } : {}),
  });
  if (s) m.lieu = { ...m.lieu, lieu: [s.chantier, s.lieu || s.ps].filter(Boolean).join(' · ') };
  enregistrerMissionLam(m);
  return { vue: { k: 'lam-nouvelle', id: m.id }, prerempli };
}
