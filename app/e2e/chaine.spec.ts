import type { Page } from '@playwright/test';
import { exporterPdf, expect, fakeShare, openApp, shot, test } from './helpers';

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Annonce › « Dans la chaîne ». */
async function versChaine(page: Page) {
  await page.getByRole('radiogroup', { name: 'Dans l’annonce, je suis' }).getByRole('radio', { name: 'Dans la chaîne' }).click();
}

test('chaîne, à la main : je saisis mon poste de sentinelle, le GPS me guide, mon service, fin de poste et compte rendu', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await fakeShare(page);
  await openApp(page, { home: true });
  await versChaine(page);
  await page.getByRole('region', { name: 'Prendre mon poste' }).getByRole('button', { name: 'Saisir mon poste' }).click();

  const edit = page.getByRole('dialog', { name: 'Nouveau poste' });
  await edit.getByRole('radiogroup', { name: 'Rôle dans la chaîne' }).getByRole('radio', { name: 'Sentinelle' }).click();
  await expect(edit.getByLabel('Mon code dans la chaîne')).toHaveValue('S1');
  await edit.getByLabel('Chantier').fill('Traverses');
  await edit.getByLabel('Ligne (code à 6 chiffres)').fill('830000');
  await edit.getByLabel('Mon PK : kilomètres').fill('28');
  await edit.getByLabel('Mon PK : mètres').fill('500');
  await edit.getByLabel('Je dois voir jusqu’au PK (point d’annonce) : kilomètres').fill('28');
  await edit.getByLabel('Je dois voir jusqu’au PK (point d’annonce) : mètres').fill('268');
  await edit.getByLabel('Nom de l’ASP').fill('Moo');
  await edit.getByLabel('Téléphone de l’ASP').fill('06 12 34 56 78');
  await edit.getByRole('button', { name: 'Prendre ce poste' }).click();

  const poste = page.getByRole('dialog', { name: 'Mon poste : Sentinelle S1 · Traverses' });
  const hero = poste.getByRole('region', { name: 'Mon poste' });
  await expect(hero).toContainText('Pas encore en place');
  await expect(poste).toContainText('Je dois voir jusqu’au PK 28+268');
  await expect(poste).toContainText('232 m à voir');
  // GPS (Lieusaint, PK 28+718) : le poste est 218 m plus loin vers les PK décroissants.
  await expect(hero.locator('.ch-ou')).toContainText(/Ton poste est à 2\d\d m, vers les PK décroissants/);
  await expect(poste.getByRole('link', { name: /^Appeler mon ASP/ })).toHaveAttribute('href', 'tel:0612345678');

  await hero.getByRole('button', { name: 'Je suis en place' }).click();
  await expect(hero.locator('.ds-status')).toContainText(/^En place depuis \d{2}:\d{2}/);
  await hero.getByRole('button', { name: 'Train annoncé' }).click();
  await hero.getByRole('button', { name: 'Train annoncé' }).click();
  await expect(hero.locator('.cr-compte')).toContainText('2 trains annoncés');
  await hero.getByRole('button', { name: /^Annuler le dernier train/ }).click();
  await expect(hero.locator('.cr-compte')).toContainText('1 train annoncé');
  await hero.getByRole('button', { name: 'Incident', exact: true }).click();
  await page.getByRole('dialog', { name: 'Noter un incident' }).getByLabel('Ce qui s’est passé').fill('Perdu la vue de A1 pendant 2 min');
  await page.getByRole('dialog', { name: 'Noter un incident' }).getByRole('button', { name: /^Noter à/ }).click();
  await expect(hero).toContainText('Perdu la vue de A1');
  await shot(page, '08-poste-chaine');

  // Fin de poste : le compte rendu est proposé, signé par l'agent et l'ASP.
  await hero.getByRole('button', { name: 'Fin de poste' }).click();
  const pdf = await exporterPdf(page, { nom: 'Karim Test', signer: true });
  expect(pdf.name).toMatch(/^Compte-rendu-poste-Sentinelle-S1-Traverses-.+\.pdf$/);
  for (const x of ['Compte rendu de poste', 'Sentinelle S1', 'Trains annoncés : 1', 'Perdu la vue de A1', 'ASP']) expect(pdf.plat, x).toContain(x);
  await expect(hero.locator('.ds-status')).toContainText(/^Fin de poste à/);

  // Ma fiche réflexe.
  await poste.getByRole('button', { name: /^Mes gestes et signaux/ }).click();
  const gestes = page.getByRole('dialog', { name: 'Mes gestes et signaux' });
  await expect(gestes.getByRole('radiogroup', { name: 'Rôle' }).getByRole('radio', { name: 'Sentinelle' })).toHaveAttribute('aria-checked', 'true');
  await expect(gestes).toContainText('Mon poste de sentinelle');
  await expect(gestes).toContainText('je préviens l’ASP tout de suite');
  await shot(page, '08c-gestes');
});

