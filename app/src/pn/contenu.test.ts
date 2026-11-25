import { describe, expect, it } from 'vitest';
import { questionDuJour, questionsDe } from '../asp/quizStats';
import { MEMO_PN, REGLES_PN } from './memo';
import { EXERCICES_ORDRE } from './ordre';
import { QUESTIONS_PN } from './quiz';

describe('contenu TES F', () => {
  it('quiz PN : identifiants uniques, 3 choix ou plus, bonne réponse valide, distinct du quiz ASP', () => {
    const ids = QUESTIONS_PN.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of QUESTIONS_PN) {
      expect(q.choix.length).toBeGreaterThanOrEqual(3);
      expect(new Set(q.choix).size).toBe(q.choix.length);
      expect(q.choix[q.bonne]).toBeTruthy();
      expect(q.explication.length).toBeGreaterThan(10);
    }
    expect(questionsDe('pn')).toBe(QUESTIONS_PN);
    const asp = new Set(questionsDe('asp').map((q) => q.id));
    expect(ids.some((id) => asp.has(id))).toBe(false);
  });

  it('question du jour : stable pour un jour, propre à chaque activité', () => {
    const a = questionDuJour('pn', '2026-11-25');
    expect(questionDuJour('pn', '2026-11-25').q.id).toBe(a.q.id);
    expect(QUESTIONS_PN.map((q) => q.id)).toContain(a.q.id);
    expect([...a.ordre].sort()).toEqual(a.q.choix.map((_, i) => i));
  });

  it('mémo PN et cas pratiques bien formés', () => {
    const ids = MEMO_PN.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('pn-derangement');
    expect(REGLES_PN.length).toBeGreaterThanOrEqual(5);
    for (const e of EXERCICES_ORDRE) {
      expect(e.etapes.length).toBeGreaterThanOrEqual(4);
      expect(new Set(e.etapes).size).toBe(e.etapes.length);
    }
  });
});
