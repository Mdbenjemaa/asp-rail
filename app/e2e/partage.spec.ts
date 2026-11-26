import { AGENTS, fauxPlanning } from './fauxPlanning';
import { expect, openApp, test } from './helpers';

// Le service worker reçoit le partage : il doit tourner, comme sur le téléphone.
test.use({ serviceWorkers: 'allow' });

test('partager le PDF depuis Gmail vers l’appli (Android) : le planning s’importe tout seul', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Le partage vers une appli web n’existe que sur Android (Chrome)');
  await openApp(page, { home: true, storage: { 'asp-planning-nom': JSON.stringify('MARTIN Paul') } });
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });
  const manifeste = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href)).json());
  expect(manifeste.share_target).toMatchObject({ action: './partage-planning', method: 'POST', enctype: 'multipart/form-data' });

  // Ce que fait Android au partage : un envoi de formulaire (POST) vers l'adresse du manifeste, avec le PDF.
  await page.evaluate(() => {
    const f = document.createElement('form');
    f.method = 'post';
    f.enctype = 'multipart/form-data';
    f.action = './partage-planning';
    f.id = 'partage';
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.name = 'pdf';
    f.append(champ);
    document.body.append(f);
  });
  await page.locator('#partage input').setInputFiles({ name: 'Planning Securite chantier S48 définitif.pdf', mimeType: 'application/pdf', buffer: fauxPlanning(AGENTS()) });
  await page.evaluate(() => (document.getElementById('partage') as HTMLFormElement).submit());

  // L'appli s'ouvre sur « Mon planning » et importe le PDF ; l'adresse est nettoyée, le cache vidé.
  const ecran = page.getByRole('dialog', { name: 'Mon planning ETF' });
  await expect(ecran).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.ds-snack')).toContainText(/Importé : semaine \d+ \(définitif\), 6 jours de travail/, { timeout: 20_000 });
  await expect(ecran.locator('.ds-jour.travail')).toHaveCount(6);
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate(async () => (await (await caches.open('asp-partage')).keys()).length)).toBe(0);
});