/** Chantier partagé simulé : l'ASP « Moo » partage sa chaîne (A1, A2), puis déplace A1. */
async function fakeChaine(page: Page) {
  const envois: { p_activite: string; p_donnees: { etat?: string; lien?: unknown } | null }[] = [];
  let pkA1 = 28.268;
  const session = { ok: true, code: 'K7P3QX', nom: 'Remplacement traverses', expire_le: new Date(Date.now() + 86_400_000).toISOString() };
  await page.route('**/rest/v1/rpc/asp_rejoindre_session', (route) => route.fulfill({ json: session }));
  await page.route('**/rest/v1/rpc/asp_voir_session', (route) =>
    route.fulfill({
      json: {
        ...session,
        partages: [
          {
            appareil: 'asp-tel-1234',
            activite: 'asp',
            nom: 'Moo',
            tel: '06 12 34 56 78',
            maj: new Date().toISOString(),
            donnees: {
              v: 1,
              titre: 'Traverses',
              etat: 'Chaîne d’annonce en place depuis 22:05',
              niveau: 'en-place',
              ligne: '830000',
              details: [],
              geo: [],
              chaine: [
                { code: 'A1', role: 'annonceur', pk: pkA1, surveille: 'V1 ▲', pas: [{ titre: 'PA V1 ▲', pk: 28.268 }] },
                { code: 'A2', role: 'annonceur', pk: 29.218, surveille: 'V2 ▼', pas: [{ titre: 'PA V2 ▼', pk: 29.218 }] },
              ],
            },
          },
        ],
      },
    }),
  );
  await page.route('**/rest/v1/rpc/asp_partager', async (route) => {
    envois.push(route.request().postDataJSON() as (typeof envois)[number]);
    await route.fulfill({ json: { ok: true } });
  });
  return { envois, deplacerA1: (pk: number) => (pkA1 = pk) };
}

test('chaîne reliée à l’ASP : je prends A1 dans sa chaîne, il voit que je suis en place, mon poste suit quand il me déplace', async ({ page }) => {
  const { envois, deplacerA1 } = await fakeChaine(page);
  await openApp(page, { home: true, path: './#chantier=K7P-3QX' });
  await versChaine(page);
  const chaines = page.getByRole('group', { name: 'Chaînes partagées par les ASP' });
  await chaines.getByRole('button', { name: /^Chaîne de Moo/ }).click();
  await page.getByRole('dialog', { name: 'Chaîne de Moo' }).getByRole('button', { name: /Annonceur A1/ }).click();

  const poste = page.getByRole('dialog', { name: 'Mon poste : Annonceur A1 · Traverses' });
  await expect(poste).toContainText('PA V1 ▲ : je suis au point d’annonce');
  await expect(poste).toContainText('Poste pris dans sa chaîne');
  await expect(poste.getByLabel(/^Partager mon poste/)).toBeChecked();
  // Partagé, relié à l'ASP : il voit mon état.
  await expect.poll(() => envois.at(-1)?.p_activite, { timeout: 10_000 }).toBe('chaine');
  expect(envois.at(-1)!.p_donnees).toMatchObject({ etat: 'Pas encore en place', lien: { asp: 'asp-tel-1234', code: 'A1' } });
  await poste.getByRole('region', { name: 'Mon poste' }).getByRole('button', { name: 'Je suis en place' }).click();
  await expect.poll(() => envois.at(-1)?.p_donnees?.etat, { timeout: 10_000 }).toMatch(/^En place depuis \d{2}:\d{2}$/);

  // L'ASP rapproche A1 du chantier : mon poste suit, avec un message.
  deplacerA1(28.7);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.ds-snack').filter({ hasText: 'L’ASP a déplacé ton poste A1 : PK 28+700.' })).toBeVisible({ timeout: 10_000 });
  await expect(poste).toContainText('Mon PK 28+700');
  await expect(poste).toContainText('Je dois voir jusqu’au PK 28+268 (PA V1 ▲)');
});

test('côté ASP : les agents qui ont pris leur poste dans ma chaîne, et s’ils sont en place', async ({ page }) => {
  const moi = 'e2e-asp-appareil-1';
  const session = { ok: true, code: 'K7P3QX', nom: 'Remplacement traverses', expire_le: new Date(Date.now() + 86_400_000).toISOString() };
  await page.route('**/rest/v1/rpc/asp_voir_session', (route) =>
    route.fulfill({
      json: {
        ...session,
        partages: [
          {
            appareil: 'agent-karim-1',
            activite: 'chaine',
            nom: 'Karim',
            tel: '',
            maj: new Date().toISOString(),
            donnees: { v: 1, titre: 'Annonceur A1 · Traverses', etat: 'En place depuis 22:05', niveau: 'en-place', ligne: '830000', details: [], geo: [], lien: { asp: moi, code: 'A1' } },
          },
        ],
      },
    }),
  );
  await page.route('**/rest/v1/rpc/asp_partager', (route) => route.fulfill({ json: { ok: true } }));
  const chantier = {
    id: 'c-asp',
    created: Date.now(),
    updated: Date.now(),
    nom: 'Traverses',
    date: aujourdhui(),
    ligne: '830000',
    pkDebut: 28.718,
    pkFin: 28.768,
    voies: [{ id: 'v1', nom: 'V1', sens: 'croissant', vitesse: 160, role: 'travail', interdite: false }],
    agents: [
      { id: 'asp', role: 'asp', nom: 'Moo', entreprise: '', pk: null, surveille: [] },
      { id: 'a1', role: 'annonceur', nom: '', entreprise: '', pk: 28.268, surveille: ['v1:croissant'] },
    ],
  };
  await openApp(page, {
    home: true,
    storage: { 'asp-chantiers-v1': [chantier], 'asp-appareil': JSON.stringify(moi), 'asp-session': { code: 'K7P3QX', nom: 'Remplacement traverses', fin: Date.now() + 86_400_000 } },
  });
  const hero = page.getByRole('region', { name: 'Mon chantier' });
  await expect(hero.locator('.ch-lies')).toContainText('A1 Karim : en place depuis 22:05');
  await hero.getByRole('button', { name: 'Ouvrir la fiche' }).click();
  const a1 = page.getByRole('dialog', { name: /^Fiche chantier/ }).getByRole('button', { name: 'A1 : Annonceur' });
  await expect(a1).toContainText('Annonceur · Karim');
  await expect(a1).toContainText('En place');
});
