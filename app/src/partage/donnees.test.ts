import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculChantier, nouveauChantier } from '../asp/chantier';
import { noterJalon } from '../asp/deroule';
import { annonceurParSens } from '../asp/dispositif';
import { nouvelleMissionLam } from '../lam/mission';
import type { LineDoc } from '../lib/data';
import { nouvelleMission } from '../pn/mission';
import { centreDe, depuis, donneesChantier, donneesLam, donneesPn, partagesFeatures } from './donnees';
import { cleanSession, formatSession, sessionFromHash, type Partage } from './session';

const doc = JSON.parse(readFileSync('public/data/lines/830000.json', 'utf8')) as LineDoc;
const t = (h: number, m: number) => new Date(2026, 10, 27, h, m).getTime();

function chantier() {
  const c0 = nouveauChantier({ nom: 'Traverses', ligne: '830000', pkDebut: 28.718, pkFin: 28.768, date: '2026-11-27' });
  c0.voies = c0.voies.map((v) => ({ ...v, vitesse: 160 }));
  const c = annonceurParSens(c0, calculChantier(c0));
  return { c, r: calculChantier(c) };
}

describe('code chantier', () => {
  it('6 signes, affichés par 3, lus dans un lien', () => {
    expect(cleanSession('k7p 3qx-9')).toBe('K7P3QX');
    expect(formatSession('k7p3qx')).toBe('K7P-3QX');
    expect(sessionFromHash('#chantier=K7P-3QX')).toBe('K7P3QX');
    expect(sessionFromHash('#code=ABCD-EF23')).toBeNull();
  });
});

describe('ce que chacun partage', () => {
  it('ASP : zone, points d’annonce, chaîne et état de l’annonce, placés sur la carte', () => {
    const { c, r } = chantier();
    const avant = donneesChantier(c, r, doc);
    expect(avant).toMatchObject({ titre: 'Traverses', etat: 'Chaîne d’annonce pas encore en place', niveau: 'attente', ligne: '830000' });
    expect(avant.details).toContain('Annonce : V1 ▲ 450 m (PA PK 28+268), V2 ▼ 450 m (PA PK 29+218)');
    expect(avant.details.join()).toMatch(/Chaîne : A1 PK 28\+268 · A2 PK 29\+218/);
    const roles = avant.geo.map((f) => f.properties?.r);
    expect(roles).toContain('zone');
    expect(roles.filter((x) => x === 'pa')).toHaveLength(2);
    expect(roles.filter((x) => x === 'agent')).toHaveLength(2);
    // Coordonnées arrondies au mètre.
    const pt = avant.geo.find((f) => f.geometry.type === 'Point')!.geometry as GeoJSON.Point;
    expect(String(pt.coordinates[0]).split('.')[1].length).toBeLessThanOrEqual(5);

    const d = noterJalon(noterJalon(c.deroule, 'enPlace', t(22, 5)), 'debut', t(22, 10));
    expect(donneesChantier({ ...c, deroule: d }, r, doc)).toMatchObject({ etat: 'Chaîne d’annonce en place depuis 22:05 · travaux en cours', niveau: 'en-place' });
    expect(donneesChantier({ ...c, deroule: noterJalon(d, 'leve', t(23, 0)) }, r, doc)).toMatchObject({ etat: 'Chaîne d’annonce levée à 23:00', niveau: 'fini' });
    // Sans la ligne (pas encore chargée) : le texte seulement.
    expect(donneesChantier(c, r, null).geo).toEqual([]);
    // Assez léger pour le serveur (24 ko au plus).
    expect(JSON.stringify(avant).length).toBeLessThan(8000);
  });

  it('agent PN et AP LAM / S9 : le point et l’état de la mission', () => {
    let m = nouvelleMission({ date: '2026-11-27' });
    m = { ...m, pn: { ...m.pn, numero: '26', ligne: '830000', pk: 28.9, lieu: 'VC · Lieusaint' } };
    const pn = donneesPn(m, doc);
    expect(pn).toMatchObject({ titre: 'PN 26 · ligne 830 000', etat: 'Pas encore en poste', niveau: 'attente' });
    expect(pn.geo).toHaveLength(1);
    expect(pn.geo[0].properties).toEqual({ r: 'pn', label: 'PN 26' });
    expect(donneesPn({ ...m, fin: t(6, 0) }, doc)).toMatchObject({ etat: 'Mission finie à 06:00', niveau: 'fini' });

    const lam = donneesLam(nouvelleMissionLam({ type: 's9', bouclage: 'A3', outils: ['dsh'], date: '2026-11-27', lieu: { ligne: '830000', ligneNom: null, pk: 28.8, voie: '1', lieu: '' } }), doc);
    expect(lam).toMatchObject({ titre: 'AP S9 · A3 · ligne 830 000', niveau: 'attente' });
    expect(lam.details).toContain('Bouclage A3 · DSh');
    expect(lam.geo[0].properties).toEqual({ r: 'lam', label: 'S9 A3' });
  });

  it('la carte des autres : pas soi-même, chaque point avec qui, quoi, état et téléphone', () => {
    const { c, r } = chantier();
    const p = (appareil: string, nom: string): Partage => ({ appareil, activite: 'asp', nom, tel: '06 12 34 56 78', donnees: donneesChantier(c, r, doc), maj: t(22, 0) });
    const fc = partagesFeatures([p('moi-12345', 'Moi'), p('autre-12345', 'Ali')], 'moi-12345');
    expect(fc.features.length).toBeGreaterThan(0);
    expect(new Set(fc.features.map((f) => f.properties?.app))).toEqual(new Set(['autre-12345']));
    expect(fc.features[0].properties).toMatchObject({ act: 'asp', niv: 'attente', n: 'ASP · Ali', t: 'Traverses', tel: '06 12 34 56 78' });
    const centre = centreDe(p('autre-12345', 'Ali'))!;
    expect(centre[0]).toBeCloseTo(2.56, 1);
    expect(depuis(t(22, 0), t(22, 3))).toBe('il y a 3 min');
    expect(depuis(t(22, 0), t(23, 5))).toBe('il y a 1 h 05');
  });
});
