import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LineDoc } from '../lib/data';
import { chantierFeatures } from './carte';
import { calculChantier, nouveauChantier } from './chantier';
import { annonceurParSens, avecAgentA, codesAgents } from './dispositif';

const doc = JSON.parse(readFileSync('public/data/lines/830000.json', 'utf8')) as LineDoc;

function chantier() {
  const c0 = nouveauChantier({ ligne: '830000', pkDebut: 28.718, pkFin: 28.768 });
  c0.voies = c0.voies.map((v) => ({ ...v, vitesse: 160 }));
  const c = annonceurParSens(c0, calculChantier(c0));
  return { c, r: calculChantier(c) };
}

describe('le chantier sur la carte', () => {
  it('un trait de chaque annonceur jusqu’au point d’annonce qu’il doit voir', () => {
    const { c, r } = chantier();
    const a1 = c.agents.find((a) => codesAgents(c.agents).get(a.id) === 'A1')!;
    // Au point d'annonce : pas de trait.
    expect(chantierFeatures(c, doc, r).features.filter((f) => f.properties?.role === 'vue')).toEqual([]);
    // Rapproché du chantier : trait rose jusqu'au point, avec la distance à voir.
    const fc = chantierFeatures(avecAgentA(c, a1.id, 28.7), doc, r);
    const vue = fc.features.filter((f) => f.properties?.role === 'vue');
    expect(vue.length).toBeGreaterThan(0);
    expect(vue[0].properties).toMatchObject({ etat: 'voir', label: 'A1 → PA V1 ▲ · 432 m' });
    expect(vue[0].geometry.type).toBe('LineString');
    // Sa fiche : son point d'annonce, où il est, et le calcul.
    const pt = fc.features.find((f) => f.properties?.aid === a1.id)!;
    const pas = JSON.parse(pt.properties!.pas as string);
    expect(pas).toEqual([
      {
        t: 'PA V1 ▲',
        pk: '28+268',
        e: 'voir',
        x: 'Doit voir arriver les trains sur 432 m, jusqu’au PK 28+268 : à vérifier sur place.',
        k: '160 km/h × 10 s (dégagement 5 s + marge 5 s) = 450 m avant le chantier (PK 28+718).',
      },
    ]);
    // Au-delà : trait gris.
    const loin = chantierFeatures(avecAgentA(c, a1.id, 28.2), doc, r).features.find((f) => f.properties?.role === 'vue');
    expect(loin?.properties).toMatchObject({ etat: 'audela', label: 'A1 au-delà du PA V1 ▲ · 68 m' });
  });
});
