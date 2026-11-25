/** Petites fonctions de l'interface (sans écran) : étapes, dates, résumés, état d'un chantier. */
import { fmtLine } from '../lib/format';
import { zoneTexte, type Chantier, type RoleAgent } from './chantier';
import type { EtapeId } from './contexte';
import { controlesDispositif } from './dispositif';
import { voiesAnnoncees, type Alerte, type Resultat } from './rules';
import { OUTILLAGES, PARTICULARITES } from './textes';
import { MODELES, modeleDe } from './voies';

export const ETAPES: { id: EtapeId; titre: string; court: string }[] = [
  { id: 'lieu', titre: 'Où est le chantier ?', court: 'Lieu' },
  { id: 'type', titre: 'Comment se passe le chantier ?', court: 'Type et horaire' },
  { id: 'voies', titre: 'Quelles voies ?', court: 'Voies' },
  { id: 'vitesses', titre: 'À quelle vitesse roulent les trains ?', court: 'Vitesses' },
  { id: 'outillage', titre: 'Avec quel outillage ?', court: 'Outillage' },
  { id: 'degagement', titre: 'Combien de temps pour dégager la voie ?', court: 'Dégagement' },
  { id: 'cas', titre: 'Un cas particulier ?', court: 'Cas particuliers' },
  { id: 'resultat', titre: 'Ton annonce', court: 'Résultat' },
];

export const NB_QUESTIONS = ETAPES.length - 1;

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Le chantier à montrer en grand : celui affiché sur la carte, sinon celui du jour, sinon le dernier touché. */
export function chantierDuJour(list: Chantier[], actif: Chantier | null): Chantier | null {
  if (actif) return actif;
  const recents = [...list].sort((a, b) => b.updated - a.updated);
  return recents.find((c) => c.date === today()) ?? recents[0] ?? null;
}

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

/** « Aujourd'hui », « Demain », « Hier » ou la date. */
export function jourTexte(iso: string): string {
  const d = new Date();
  const key = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (iso === key(d)) return 'Aujourd’hui';
  if (iso === key(new Date(d.getTime() + 86_400_000))) return 'Demain';
  if (iso === key(new Date(d.getTime() - 86_400_000))) return 'Hier';
  return fmtDate(iso);
}

/** Ce qui a été répondu à chaque étape, en une ligne. */
export function resumeEtape(c: Chantier, id: EtapeId): string {
  switch (id) {
    case 'lieu':
      return c.ligne ? `Ligne ${fmtLine(c.ligne)} · ${zoneTexte(c)}` : 'À indiquer';
    case 'type': {
      const t = c.type === 'fixe' ? 'Fixe' : c.type === 'mobile' ? `Mobile${c.longueurAnnonce ? `, ${c.longueurAnnonce} m sous annonce` : ''}` : 'Itinérant';
      return `${t} · ${c.horaire === 'nuit' ? 'de nuit' : 'de jour'} · ${jourTexte(c.date).toLowerCase()}`;
    }
    case 'voies': {
      const m = MODELES.find((x) => x.id === modeleDe(c.voies));
      const t = c.voies.filter((v) => v.role === 'travail');
      return `${m?.label ?? c.voies.map((v) => v.nom).join(', ')}${t.length ? ` · travail sur ${t.map((v) => `${v.nom}${v.interdite ? ' (interdite)' : ''}`).join(', ')}` : ''}`;
    }
    case 'vitesses': {
      const vs = voiesAnnoncees(c.voies);
      if (!vs.length) return 'Aucune voie annoncée';
      if (vs.some((v) => !v.vitesse)) return 'À indiquer';
      return vs.every((v) => v.vitesse === vs[0].vitesse) ? `${vs[0].vitesse} km/h` : vs.map((v) => `${v.nom} ${v.vitesse}`).join(' · ') + ' km/h';
    }
    case 'outillage':
      return OUTILLAGES.find((o) => o.id === c.outillage)?.label ?? '';
    case 'degagement':
      return c.dd === null ? 'À indiquer' : c.dd === 0 ? 'Délai nul' : `${c.dd} s`;
    case 'cas': {
      const on = PARTICULARITES.filter((x) => c.p[x.key]);
      return on.length ? `${on.length} : ${on.map((x) => x.label.split(/[,(:]/)[0].trim().toLowerCase()).join(', ')}` : 'Aucun';
    }
    default:
      return '';
  }
}

/** Ce qui reste à régler (calcul + dispositif) : sert à l'état « Prêt » / « 2 à régler ». */
export function aRegler(c: Chantier, r: Resultat): Alerte[] {
  return [
    ...r.dd.erreurs.map((texte) => ({ niveau: 'stop' as const, texte })),
    ...r.alertes.filter((a) => a.niveau === 'stop'),
    ...controlesDispositif(c, r).filter((a) => a.niveau === 'stop'),
  ];
}

export const ROLES_CHAINE: [Exclude<RoleAgent, 'asp'>, string][] = [
  ['annonceur', 'Annonceur'],
  ['repetiteur', 'Répétiteur'],
  ['sentinelle', 'Sentinelle'],
];


