import { describe, expect, it } from 'vitest';
import { jetonDuLien } from './client';

describe('lien « mot de passe oublié » collé à la main', () => {
  const jeton = 'pkce_0123456789abcdefABCDEF-_xyz';
  it('lit le jeton du lien, même enveloppé par la messagerie', () => {
    const lien = `https://rlywthlidnrykiacfudz.supabase.co/auth/v1/verify?token=${jeton}&type=recovery&redirect_to=https://mdbenjemaa.github.io/asp-rail/?admin`;
    expect(jetonDuLien(lien)).toBe(jeton);
    expect(jetonDuLien(`  ${lien}\n`)).toBe(jeton);
    expect(jetonDuLien(`https://www.google.com/url?q=${encodeURIComponent(lien)}&sa=D`)).toBe(jeton);
  });
  it('refuse ce qui n’est pas un lien de ce genre', () => {
    expect(jetonDuLien('https://mdbenjemaa.github.io/asp-rail/')).toBeNull();
    expect(jetonDuLien('token=court')).toBeNull();
    expect(jetonDuLien('')).toBeNull();
  });
});
