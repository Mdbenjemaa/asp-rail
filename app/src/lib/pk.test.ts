import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LineDoc } from './data';
import { distance } from './geo';
import { parsePk, parsePkQuery, pkPres, pkRange, positionsAtPk } from './pk';

const line = (code: string) => JSON.parse(readFileSync(`public/data/lines/${code}.json`, 'utf8')) as LineDoc;

describe('saisie des PK', () => {
  it('lit les écritures courantes', () => {
    expect(parsePk('45+200')).toBeCloseTo(45.2);
    expect(parsePk('PK 45+200')).toBeCloseTo(45.2);
    expect(parsePk('45,2')).toBeCloseTo(45.2);
    expect(parsePk('45.25')).toBeCloseTo(45.25);
    expect(parsePk('45')).toBe(45);
    expect(parsePk('45 200')).toBeCloseTo(45.2);
    expect(parsePk('45200')).toBeCloseTo(45.2);
    expect(parsePk('0-771')).toBeCloseTo(-0.771);
    expect(parsePk('abc')).toBeNull();
  });
  it('reconnaît ligne + PK dans la recherche', () => {
    expect(parsePkQuery('830000 45+200')).toEqual({ code: '830000', pk: 45.2 });
    expect(parsePkQuery('L830 000 pk 45,2')).toEqual({ code: '830000', pk: 45.2 });
    expect(parsePkQuery('45+200 830000')).toEqual({ code: '830000', pk: 45.2 });
    expect(parsePkQuery('830000')).toBeNull();
    expect(parsePkQuery('Willer')).toBeNull();
  });
});

describe('position d’un PK', () => {
  it('place le PK du PN 35 (ligne 130 000) sur le PN', () => {
    const doc = line('130000');
    const pn = doc.points.find((p) => p[1] === 'pn' && p[2] === 'PN 35')!;
    const pos = positionsAtPk(doc, pn[0]);
    expect(pos.length).toBe(1);
    expect(distance(pos[0].lonlat, [pn[4], pn[5]])).toBeLessThan(30);
  });
  it('place les PN de la ligne 830 000 à leur PK', () => {
    // Les gares ne servent pas de référence : leur point est le bâtiment, souvent à 50-150 m de leur PK.
    const doc = line('830000');
    const pns = doc.points.filter((p) => p[1] === 'pn');
    const ecarts = pns.map((g) => Math.min(...positionsAtPk(doc, g[0]).map((x) => distance(x.lonlat, [g[4], g[5]]))));
    ecarts.sort((a, b) => a - b);
    expect(ecarts[Math.floor(ecarts.length / 2)]).toBeLessThan(15);
  });
  it('ne trouve rien hors de la ligne', () => {
    const doc = line('130000');
    const [, hi] = pkRange(doc);
    expect(positionsAtPk(doc, hi + 5)).toEqual([]);
  });
});

describe('poser un point sur la ligne (déplacer un agent sur la carte)', () => {
  it('rend le PK du point de la ligne le plus proche : aller-retour avec la position d’un PK', () => {
    const doc = line('830000');
    for (const pk of [28.268, 28.718, 29.218, 47.05]) {
      const at = positionsAtPk(doc, pk)[0].lonlat;
      const r = pkPres(doc, at)!;
      expect(r.pk).toBeCloseTo(pk, 2);
      expect(r.dist).toBeLessThan(1);
    }
  });

  it('un point à côté de la voie est ramené sur la voie', () => {
    const doc = line('830000');
    const at = positionsAtPk(doc, 28.5)[0].lonlat;
    const aCote: [number, number] = [at[0] + 0.0005, at[1] + 0.0003]; // une cinquantaine de mètres
    const r = pkPres(doc, aCote)!;
    expect(r.dist).toBeGreaterThan(20);
    expect(Math.abs(r.pk - 28.5)).toBeLessThan(0.08);
    expect(pkPres(doc, r.point)!.dist).toBeLessThan(1);
  });
});
