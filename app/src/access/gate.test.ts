import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentCourt, checkCode, decide, dureeTexte, type StoredAccess } from './gate';

const H = 3600_000;
const base: StoredAccess = { code: 'ABCDEF23', nom: 'Test', verifie: 1_000 * H };

describe('code gardé sur le téléphone', () => {
  it('anciens codes : 30 jours sans réseau', () => {
    expect(decide(base, base.verifie + 29 * 24 * H).open).toBe(true);
    expect(decide(base, base.verifie + 31 * 24 * H)).toEqual({ open: false, expired: true, raison: 'expire' });
  });

  it('temps sans réseau choisi pour le code', () => {
    const c = { ...base, horsLigneH: 24 };
    expect(decide(c, c.verifie + 23 * H).open).toBe(true);
    expect(decide(c, c.verifie + 25 * H).raison).toBe('expire');
  });

  it('réseau obligatoire : quelques minutes de tolérance seulement', () => {
    const c = { ...base, horsLigneH: 0 };
    expect(decide(c, c.verifie + 4 * 60_000).open).toBe(true);
    expect(decide(c, c.verifie + 6 * 60_000).open).toBe(false);
  });

  it('code arrivé à sa fin : fermé même sans réseau', () => {
    const c = { ...base, fin: base.verifie + 2 * H };
    expect(decide(c, c.verifie + H).open).toBe(true);
    expect(decide(c, c.verifie + 2 * H)).toEqual({ open: false, expired: false, raison: 'fin' });
  });

  it('pas de code', () => {
    expect(decide(null, Date.now())).toEqual({ open: false, expired: false, raison: null });
  });

  it('durées lisibles', () => {
    expect(dureeTexte(0)).toBe('quelques minutes');
    expect(dureeTexte(1)).toBe('1 heure');
    expect(dureeTexte(24)).toBe('24 heures');
    expect(dureeTexte(168)).toBe('7 jours');
    expect(dureeTexte(720)).toBe('30 jours');
  });

  it('téléphone reconnaissable dans l’espace administrateur', () => {
    expect(agentCourt('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36', true)).toBe('Android · Chrome · appli installée');
    expect(agentCourt('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1', false)).toBe('iPhone · Safari');
    expect(agentCourt('Mozilla/5.0 (Linux; Android 13) SamsungBrowser/24.0 Chrome/115 Mobile Safari/537.36', false)).toBe('Android · Samsung Internet');
  });
});

describe('vérification par le serveur', () => {
  let envoye: Record<string, unknown> | null;
  const reponse = (json: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init: RequestInit) => {
        envoye = JSON.parse(String(init.body));
        return new Response(JSON.stringify(json), { status: 200 });
      }),
    );
  beforeEach(() => {
    envoye = null;
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile' });
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('envoie le code et l’identifiant du téléphone (toujours le même), lit la durée et la fin', async () => {
    reponse({ ok: true, nom: 'Démo agence', hors_ligne_h: 0, expire_le: '2026-11-27T14:00:00+00:00' });
    const r = await checkCode('abcd-ef23');
    expect(r).toEqual({ ok: true, nom: 'Démo agence', horsLigneH: 0, fin: Date.parse('2026-11-27T14:00:00Z') });
    expect(envoye).toMatchObject({ p_code: 'ABCDEF23', p_agent: 'Android · Chrome' });
    const id = envoye!.p_appareil;
    expect(id).toMatch(/^[a-z0-9]{12}$/);
    await checkCode('ABCDEF23');
    expect(envoye!.p_appareil).toBe(id);
  });

  it('dit pourquoi un code ne marche plus', async () => {
    reponse({ ok: false, raison: 'coupe' });
    expect(await checkCode('ABCDEF23')).toEqual({ ok: false, raison: 'coupe' });
    reponse({ ok: false, raison: 'fin' });
    expect((await checkCode('ABCDEF23')).raison).toBe('fin');
    reponse({ ok: false });
    expect((await checkCode('ABCDEF23')).raison).toBe('inconnu');
  });

  it('ancien serveur (sans durée) : code sans limite', async () => {
    reponse({ ok: true, nom: 'Équipe' });
    expect(await checkCode('ABCDEF23')).toEqual({ ok: true, nom: 'Équipe', horsLigneH: undefined, fin: null });
  });
});
