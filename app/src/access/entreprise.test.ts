import { describe, expect, it } from 'vitest';
import { lireEntreprise, reviserVisible, TOUT } from './entreprise';
import { logoPdf } from '../lib/pdfKit';

describe('entreprise du code d’accès', () => {
  it('lit l’entreprise renvoyée par le serveur', () => {
    expect(lireEntreprise({ id: 'e1', nom: ' Exemple Rail ', modules: { planning: true, memo: false, quiz: true }, logo_v: 3 })).toEqual({
      id: 'e1',
      nom: 'Exemple Rail',
      modules: { planning: true, memo: false, quiz: true },
      logoV: 3,
    });
  });
  it('contenu absent ou mal formé : rien d’activé ; entreprise mal formée : ignorée', () => {
    expect(lireEntreprise({ id: 'e1', nom: 'X' })?.modules).toEqual({ planning: false, memo: false, quiz: false });
    expect(lireEntreprise({ id: 'e1', nom: 'X', modules: { memo: 'oui' }, logo_v: 'x' })).toMatchObject({ modules: { memo: false }, logoV: 0 });
    expect(lireEntreprise(null)).toBeNull();
    expect(lireEntreprise({ nom: 'X' })).toBeNull();
    expect(lireEntreprise('ETF')).toBeNull();
  });
  it('onglet « Réviser » seulement s’il y a un mémo ou un quiz', () => {
    expect(reviserVisible(TOUT)).toBe(true);
    expect(reviserVisible({ planning: true, memo: false, quiz: false })).toBe(false);
    expect(reviserVisible({ planning: false, memo: false, quiz: true })).toBe(true);
  });
  it('logo pour le PDF : PNG ou JPEG seulement', () => {
    expect(logoPdf('data:image/png;base64,AAAA')?.format).toBe('PNG');
    expect(logoPdf('data:image/jpeg;base64,AAAA')?.format).toBe('JPEG');
    expect(logoPdf('data:image/webp;base64,AAAA')).toBeNull();
    expect(logoPdf(null)).toBeNull();
  });
});
