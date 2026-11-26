import { describe, expect, it } from 'vitest';
import { lirePlanning, memeAgent, proches, semaineIso, type Morceau } from './lire';

/** Morceau de texte centré en (cx, cy), comme dans le PDF imprimé depuis Excel (hauteur 5). */
const m = (s: string, cx: number, cy: number): Morceau => ({ s, x: cx - s.length * 1.2, y: cy - 2.5, l: s.length * 2.4, h: 5 });

const COLS = [242, 294, 345, 397, 448, 500, 551];
const ENTETE = ['lun 23 nov', 'mar 24 nov', 'mer 25 nov', 'jeu 26 nov', 'ven 27 nov', 'sam 28 nov', 'dim 29 nov'];

/** Une page : en-têtes, puis une ligne par agent (noms fictifs), cases sur plusieurs lignes. */
function page(agents: { nom: string[]; tel: string; adr: string; y: number; cases: string[][] }[], entetes = ENTETE): Morceau[] {
  const p: Morceau[] = [m('PLANNING SECURITE CHANTIER', 60, 760), m('S.48', 400, 755), m('NOM', 65, 725), m('Prénom', 65, 719), m('Numéro', 141, 722), m('Adresse', 193, 722)];
  entetes.forEach((e, i) => e && p.push(m(e, COLS[i], 722)));
  for (const a of agents) {
    a.nom.forEach((n, k) => p.push(m(n, 65, a.y + (a.nom.length - 1) * 3.5 - k * 7)));
    p.push(m(a.tel, 141, a.y), m(a.adr, 193, a.y));
    a.cases.forEach((lignes, i) => lignes.forEach((l, k) => p.push(m(l, COLS[i], a.y + ((lignes.length - 1) / 2 - k) * 3.6))));
  }
  return p;
}

const NUIT = ['"RGI EXEMPLE"', '[ANN]', 'Melun', '21h00-04h00'];
const AGENTS = [
  { nom: ['MARTIN Paul'], tel: '06 00 00 00 01', adr: 'IDF', y: 676, cases: [NUIT, NUIT, NUIT, NUIT, NUIT, ['Z'], ['RH']] },
  // Grande case (8 lignes) juste sous une petite : chaque ligne reste à son agent.
  {
    nom: ['DURAND-LEFEBVRE', 'Anne Marie'],
    tel: '06 00 00 00 02',
    adr: 'CENTRE',
    y: 620,
    cases: [['"CDG Axe nord"', 'Zone F', '[APLAM/S9]', '22H00-05h00', 'Ps : Giratoire', 'OTP: 947', 'EPI Obligatoire', 'NUIT'], [], [], [], [], ['RH'], ['RH']],
  },
  { nom: ['BERNARD Luc'], tel: '07 00 00 00 03', adr: 'EST', y: 560, cases: [['AMO'], ['AMO'], ['CP'], ['CP'], ['CP'], ['RH'], ['RH']] },
];

describe('lecture du planning ETF', () => {
  it('range chaque morceau dans la case de son agent et de son jour', () => {
    const r = lirePlanning([page(AGENTS)], new Date(2026, 10, 26))!;
    expect(r).not.toBeNull();
    expect(r.lundi).toBe('2026-11-23');
    expect(r.semaine).toBe(48);
    expect(r.agents.map((a) => a.nom)).toEqual(['MARTIN Paul', 'DURAND-LEFEBVRE Anne Marie', 'BERNARD Luc']);
    const [paul, anne, luc] = r.agents;
    expect(paul.numero).toBe('06 00 00 00 01');
    expect(paul.adresse).toBe('IDF');
    expect(paul.jours[0]).toEqual(NUIT);
    expect(paul.jours[5]).toEqual(['Z']);
    expect(anne.jours[0]).toHaveLength(8);
    expect(anne.jours[0][4]).toBe('Ps : Giratoire');
    expect(anne.jours[1]).toEqual([]);
    expect(luc.jours.map((j) => j[0])).toEqual(['AMO', 'AMO', 'CP', 'CP', 'CP', 'RH', 'RH']);
  });

  it('retrouve les colonnes même si un en-tête de jour est illisible', () => {
    const entetes = [...ENTETE];
    entetes[6] = '';
    entetes[2] = '';
    const r = lirePlanning([page(AGENTS, entetes)], new Date(2026, 10, 26))!;
    expect(r.agents[0].jours[6]).toEqual(['RH']);
    expect(r.agents[0].jours[2]).toEqual(NUIT);
  });

  it('plusieurs pages : les agents de chaque page, avec la date de la première', () => {
    const r = lirePlanning([page(AGENTS.slice(0, 1)), page(AGENTS.slice(1))], new Date(2026, 10, 26))!;
    expect(r.agents).toHaveLength(3);
  });

  it('année : celle où la date tombe sur le bon jour, au plus près de l’import', () => {
    const janvier = ['lun 04 janv', 'mar 05 janv', 'mer 06 janv', 'jeu 07 janv', 'ven 08 janv', 'sam 09 janv', 'dim 10 janv'];
    const r = lirePlanning([page(AGENTS, janvier)], new Date(2026, 11, 30))!;
    expect(r.lundi).toBe('2027-01-04');
    expect(r.semaine).toBe(1);
    expect(r.annee).toBe(2027);
  });

  it('pas un planning : rien', () => {
    expect(lirePlanning([[m('Facture', 100, 700), m('Total 12,00 €', 100, 680)]])).toBeNull();
    expect(lirePlanning([])).toBeNull();
  });

  it('semaine ISO', () => {
    expect(semaineIso(new Date(2026, 10, 23))).toEqual({ semaine: 48, annee: 2026 });
    expect(semaineIso(new Date(2027, 0, 1))).toEqual({ semaine: 53, annee: 2026 });
  });
});

describe('retrouver ma ligne', () => {
  it('tous les mots du nom donné, accents et casse ignorés', () => {
    expect(memeAgent('DURAND-LEFEBVRE Anne Marie', 'Anne Durand')).toBe(true);
    expect(memeAgent('MARTIN Paul', 'Paul Martin')).toBe(true);
    expect(memeAgent('MARTIN Paul', 'Paul')).toBe(true);
    expect(memeAgent('MARTIN Paul', 'Pierre Martin')).toBe(false);
    expect(memeAgent('MARTIN Paul', '')).toBe(false);
    expect(memeAgent('HÉLÈNE Léa', 'helene lea')).toBe(true);
  });

  it('les plus proches d’abord, pour la liste au premier import', () => {
    const r = lirePlanning([page(AGENTS)], new Date(2026, 10, 26))!;
    expect(proches(r.agents, 'Luc Bernard').map((a) => a.nom)).toEqual(['BERNARD Luc']);
    expect(proches(r.agents, 'Tests')).toEqual([]);
  });
});
