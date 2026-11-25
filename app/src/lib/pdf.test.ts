import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculChantier, nouveauChantier } from '../asp/chantier';
import { fichePdf } from '../asp/pdf';
import { journalLamPdf } from '../lam/pdf';
import { cocherLam, noterDepeche, nouvelleMissionLam, toutesEtapesLam } from '../lam/mission';
import { journalPnPdf } from '../pn/pdf';
import { cocher, nouvelleMission, toutesEtapes } from '../pn/mission';
import type { LineDoc } from './data';
import { nomPdf, pdfText, type InfoExport } from './pdfKit';
import { planSituation, rayonPour } from './plan';

const doc = JSON.parse(readFileSync(new URL('../../public/data/lines/830000.json', import.meta.url), 'utf8')) as LineDoc;
/** Signature de test : PNG 1 × 1. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const info: InfoExport = { agent: 'Moo Test', signature: PNG, signeA: new Date(2026, 10, 25, 10, 20).getTime(), cree: new Date(2026, 10, 25, 10, 25) };

async function contenu(f: File) {
  const buf = Buffer.from(await f.arrayBuffer());
  if (process.env.PDF_OUT) writeFileSync(`${process.env.PDF_OUT}/${f.name}`, buf);
  return buf.toString('latin1');
}

describe('plan de situation', () => {
  it('centré sur le PK, voie tournée pour que les PK croissent vers la droite', () => {
    const p = planSituation(doc, 47.403, { marques: [{ pk: 47.403, label: 'PN 26', genre: 'ici' }] })!;
    expect(p).not.toBeNull();
    expect(p.marques[0].u).toBeCloseTo(0, 0);
    expect(Math.abs(p.marques[0].v)).toBeLessThan(1);
    expect(p.points.some((x) => x.nom === 'PN 26' && x.genre === 'pn')).toBe(true);
    const r = p.reperes.map((x) => x.pk);
    expect(r).toContain(47.5);
    // Un PK plus grand est plus à droite.
    const a = p.reperes.find((x) => x.pk === 47)!;
    const b = p.reperes.find((x) => x.pk === 48)!;
    expect(b.u).toBeGreaterThan(a.u);
    expect(Math.hypot(...p.nord)).toBeCloseTo(1, 5);
    expect(planSituation(doc, 9999)).toBeNull();
  });

  it('rayon adapté à la zone, entre 600 m et 5 km', () => {
    expect(rayonPour(10, [10.1])).toBe(600);
    expect(rayonPour(10, [9, 11.5])).toBe(1900);
    expect(rayonPour(10, [30])).toBe(5000);
  });
});

describe('PDF', () => {
  it('nom de fichier daté de la création', () => {
    expect(nomPdf('Journal-PN', 'PN 26', info.cree)).toBe('Journal-PN-PN-26-2026-11-25-1025.pdf');
    expect(pdfText('Rouge → fermé, ≥ 3')).toBe('Rouge -> fermé, >= 3');
  });

  it('journal de mission PN : créé le, agent, plan, étapes, signatures', async () => {
    let m = nouvelleMission({ date: '2026-11-25', cch: 'M. Durand' });
    m = { ...m, pn: { ...m.pn, numero: '26', ligne: '830000', ligneNom: 'Paris-Lyon à Marseille', pk: 47.403, lieu: 'VC · La Rochette' } };
    for (const e of toutesEtapes(m).slice(0, 6)) m = cocher(m, e, true, e.depeche ? '12' : undefined);
    const f = journalPnPdf(m, info, doc);
    expect(f.name).toBe('Journal-PN-PN26-2026-11-25-1025.pdf');
    expect(f.type).toBe('application/pdf');
    const t = await contenu(f);
    expect(t.startsWith('%PDF-')).toBe(true);
    for (const x of ['Journal de mission PN', 'Plan de situation', 'Les ', 'Signatures', 'Moo Test', '25/11/2026', 'M. Durand', 'Ouvrir dans une carte', '/Subtype /Image'])
      expect(t, x).toContain(x);
  });

  it('journal AP S9 : carnet de dépêches avec les numéros', async () => {
    let m = nouvelleMissionLam({ type: 's9', bouclage: 'A3', outils: ['dsh', 'sam'], date: '2026-11-25', lieu: { ligne: '830000', ligneNom: null, pk: 47.05, voie: '1', lieu: '' } });
    const et = toutesEtapesLam(m);
    for (const e of et.slice(0, 3)) m = cocherLam(m, e, true);
    m = noterDepeche(m, { avec: 'RPTx', objet: 'Ordre de pose A3', recu: '93', donne: '24' }, et[3]);
    const f = journalLamPdf(m, { ...info, signature: null, signeA: null }, doc);
    expect(f.name).toBe('Journal-AP-S9-A3-2026-11-25-1025.pdf');
    const t = await contenu(f);
    for (const x of ['Journal de mission AP S9', 'Carnet de d', 'Ordre de pose A3', '(93)', '(24)', 'Plan de situation']) expect(t, x).toContain(x);
    expect(t).not.toContain('/Subtype /Image');
  });

  it('nom en arabe ou en polonais : écrit avec la police Unicode, seulement quand il le faut', async () => {
    const police = readFileSync(new URL('../assets/fonts/DejaVuSans.ttf', import.meta.url)).toString('base64');
    const m = nouvelleMissionLam({ type: 'lam', date: '2026-11-25', cch: 'Łukasz Żółć', lieu: { ligne: null, ligneNom: null, pk: null, voie: '', lieu: 'PN 26' } });
    const avec = await contenu(journalLamPdf(m, { ...info, agent: 'محمد', police }, null));
    expect(avec).toContain('/FontName /');
    expect(avec).toMatch(/DejaVu/);
    // Sans caractère spécial, la police n'est pas ajoutée (PDF léger).
    const sans = journalLamPdf({ ...m, cch: 'M. Durand' }, { ...info, police }, null);
    expect(await contenu(sans)).not.toMatch(/DejaVu/);
    // Sans police disponible : les caractères inconnus sont retirés, le PDF se fait quand même.
    expect(pdfText('Łukasz → محمد')).toBe('ukasz -> ');
    expect(pdfText('Łukasz → محمد', true)).toBe('Łukasz -> محمد');
  });

  it('journal AP LAM sans ligne : pas de plan, le reste est là', async () => {
    const m = nouvelleMissionLam({ type: 'lam', date: '2026-11-25', lieu: { ligne: null, ligneNom: null, pk: null, voie: '', lieu: 'PN 26' } });
    const t = await contenu(journalLamPdf(m, info, null));
    expect(t).toContain('Journal de mission AP LAM');
    expect(t).not.toContain('Plan de situation');
  });

  it('fiche CADA : plan avec la zone de travail', async () => {
    const c = { ...nouveauChantier(), nom: 'Remplacement traverses', ligne: '830000', ligneNom: 'Paris-Lyon', pkDebut: 47.1, pkFin: 47.3, date: '2026-11-25', asp: 'Moo' };
    const f = fichePdf(c, calculChantier(c), info, doc);
    expect(f.name).toMatch(/^CADA-Remplacement-traverses-2026-11-25-1025\.pdf$/);
    const t = await contenu(f);
    for (const x of ['Fiche CADA', 'Plan de situation', 'Signatures', 'Responsable du chantier']) expect(t, x).toContain(x);
  });
});
