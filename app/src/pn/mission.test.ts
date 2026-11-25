import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinePoint } from '../lib/data';
import {
  ajouterNote,
  avancement,
  cocher,
  cocherGeste,
  demarrerProcedure,
  journalTexte,
  lieuPn,
  missionParId,
  nouvelleMission,
  phases,
  pnsProches,
  procedure,
  enregistrerMission,
  supprimerMission,
  terminerProcedure,
  titreMission,
  toutesEtapes,
  type Mission,
} from './mission';

const ids = (m: Mission) => toutesEtapes(m).map((e) => e.id);
const mission = (pn: Partial<Mission['pn']> = {}, init: Partial<Mission> = {}) => {
  const m = nouvelleMission(init);
  return { ...m, pn: { ...m.pn, ...pn } };
};
/** Coche toutes les étapes obligatoires jusqu'à `jusqua` exclu. */
const avancerJusqua = (m: Mission, jusqua: string) => {
  for (const e of toutesEtapes(m)) {
    if (e.id === jusqua) break;
    if (!e.facultative) m = cocher(m, e, true);
  }
  return m;
};

describe('phases d’une mission PN', () => {
  it('agent PN pour travaux, boîtier hors BAL : vérifications puis prise en travaux par le CSR', () => {
    const m = mission({ commande: 'boitier', bal: false });
    expect(phases(m).map((p) => p.id)).toEqual(['avant', 'verif', 'prise', 'fin']);
    const l = ids(m);
    expect(l).not.toContain('blocage');
    expect(l.indexOf('identifier')).toBeLessThan(l.indexOf('ordre'));
    expect(l.indexOf('dsh')).toBeLessThan(l.indexOf('csr-fermeture'));
    expect(l.indexOf('csr-fermeture')).toBeLessThan(l.indexOf('csr-ouverture'));
    expect(l.at(-1)).toBe('arf');
  });

  it('sur ligne BAL, le blocage sur FERMETURE passe en premier', () => {
    const m = mission({ commande: 'boitier', bal: true });
    const prise = phases(m).find((p) => p.id === 'prise')!;
    expect(prise.etapes[0].id).toBe('blocage');
  });

  it('commutateur Marche-Arrêt : ARRÊT puis MARCHE, sans CSR', () => {
    const l = ids(mission({ commande: 'ma' }));
    expect(l).toContain('ma-arret');
    expect(l).toContain('ma-marche');
    expect(l).not.toContain('csr-fermeture');
    expect(l.indexOf('ma-arret')).toBeLessThan(l.indexOf('ma-marche'));
  });

  it('agent PN pour franchissement : surveillance, sans prise en travaux', () => {
    const m = mission({}, { role: 'franchissement' });
    expect(phases(m).map((p) => p.id)).toEqual(['avant', 'verif', 'fin']);
    expect(ids(m)).toEqual(expect.arrayContaining(['ordre-surv', 'bcm-repris', 'sam-places', 'debut-surv', 'fin-recue', 'fin-passee', 'arf']));
  });

  it('les dépêches à noter sont signalées', () => {
    const m = mission();
    const avecDepeche = toutesEtapes(m)
      .filter((e) => e.depeche)
      .map((e) => e.id);
    expect(avecDepeche).toEqual(expect.arrayContaining(['ordre', 'compte']));
  });
});

