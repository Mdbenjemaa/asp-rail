import { describe, expect, it } from 'vitest';
import { entrepriseChoisie, invitationDuHash, jetonDuLien, lireRole } from './client';

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

describe('invitation d’un administrateur d’entreprise', () => {
  const j = 'ab'.repeat(24);
  it('lit le jeton du lien d’invitation', () => {
    expect(invitationDuHash(`#admin&invitation=${j}`)).toBe(j);
    expect(invitationDuHash(`#admin&invitation=${j.toUpperCase()}&x=1`)).toBe(j);
    expect(invitationDuHash('#admin&invitation=abc')).toBeNull();
    expect(invitationDuHash('#admin')).toBeNull();
  });
  it('rôle : administrateur d’ASP Rail ou d’une entreprise, et l’entreprise affichée', () => {
    const r = lireRole({ email: 'chef@exemple.fr', super: false, entreprises: [{ id: 'e1', nom: 'Exemple Rail' }, { id: 2 }, { id: 'e2', nom: 'Autre' }] })!;
    expect(r).toEqual({ email: 'chef@exemple.fr', super: false, entreprises: [{ id: 'e1', nom: 'Exemple Rail' }, { id: 'e2', nom: 'Autre' }] });
    expect(lireRole({ super: 'oui' })).toEqual({ email: '', super: false, entreprises: [] });
    expect(lireRole(null)).toBeNull();
    expect(entrepriseChoisie(r, 'e2')).toBe('e2');
    expect(entrepriseChoisie(r, 'disparue')).toBe('e1');
    expect(entrepriseChoisie({ ...r, entreprises: [] }, 'e1')).toBeNull();
  });
});
