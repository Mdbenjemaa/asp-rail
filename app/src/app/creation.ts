/**
 * « Nouveau chantier », « Nouvelle mission PN », « Nouvelle mission LAM / S9 » : crée un brouillon gardé sur le
 * téléphone (retiré au prochain lancement s'il reste vide) et rend l'écran de création à ouvrir.
 */
import type { Vue } from '../asp/contexte';
import { nouveauChantier } from '../asp/chantier';
import { enregistrer } from '../asp/store';
import { enregistrerMissionLam, nouvelleMissionLam } from '../lam/mission';
import { garderDurablement } from '../lib/collection';
import { enregistrerMission, nouvelleMission } from '../pn/mission';

export function creer(quoi: 'chantier' | 'pn' | 'lam'): Vue {
  // Première chose à garder : on demande au navigateur de ne pas effacer les données de l'appli.
  garderDurablement();
  if (quoi === 'chantier') {
    const c = nouveauChantier({ brouillon: true });
    enregistrer(c);
    return { k: 'assistant', id: c.id };
  }
  if (quoi === 'pn') {
    const m = nouvelleMission({ brouillon: true });
    enregistrerMission(m);
    return { k: 'pn-nouvelle', id: m.id };
  }
  const m = nouvelleMissionLam({ brouillon: true });
  enregistrerMissionLam(m);
  return { k: 'lam-nouvelle', id: m.id };
}