describe('avancement et journal', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
    });
  });

  it('donne la prochaine étape et ne compte pas les facultatives', () => {
    const m = mission();
    const a = avancement(m);
    expect(a.prochaine?.id).toBe('briefing');
    expect(a.faites).toBe(0);
    expect(a.total).toBe(toutesEtapes(m).filter((e) => !e.facultative).length);
    expect(a.pendant).toBe(false);
  });

  it('cocher note l’étape au journal avec sa dépêche ; décocher la retire', () => {
    let m = mission();
    const ordre = toutesEtapes(m).find((e) => e.id === 'ordre')!;
    m = cocher(m, ordre, true, 'D 12');
    expect(m.faits.ordre).toBeGreaterThan(0);
    expect(m.depeches.ordre).toBe('D 12');
    expect(m.journal).toHaveLength(1);
    expect(m.journal[0].note).toBe('D 12');
    m = cocher(m, ordre, false);
    expect(m.faits.ordre).toBeUndefined();
    expect(m.journal).toHaveLength(0);
  });

  it('« pendant » le chantier une fois la prise faite, fin enregistrée avec l’ARF', () => {
    let m = avancerJusqua(mission(), 'fin-recue');
    const a = avancement(m);
    expect(a.pendant).toBe(true);
    expect(a.prochaine?.id).toBe('fin-recue');
    m = avancerJusqua(m, '__fin__');
    expect(m.fin).toBeGreaterThan(0);
    expect(avancement(m).prochaine).toBeNull();
    expect(avancement(m).pendant).toBe(false);
  });

  it('le journal partagé reprend le PN, les heures et les dépêches', () => {
    let m = mission({ numero: '11', ligne: '830000', lieu: 'VC · La Rochette' });
    m = cocher(m, toutesEtapes(m).find((e) => e.id === 'ordre')!, true, 'D 12');
    m = ajouterNote(m, 'Barrière lente côté route');
    const t = journalTexte(m);
    expect(titreMission(m)).toBe('PN 11 · ligne 830 000');
    expect(t).toContain('PN 11');
    expect(t).toContain('D 12');
    expect(t).toContain('Barrière lente côté route');
    expect(t).toMatch(/\d{2}:\d{2}/);
  });

  it('enregistre, relit et supprime la mission sur le téléphone', () => {
    const m = mission({ numero: '26' });
    enregistrerMission(m);
    expect(missionParId(m.id)?.pn.numero).toBe('26');
    supprimerMission(m.id);
    expect(missionParId(m.id)).toBeNull();
  });
});

describe('mobile travaux et LAM', () => {
  it('mobile travaux : SAM le plus éloigné retiré d’abord, le plus proche remis d’abord', () => {
    const l = procedure(mission(), 'mobile').map((e) => e.id);
    expect(l.indexOf('fermer')).toBeLessThan(l.indexOf('sam-loin'));
    expect(l.indexOf('sam-loin')).toBeLessThan(l.indexOf('sam-pres'));
    expect(l.indexOf('traversee')).toBeLessThan(l.indexOf('sam-remis'));
    expect(l.at(-1)).toBe('verrou');
  });

  it('LAM : fiche, fermeture, barrière, puis réouverture', () => {
    const l = procedure(mission(), 'lam').map((e) => e.id);
    expect(l[0]).toBe('fiche');
    expect(l).toEqual(expect.arrayContaining(['fermer', 'sam-amont', 'barriere', 'sam-retrait', 'sam-remis', 'ouvrir', 'verrou']));
  });

  it('un passage terminé incrémente le compteur et s’inscrit au journal', () => {
    let m = demarrerProcedure(mission(), 'mobile');
    expect(m.enCours?.type).toBe('mobile');
    m = cocherGeste(m, 'mobile', 'fermer', true);
    expect(m.enCours?.faits.fermer).toBeGreaterThan(0);
    expect(demarrerProcedure(m, 'mobile').enCours?.faits.fermer).toBeGreaterThan(0);
    const r = terminerProcedure(m, 'mobile');
    expect(r.m.passages).toBe(1);
    expect(r.m.enCours).toBeNull();
    expect(r.texte).toMatch(/^Passage du mobile travaux n° 1 \(de \d{2}:\d{2} à \d{2}:\d{2}\)$/);
    expect(r.m.journal.at(-1)?.type).toBe('passage');
    expect(terminerProcedure(r.m, 'lam').m.lam).toBe(1);
  });
});

describe('PN des données ouvertes', () => {
  it('lieuPn garde la voie et la commune', () => {
    expect(lieuPn('Classe 17 · VC · La Rochette (77389)')).toBe('VC · La Rochette');
    expect(lieuPn('')).toBe('');
  });

  it('pnsProches trie par distance et indique le sens', () => {
    const pts: LinePoint[] = [
      [40.5, 'pn', 'PN 26', 'Classe 17 · VC · La Rochette (77389)', 2.6, 48.5],
      [41.2, 'gare', 'Melun', '', 2.65, 48.53],
      [40.15, 'pn', 'PN 25', 'Classe 17 · RD 39 · Melun (77288)', 2.6, 48.5],
      [43, 'pn', 'PN 27', '', 2.6, 48.5],
    ] as LinePoint[];
    const r = pnsProches(pts, 40.3);
    expect(r.map((p) => p.nom)).toEqual(['PN 25', 'PN 26', 'PN 27']);
    expect(r[0]).toMatchObject({ numero: '25', distance: 150, devant: false, lieu: 'RD 39 · Melun' });
    expect(r[1].devant).toBe(true);
    expect(pnsProches(undefined, 1)).toEqual([]);
  });
});
